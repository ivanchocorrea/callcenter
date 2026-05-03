import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AsteriskBridgeService } from './asterisk-bridge.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * DialplanGeneratorService
 * ────────────────────────────────────────────────────────────────────
 * Genera /etc/asterisk/extensions_dynamic.conf desde la BD para conectar:
 *
 *   Provider → Asterisk → [VERIFICAR HORARIO/FESTIVO]
 *                       → si fuera horario: reproduce audio + cuelga
 *                       → si dentro horario:
 *                             ├── DID con destino 'agent' → Dial(PJSIP/<ext>)
 *                             ├── DID con destino 'queue' → Queue(<slug>)
 *                             ├── DID con destino 'ivr'   → Goto(ivr-<id>,s,1)
 *                             └── DID sin destino         → Hangup
 *
 *   IVR contexts (ivr-<id>):
 *      s,1: Background(welcome) + WaitExten
 *      <key>,1: ejecuta opcion (queue/agent/otro IVR/voicemail/hangup)
 *      i,1: Playback(invalid) + retry
 *      t,1: Playback(timeout) + Hangup
 *
 *   Queues: usa app Queue(slug,t,,,maxwait) con queue_log.
 *
 * El archivo estatico extensions.conf hace `#tryinclude` y enruta el
 * primer paso de [from-trunk] hacia este archivo dinamico.
 */
