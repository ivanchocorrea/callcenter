import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConnectorsService } from '../../connectors/connectors.service';

interface BuiltinHandler {
  (companyId: number, input: Record<string, unknown>): Promise<unknown>;
}

/**
 * Registro y ejecución de tools (function calling) para los bots IA.
 * Tipos de handler:
 *   - builtin: TS function aquí
 *   - connector: ejecuta consulta sobre data_connectors (Sheets, API ext, MySQL ext)
 *   - webhook: HTTP POST con la entrada
 *   - sql: query SQL parametrizada con whitelist de tablas
 */
@Injectable()
export class AIToolsService {
  private readonly logger = new Logger(AIToolsService.name);
  private readonly builtins = new Map<string, BuiltinHandler>();

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly connectors: ConnectorsService,
  ) {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    this.builtins.set('consultar_cliente', async (companyId, input: any) => {
      const phone = String(input.phone ?? '').replace(/\s+/g, '');
      const r = await this.ds.query(
        `SELECT id, full_name, primary_phone, email, document_number, is_vip, important_notes
           FROM customers WHERE company_id = ? AND primary_phone = ? LIMIT 1`,
        [companyId, phone],
      );
      return r[0] ?? null;
    });

    this.builtins.set('crear_ticket', async (companyId, input: any) => {
      const r: any = await this.ds.query(
        `INSERT INTO tickets (company_id, customer_id, subject, description, priority, status)
         VALUES (?, ?, ?, ?, ?, 'open')`,
        [companyId, input.customer_id ?? null, input.subject, input.description ?? null, input.priority ?? 'normal'],
      );
      return { id: r?.insertId ?? r?.[0]?.insertId, status: 'open' };
    });

    this.builtins.set('crear_cita', async (companyId, input: any) => {
      const r: any = await this.ds.query(
        `INSERT INTO appointments (company_id, customer_id, title, description, start_at, end_at, status, created_via)
         VALUES (?, ?, ?, ?, ?, ?, 'scheduled', 'ai_bot')`,
        [companyId, input.customer_id ?? null, input.title, input.description ?? null, input.start_at, input.end_at ?? null],
      );
      return { id: r?.insertId ?? r?.[0]?.insertId };
    });

    this.builtins.set('buscar_cita', async (companyId, input: any) => {
      const r = await this.ds.query(
        `SELECT id, title, start_at, status FROM appointments
           WHERE company_id = ? AND customer_id = ? AND start_at >= NOW()
           ORDER BY start_at ASC LIMIT 5`,
        [companyId, input.customer_id],
      );
      return r;
    });

    this.builtins.set('crear_callback', async (companyId, input: any) => {
      const r: any = await this.ds.query(
        `INSERT INTO callback_requests (company_id, phone, customer_name, queue_id, requested_at, priority, status)
         VALUES (?, ?, ?, ?, NOW(), ?, 'pending')`,
        [companyId, input.phone, input.customer_name ?? null, input.queue_id ?? null, input.priority ?? 0],
      );
      return { id: r?.insertId ?? r?.[0]?.insertId };
    });

    this.builtins.set('transferir_a_humano', async () => {
      // El bot lo señaliza, el orquestador realiza la transferencia
      return { transfer: true };
    });
  }

  async list(companyId: number): Promise<unknown[]> {
    return this.ds.query(`SELECT * FROM ai_tools WHERE company_id = ? ORDER BY name`, [companyId]);
  }

  async execute(toolId: number, companyId: number, input: Record<string, unknown>, ctx: { botId?: number; conversationId?: number; callId?: number }): Promise<unknown> {
    const t = await this.ds.query(`SELECT * FROM ai_tools WHERE id = ? AND company_id = ? AND is_active = TRUE`, [toolId, companyId]);
    const tool = t[0];
    if (!tool) throw new NotFoundException();

    const start = Date.now();
    let success = false;
    let output: unknown = null;
    let errorMessage: string | null = null;

    try {
      switch (tool.handler_type) {
        case 'builtin': {
          const fn = this.builtins.get(tool.slug);
          if (!fn) throw new Error(`builtin "${tool.slug}" no registrado`);
          output = await Promise.race([
            fn(companyId, input),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), tool.timeout_ms || 10000)),
          ]);
          break;
        }
        case 'connector': {
          output = await this.connectors.execute(companyId, Number(tool.connector_id), input);
          break;
        }
        case 'webhook': {
          const cfg = typeof tool.handler_config === 'string' ? JSON.parse(tool.handler_config) : tool.handler_config;
          const res = await fetch(cfg.url, {
            method: cfg.method ?? 'POST',
            headers: { 'Content-Type': 'application/json', ...(cfg.headers ?? {}) },
            body: JSON.stringify(input),
          });
          output = await res.json();
          break;
        }
        case 'sql': {
          const cfg = typeof tool.handler_config === 'string' ? JSON.parse(tool.handler_config) : tool.handler_config;
          const params = (cfg.param_keys ?? []).map((k: string) => (input as any)[k] ?? null);
          output = await this.ds.query(cfg.query, [companyId, ...params]);
          break;
        }
        default:
          throw new Error(`handler_type ${tool.handler_type} no soportado`);
      }
      success = true;
    } catch (err: any) {
      errorMessage = err?.message ?? String(err);
      throw err;
    } finally {
      await this.ds.query(
        `INSERT INTO ai_tool_execution_logs
          (company_id, bot_id, tool_id, conversation_id, call_id, input, output, success, error_message, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId, ctx.botId ?? 0, toolId, ctx.conversationId ?? null, ctx.callId ?? null,
          JSON.stringify(input), success ? JSON.stringify(output) : null,
          success, errorMessage, Date.now() - start,
        ],
      );
    }
    return output;
  }
}
