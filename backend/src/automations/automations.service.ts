import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventBusService } from '../events/event-bus.service';
import { SmsService } from '../sms/sms.service';
import { CallbacksService } from '../callbacks/callbacks.service';
import { WebhookDispatcherService } from '../webhooks/webhook-dispatcher.service';

interface Rule {
  id: number;
  company_id: number;
  trigger_event: string;
  is_active: number | boolean;
  conditions: Array<{ field_path: string; operator: string; value: any }>;
  actions: Array<{ action_type: string; config: any }>;
}

@Injectable()
export class AutomationsService implements OnModuleInit {
  private readonly logger = new Logger(AutomationsService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly bus: EventBusService,
    private readonly sms: SmsService,
    private readonly callbacks: CallbacksService,
    private readonly webhooks: WebhookDispatcherService,
  ) {}

  onModuleInit(): void {
    // Suscribirse a TODOS los topics conocidos por empresa via EventBus.
    // Como no tenemos wildcard sub local, escuchamos los eventos clave que
    // disparan la mayoría de automatizaciones:
    const topics = ['call', 'queue', 'agent', 'recording', 'webhook', 'ai', 'sms'];
    for (const t of topics) {
      this.bus.on(`co:event:${t}`, () => undefined); // noop placeholder
    }
    // Forward genérico: parchear publish para evaluar reglas
    const original = this.bus.publish.bind(this.bus);
    (this.bus as any).publish = async (channel: string, payload: any) => {
      await original(channel, payload);
      const m = /^co:(\d+):(.+)$/.exec(channel);
      if (m && payload?.type) {
        await this.evaluate(parseInt(m[1], 10), payload.type, payload).catch(err =>
          this.logger.error(`automation eval error: ${err?.message}`),
        );
      }
    };
  }

  private async loadRules(companyId: number, eventType: string): Promise<Rule[]> {
    const rules = await this.ds.query(
      `SELECT id, company_id, trigger_event, is_active FROM automation_rules
         WHERE company_id = ? AND trigger_event = ? AND is_active = TRUE
         ORDER BY priority ASC`,
      [companyId, eventType],
    );
    if (!rules.length) return [];
    const ruleIds = rules.map((r: any) => r.id);
    const conditions = await this.ds.query(
      `SELECT rule_id, field_path, operator, value FROM automation_conditions WHERE rule_id IN (${ruleIds.map(() => '?').join(',')})`,
      ruleIds,
    );
    const actions = await this.ds.query(
      `SELECT rule_id, action_type, config FROM automation_actions WHERE rule_id IN (${ruleIds.map(() => '?').join(',')}) ORDER BY sort_order ASC`,
      ruleIds,
    );
    return rules.map((r: any) => ({
      id: r.id,
      company_id: r.company_id,
      trigger_event: r.trigger_event,
      is_active: r.is_active,
      conditions: conditions.filter((c: any) => c.rule_id === r.id).map((c: any) => ({ ...c, value: typeof c.value === 'string' ? JSON.parse(c.value) : c.value })),
      actions: actions.filter((a: any) => a.rule_id === r.id).map((a: any) => ({ ...a, config: typeof a.config === 'string' ? JSON.parse(a.config) : a.config })),
    }));
  }

  async evaluate(companyId: number, eventType: string, payload: any): Promise<void> {
    const rules = await this.loadRules(companyId, eventType);
    for (const rule of rules) {
      const matched = rule.conditions.every(c => this.matches(payload, c.field_path, c.operator, c.value));
      if (!matched) continue;

      let executed = 0;
      let errorMessage: string | null = null;
      try {
        for (const action of rule.actions) {
          await this.executeAction(companyId, action.action_type, action.config, payload);
          executed++;
        }
      } catch (err: any) {
        errorMessage = err?.message ?? String(err);
        this.logger.error(`Automation ${rule.id} action error: ${errorMessage}`);
      }
      await this.ds.query(
        `INSERT INTO automation_logs (company_id, rule_id, matched, actions_executed, error_message)
         VALUES (?, ?, TRUE, ?, ?)`,
        [companyId, rule.id, executed, errorMessage],
      );
    }
  }

  private matches(payload: any, path: string, operator: string, value: any): boolean {
    const v = path.split('.').reduce((o: any, k: string) => (o ? o[k] : undefined), payload);
    switch (operator) {
      case 'eq': return v === value;
      case 'neq': return v !== value;
      case 'gt': return Number(v) > Number(value);
      case 'lt': return Number(v) < Number(value);
      case 'gte': return Number(v) >= Number(value);
      case 'lte': return Number(v) <= Number(value);
      case 'in': return Array.isArray(value) && value.includes(v);
      case 'not_in': return Array.isArray(value) && !value.includes(v);
      case 'contains': return String(v ?? '').includes(String(value));
      case 'matches': return new RegExp(String(value)).test(String(v ?? ''));
      default: return false;
    }
  }

  private async executeAction(companyId: number, actionType: string, config: any, payload: any): Promise<void> {
    switch (actionType) {
      case 'send_sms':
        await this.sms.send(companyId, config.to ?? payload.from_number ?? payload.phone, config.body, {
          templateSlug: config.template_slug,
          variables: { ...payload, ...(config.variables ?? {}) },
          customerId: payload.customer_id,
          callId: payload.call_id,
        });
        break;
      case 'create_callback':
        await this.callbacks.create(
          companyId,
          config.phone ?? payload.from_number ?? payload.phone,
          payload.customer_id,
          config.queue_id ?? payload.queue_id,
          payload.call_id,
        );
        break;
      case 'send_webhook':
        await this.webhooks.publish(companyId, config.event_type ?? 'automation.fired', { ...config.payload, source_event: payload });
        break;
      case 'create_ticket': {
        await this.ds.query(
          `INSERT INTO tickets (company_id, customer_id, call_id, subject, description, priority, status)
           VALUES (?, ?, ?, ?, ?, ?, 'open')`,
          [companyId, payload.customer_id ?? null, payload.call_id ?? null, config.subject, config.description ?? null, config.priority ?? 'normal'],
        );
        break;
      }
      case 'tag_customer': {
        if (!payload.customer_id || !config.tag_slug) break;
        const tag = await this.ds.query(`SELECT id FROM customer_tags WHERE company_id = ? AND slug = ?`, [companyId, config.tag_slug]);
        if (tag[0]) {
          await this.ds.query(
            `INSERT IGNORE INTO customer_tag_assignments (customer_id, tag_id) VALUES (?, ?)`,
            [payload.customer_id, tag[0].id],
          );
        }
        break;
      }
      case 'notify_supervisor':
        await this.ds.query(
          `INSERT INTO notifications (company_id, user_id, type, title, body, severity)
           SELECT ?, u.id, 'supervisor_alert', ?, ?, ?
             FROM users u INNER JOIN user_roles ur ON ur.user_id = u.id
             INNER JOIN roles r ON r.id = ur.role_id
             WHERE u.company_id = ? AND r.slug = 'supervisor' AND u.status = 'active'`,
          [companyId, config.title ?? 'Alerta', config.body ?? '', config.severity ?? 'warning', companyId],
        );
        break;
      case 'custom_http':
        await fetch(config.url, {
          method: config.method ?? 'POST',
          headers: { 'Content-Type': 'application/json', ...(config.headers ?? {}) },
          body: JSON.stringify({ event: payload, ...config.body }),
        });
        break;
      default:
        this.logger.warn(`Action type ${actionType} no soportada`);
    }
  }
}