@Injectable()
export class DialplanGeneratorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DialplanGeneratorService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly bridge: AsteriskBridgeService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Al arrancar el backend, esperamos 5s a que MySQL este ready y
   * sincronizamos el dialplan. Garantiza que cualquier cambio en BD
   * desde el ultimo restart quede aplicado en Asterisk.
   */
  async onApplicationBootstrap(): Promise<void> {
    setTimeout(() => {
      this.syncDialplan()
        .then(r => this.logger.log(`Auto-sync dialplan al arrancar: written=${r.written} reloaded=${r.reloaded} bytes=${r.bytes}`))
        .catch(e => this.logger.error(`Auto-sync dialplan fallo: ${e?.message}`));
    }, 5000);
  }

  /** Path al archivo dinamico (mapped al volumen de Asterisk). */
  private dialplanPath(): string {
    return this.config.get<string>('asterisk.extensionsDynamicPath')
      ?? '/etc/asterisk/extensions_dynamic.conf';
  }

  /**
   * Genera y escribe el dialplan dinamico a partir de:
   *   - did_numbers (con inbound_destination_*)
   *   - business_hours (con schedule JSON)
   *   - holidays
   *   - ivr_menus + ivr_options + ivr_audio_files
   *   - queues
   *   - agents
   *
   * Despues hace `dialplan reload` via AMI.
   */
  async syncDialplan(): Promise<{ written: boolean; reloaded: boolean; bytes: number; warnings: string[] }> {
    const warnings: string[] = [];
    const lines: string[] = [];
    const ts = new Date().toISOString();

    lines.push('; ===================================================================');
    lines.push('; extensions_dynamic.conf');
    lines.push('; GENERADO AUTOMATICAMENTE — NO EDITAR A MANO');
    lines.push(`; Generado: ${ts}`);
    lines.push('; Origen: callcenter-backend / DialplanGeneratorService');
    lines.push('; ===================================================================');
    lines.push('');

    // Cargar todas las empresas activas
    const companies: any[] = await this.ds.query(
      `SELECT id, slug, display_name FROM companies WHERE status = 'active' ORDER BY id`,
    );

    // Header del contexto donde van TODAS las extensiones de DIDs (de todas
    // las empresas). El estatico extensions.conf hace Goto(from-trunk-dynamic).
    lines.push('[from-trunk-dynamic]');
    lines.push('; Generado automaticamente — TODAS las empresas comparten este contexto.');
    lines.push('; El routing por empresa es implicito: cada DID es global y el');
    lines.push('; UserEvent emite el company_id correcto.');
    lines.push('');

    for (const company of companies) {
      const cid = Number(company.id);
      lines.push(`; ─── Empresa #${cid} (${company.slug}) ───`);
      lines.push('');

      // DIDs configurados explicitamente en la UI
      let dids: any[] = await this.ds.query(
        `SELECT id, number, description, inbound_destination_type, inbound_destination_id, is_active
           FROM did_numbers WHERE company_id = ? AND is_active = 1`,
        [cid],
      );

      // FALLBACK: si no hay DIDs configurados, generar entradas implicitas
      // a partir del caller_id de cada troncal activa con direction inbound/both.
      // El destino default = primer agente activo. Asi las entrantes funcionan
      // out-of-the-box, sin requerir que el admin configure DIDs manualmente.
      if (dids.length === 0) {
        const trunkCallerIds: any[] = await this.ds.query(
          `SELECT DISTINCT caller_id FROM sip_trunks
             WHERE company_id = ? AND direction IN ('inbound','both')
             AND caller_id IS NOT NULL AND caller_id != ''`,
          [cid],
        );
        const firstAgent = await this.ds.query(
          `SELECT id FROM agents WHERE company_id = ? AND is_active = 1 ORDER BY id LIMIT 1`,
          [cid],
        );
        const fallbackAgentId = firstAgent[0]?.id;
        if (fallbackAgentId) {
          dids = trunkCallerIds.map((t: any) => ({
            number: t.caller_id,
            description: 'auto: troncal entrante → primer agente',
            inbound_destination_type: 'agent',
            inbound_destination_id: fallbackAgentId,
          }));
          // Tambien agregar variantes sin prefijo internacional 57XX...
          const variants: any[] = [];
          for (const d of dids) {
            const noPrefix = String(d.number).replace(/^57/, '');
            if (noPrefix !== d.number && noPrefix.length >= 7) {
              variants.push({ ...d, number: noPrefix, description: 'auto: variante sin prefijo 57' });
            }
          }
          dids.push(...variants);
          if (dids.length > 0) {
            warnings.push(`Empresa ${cid}: sin DIDs en BD, generadas ${dids.length} entradas implicitas → agente ${fallbackAgentId}`);
          }
        }
      }

      // Festivos (solo no-recurrentes y los del año actual o futuros)
      const holidays: any[] = await this.ds.query(
        `SELECT name, holiday_date, is_recurring FROM holidays
           WHERE company_id = ? AND (is_recurring = 1 OR holiday_date >= CURDATE())
           ORDER BY holiday_date`,
        [cid],
      );

      // Horarios (default first)
      const hours: any[] = await this.ds.query(
        `SELECT id, name, schedule, is_default FROM business_hours
           WHERE company_id = ? ORDER BY is_default DESC, id ASC`,
        [cid],
      );

      // IVR menus de la empresa con sus audios
      const ivrs: any[] = await this.ds.query(
        `SELECT m.id, m.slug, m.name, m.timeout_seconds, m.max_attempts,
                m.welcome_audio_id, m.invalid_audio_id, m.timeout_audio_id, m.out_of_hours_audio_id,
                wa.file_path AS welcome_path,
                ia.file_path AS invalid_path,
                ta.file_path AS timeout_path,
                oa.file_path AS out_of_hours_path
           FROM ivr_menus m
           LEFT JOIN ivr_audio_files wa ON wa.id = m.welcome_audio_id
           LEFT JOIN ivr_audio_files ia ON ia.id = m.invalid_audio_id
           LEFT JOIN ivr_audio_files ta ON ta.id = m.timeout_audio_id
           LEFT JOIN ivr_audio_files oa ON oa.id = m.out_of_hours_audio_id
           WHERE m.company_id = ?`,
        [cid],
      );

      const ivrOptions: Map<number, any[]> = new Map();
      for (const ivr of ivrs) {
        const opts: any[] = await this.ds.query(
          `SELECT dtmf_key, destination_type, destination_id, destination_value
             FROM ivr_options WHERE ivr_menu_id = ? AND is_active = 1
             ORDER BY dtmf_key`,
          [ivr.id],
        );
        ivrOptions.set(Number(ivr.id), opts);
      }

      // Queues + agentes asociados (queues_agents)
      const queues: any[] = await this.ds.query(
        `SELECT id, slug, name, strategy, max_wait_seconds, ring_seconds
           FROM queues WHERE company_id = ? AND is_active = 1`,
        [cid],
      );

      // Agentes por extension (para Dial directo)
      const agents: any[] = await this.ds.query(
        `SELECT id, extension, display_name FROM agents
           WHERE company_id = ? AND is_active = 1`,
        [cid],
      );
      const agentByExt = new Map(agents.map(a => [String(a.extension), a]));
      const agentById = new Map(agents.map(a => [Number(a.id), a]));

      // Audio de fuera-de-horario "global" — si el DID destino es un IVR
      // que tiene out_of_hours_audio, lo usamos. Sino, hangup silencioso.
      const fallbackOutOfHoursAudio = ivrs.find(i => i.out_of_hours_path)?.out_of_hours_path;

      // ─── Generar extension por cada DID ───
      for (const did of dids) {
        const num = String(did.number);
        const destType = did.inbound_destination_type;
        const destId = did.inbound_destination_id ? Number(did.inbound_destination_id) : null;

        lines.push(`; DID ${num} — ${did.description ?? ''} → ${destType ?? 'sin destino'}`);
        lines.push(`exten = ${num},1,NoOp(DID ${num} entrante de \${CALLERID(num)})`);
        lines.push(` same = n,Set(CHANNEL(language)=es)`);
        lines.push(` same = n,Set(CALLERID(name)=\${CALLERID(num)})`);
        lines.push(` same = n,Set(CONNECTEDLINE(num)=\${CALLERID(num)})`);
        lines.push(` same = n,Set(CONNECTEDLINE(name)=\${CALLERID(num)})`);
        lines.push(` same = n,Set(__X-Company-Id=${cid})`);
        lines.push(` same = n,UserEvent(CallcenterInbound,Channel:\${UNIQUEID},DID:\${EXTEN},From:\${CALLERID(num)},Company:${cid})`);

        // Verificar festivos primero
        for (const h of holidays) {
          const d = new Date(h.holiday_date);
          const dd = String(d.getUTCDate()).padStart(2, '0');
          const mm = monthShort(d.getUTCMonth() + 1);
          if (h.is_recurring) {
            // Recurrente: mismo dia y mes cualquier año
            lines.push(` same = n,GotoIfTime(*,*,${dd},${mm}?out_of_hours_${num},1)  ; Festivo: ${h.name}`);
          } else {
            // Specifico: solo ese año
            const yyyy = d.getUTCFullYear();
            lines.push(` same = n,GotoIfTime(*,*,${dd},${mm}?out_of_hours_${num},1)  ; Festivo ${yyyy}: ${h.name}`);
          }
        }

        // Verificar horario laboral usando el primer business_hours (default)
        const bh = hours[0];
        if (bh) {
          const sched = parseSchedule(bh.schedule);
          for (const { days, ranges } of sched) {
            for (const r of ranges) {
              lines.push(` same = n,GotoIfTime(${r.from}-${r.to},${days},*,*?in_hours_${num},1)`);
            }
          }
          // Si no matchea ningun rango → fuera de horario
          lines.push(` same = n,Goto(out_of_hours_${num},1)`);
        } else {
          // Sin horario definido → siempre dentro de horario
          lines.push(` same = n,Goto(in_hours_${num},1)`);
        }
        lines.push('');

        // ── DENTRO DE HORARIO ──
        lines.push(`exten = in_hours_${num},1,NoOp(${num} dentro de horario)`);
        switch (destType) {
          case 'agent': {
            const ag = destId ? agentById.get(destId) : null;
            if (ag) {
              lines.push(` same = n,Dial(PJSIP/${ag.extension},30,rtT)`);
              lines.push(` same = n,UserEvent(CallcenterInboundEnd,Channel:\${UNIQUEID},DialStatus:\${DIALSTATUS},Duration:\${ANSWEREDTIME})`);
              lines.push(` same = n,Hangup()`);
            } else {
              warnings.push(`DID ${num}: destino agent_id=${destId} no encontrado`);
              lines.push(` same = n,Hangup()`);
            }
            break;
          }
          case 'queue': {
            const q = destId ? queues.find(qq => Number(qq.id) === destId) : null;
            if (q) {
              const maxWait = q.max_wait_seconds ?? 300;
              lines.push(` same = n,Queue(${q.slug},t,,,${maxWait})`);
              lines.push(` same = n,UserEvent(CallcenterInboundEnd,Channel:\${UNIQUEID},DialStatus:\${QUEUESTATUS},Duration:\${ANSWEREDTIME})`);
              lines.push(` same = n,Hangup()`);
            } else {
              warnings.push(`DID ${num}: queue_id=${destId} no encontrada`);
              lines.push(` same = n,Hangup()`);
            }
            break;
          }
          case 'ivr': {
            const ivr = destId ? ivrs.find(i => Number(i.id) === destId) : null;
            if (ivr) {
              lines.push(` same = n,Goto(ivr-${cid}-${ivr.id},s,1)`);
            } else {
              warnings.push(`DID ${num}: ivr_id=${destId} no encontrado`);
              lines.push(` same = n,Hangup()`);
            }
            break;
          }
          case 'hangup':
            lines.push(` same = n,Hangup()`);
            break;
          case 'voicemail':
            // TODO: buzon
            lines.push(` same = n,NoOp(TODO: voicemail)`);
            lines.push(` same = n,Hangup()`);
            break;
          default: {
            // Sin destino configurado → fallback al primer agente (legacy)
            const firstAgent = agents[0];
            if (firstAgent) {
              warnings.push(`DID ${num}: sin destino configurado, fallback a agente Ext ${firstAgent.extension}`);
              lines.push(` same = n,Dial(PJSIP/${firstAgent.extension},30,rtT)`);
              lines.push(` same = n,UserEvent(CallcenterInboundEnd,Channel:\${UNIQUEID},DialStatus:\${DIALSTATUS},Duration:\${ANSWEREDTIME})`);
              lines.push(` same = n,Hangup()`);
            } else {
              lines.push(` same = n,Hangup()`);
            }
            break;
          }
        }
        lines.push('');

        // ── FUERA DE HORARIO ──
        lines.push(`exten = out_of_hours_${num},1,NoOp(${num} fuera de horario)`);
        // Si el destino es IVR y tiene out_of_hours_audio, usarlo
        let oohAudio: string | null = null;
        if (destType === 'ivr' && destId) {
          const ivr = ivrs.find(i => Number(i.id) === destId);
          oohAudio = ivr?.out_of_hours_path ?? null;
        }
        oohAudio = oohAudio ?? fallbackOutOfHoursAudio ?? null;
        if (oohAudio) {
          const noExt = oohAudio.replace(/\.[^.]+$/, '');
          lines.push(` same = n,Answer()`);
          lines.push(` same = n,Wait(1)`);
          lines.push(` same = n,Playback(${noExt})`);
        }
        lines.push(` same = n,Hangup()`);
        lines.push('');
      }

      // ─── Generar contextos IVR ───
      for (const ivr of ivrs) {
        const ivrId = Number(ivr.id);
        const ctx = `ivr-${cid}-${ivrId}`;
        const opts = ivrOptions.get(ivrId) ?? [];
        const welcomePath = stripExt(ivr.welcome_path);
        const invalidPath = stripExt(ivr.invalid_path);
        const timeoutPath = stripExt(ivr.timeout_path);
        const timeout = ivr.timeout_seconds ?? 5;
        const maxAttempts = ivr.max_attempts ?? 3;

        lines.push(`; IVR "${ivr.name}" (${ivr.slug})`);
        lines.push(`[${ctx}]`);
        lines.push(`exten = s,1,NoOp(IVR ${ivr.slug} — bienvenida)`);
        lines.push(` same = n,Answer()`);
        lines.push(` same = n,Wait(1)`);
        lines.push(` same = n,Set(IVR_ATTEMPTS=0)`);
        lines.push(`exten = s,n(prompt),NoOp(prompt loop intento \${IVR_ATTEMPTS})`);
        if (welcomePath) {
          lines.push(` same = n,Background(${welcomePath})`);
        }
        lines.push(` same = n,WaitExten(${timeout})`);
        lines.push('');

        // Cada opcion DTMF
        for (const opt of opts) {
          const key = opt.dtmf_key;
          const dt = opt.destination_type;
          const did_ = opt.destination_id ? Number(opt.destination_id) : null;
          lines.push(`exten = ${key},1,NoOp(IVR opcion ${key} → ${dt})`);
          switch (dt) {
            case 'queue': {
              const q = did_ ? queues.find(qq => Number(qq.id) === did_) : null;
              if (q) {
                lines.push(` same = n,Queue(${q.slug},t,,,${q.max_wait_seconds ?? 300})`);
              } else {
                warnings.push(`IVR ${ivr.slug} opcion ${key}: queue_id=${did_} no encontrada`);
                lines.push(` same = n,Hangup()`);
              }
              break;
            }
            case 'agent': {
              const ag = did_ ? agentById.get(did_) : null;
              if (ag) {
                lines.push(` same = n,Dial(PJSIP/${ag.extension},30,rtT)`);
                lines.push(` same = n,Hangup()`);
              } else {
                warnings.push(`IVR ${ivr.slug} opcion ${key}: agent_id=${did_} no encontrado`);
                lines.push(` same = n,Hangup()`);
              }
              break;
            }
            case 'ivr': {
              const subIvr = did_ ? ivrs.find(i => Number(i.id) === did_) : null;
              if (subIvr) {
                lines.push(` same = n,Goto(ivr-${cid}-${subIvr.id},s,1)`);
              } else {
                lines.push(` same = n,Hangup()`);
              }
              break;
            }
            case 'external': {
              if (opt.destination_value) {
                lines.push(` same = n,Dial(PJSIP/${opt.destination_value}@\${OUTBOUND_TRUNK},60,rtT)`);
              }
              lines.push(` same = n,Hangup()`);
              break;
            }
            case 'hangup':
            default:
              lines.push(` same = n,Hangup()`);
          }
          lines.push('');
        }

        // Opcion invalida
        lines.push(`exten = i,1,NoOp(opcion invalida)`);
        if (invalidPath) lines.push(` same = n,Playback(${invalidPath})`);
        lines.push(` same = n,Set(IVR_ATTEMPTS=$[\${IVR_ATTEMPTS} + 1])`);
        lines.push(` same = n,GotoIf($[\${IVR_ATTEMPTS} >= ${maxAttempts}]?hangup,1:s,prompt)`);
        lines.push('');

        // Timeout
        lines.push(`exten = t,1,NoOp(timeout)`);
        if (timeoutPath) lines.push(` same = n,Playback(${timeoutPath})`);
        lines.push(` same = n,Set(IVR_ATTEMPTS=$[\${IVR_ATTEMPTS} + 1])`);
        lines.push(` same = n,GotoIf($[\${IVR_ATTEMPTS} >= ${maxAttempts}]?hangup,1:s,prompt)`);
        lines.push('');

        lines.push(`exten = hangup,1,Hangup()`);
        lines.push('');
      }

      lines.push('');
    }

    // ─── Wildcard fallback: DID sin routing ───
    lines.push('; ─── Fallback ─── DIDs no configurados → cuelga');
    lines.push('[from-trunk-fallback]');
    lines.push('exten = _X.,1,NoOp(DID sin routing en BD: ${EXTEN})');
    lines.push(' same = n,Hangup()');
    lines.push('');

    const content = lines.join('\n');
    const filePath = this.dialplanPath();
    let writeOk = false;
    let bytes = 0;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, { mode: 0o644 });
      bytes = Buffer.byteLength(content);
      writeOk = true;
      this.logger.log(`Dialplan dinamico escrito (${bytes} bytes) en ${filePath}`);
    } catch (e: any) {
      this.logger.error(`Error escribiendo ${filePath}: ${e?.message}`);
      warnings.push(`No se pudo escribir el archivo: ${e?.message}`);
    }

    let reloaded = false;
    try {
      // Asterisk reload del dialplan via AMI
      reloaded = (await this.bridge.amiCommand('dialplan reload')).success;
      if (!reloaded) warnings.push('dialplan reload fallo. Recarga manual: docker exec cc-asterisk asterisk -rx "dialplan reload"');
    } catch (e: any) {
      warnings.push(`dialplan reload error: ${e?.message}`);
    }

    return { written: writeOk, reloaded, bytes, warnings };
  }
}

// ─── Helpers ───

function monthShort(m: number): string {
  const names = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  return names[m - 1] ?? 'jan';
}

function stripExt(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  return filePath.replace(/\.[^.]+$/, '');
}

interface ParsedRange { from: string; to: string }
interface ParsedDay { days: string; ranges: ParsedRange[] }

/**
 * Convierte el JSON schedule (formato { mon: [{from,to}], tue: [...] }) en
 * grupos para GotoIfTime de Asterisk: { days: 'mon-fri', ranges: [...] }.
 *
 * Si todos los dias laborales (mon-fri) tienen el MISMO horario, los
 * agrupa como 'mon-fri' para generar menos lineas de dialplan.
 */
function parseSchedule(scheduleJson: any): ParsedDay[] {
  let s: any = scheduleJson;
  if (typeof s === 'string') {
    try { s = JSON.parse(s); } catch { return []; }
  }
  const dayMap: Record<string, string> = {
    mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat', sun: 'sun',
  };
  const result: ParsedDay[] = [];
  for (const dayKey of Object.keys(s)) {
    const ranges: any[] = s[dayKey] ?? [];
    if (!ranges.length) continue;
    const dayName = dayMap[dayKey] ?? dayKey.slice(0, 3).toLowerCase();
    result.push({ days: dayName, ranges: ranges.map(r => ({ from: r.from, to: r.to })) });
  }
  return result;
}
