import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Agent } from './entities/agent.entity';
import { CreateAgentDto, UpdateAgentDto } from './dto/create-agent.dto';
import { EncryptionService } from '../common/encryption/encryption.service';

const VALID_STATUSES = ['available', 'busy', 'paused', 'lunch', 'training', 'offline'] as const;
export type AgentStatus = typeof VALID_STATUSES[number];

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent) private readonly repo: Repository<Agent>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly encryption: EncryptionService,
  ) {}

  list(companyId: number): Promise<Agent[]> {
    return this.repo.find({ where: { companyId }, order: { extension: 'ASC' } });
  }

  async findById(id: number, companyId: number): Promise<Agent> {
    const a = await this.repo.findOne({ where: { id, companyId } });
    if (!a) throw new NotFoundException(`Agente ${id} no encontrado`);
    return a;
  }

  async create(companyId: number, dto: CreateAgentDto): Promise<Agent> {
    const exists = await this.repo.findOne({
      where: { companyId, extension: dto.extension },
    });
    if (exists) throw new ConflictException(`Extensión ${dto.extension} ya existe`);

    const userExists = await this.repo.findOne({ where: { userId: dto.user_id } });
    if (userExists) throw new ConflictException(`El usuario ya tiene un agente asociado`);

    const a = this.repo.create({
      companyId,
      userId: dto.user_id,
      extension: dto.extension,
      sipSecretEncrypted: this.encryption.encrypt(dto.sip_secret),
      displayName: dto.display_name,
      department: dto.department ?? null,
      skillLevel: dto.skill_level ?? 1,
      canBeRecorded: dto.can_be_recorded ?? true,
      autoAnswer: dto.auto_answer ?? false,
      isActive: true,
    });
    return this.repo.save(a);
  }

  async update(id: number, companyId: number, dto: UpdateAgentDto): Promise<Agent> {
    const a = await this.findById(id, companyId);
    if (dto.extension !== undefined && dto.extension !== a.extension) {
      const dup = await this.repo.findOne({ where: { companyId, extension: dto.extension } });
      if (dup && Number(dup.id) !== Number(a.id)) {
        throw new ConflictException(`Extensión ${dto.extension} ya existe`);
      }
      a.extension = dto.extension;
    }
    if (dto.display_name !== undefined) a.displayName = dto.display_name;
    if (dto.department !== undefined) a.department = dto.department ?? null;
    if (dto.skill_level !== undefined) a.skillLevel = dto.skill_level;
    if (dto.can_be_recorded !== undefined) a.canBeRecorded = dto.can_be_recorded;
    if (dto.auto_answer !== undefined) a.autoAnswer = dto.auto_answer;
    if (dto.is_active !== undefined) a.isActive = dto.is_active;
    return this.repo.save(a);
  }

  async remove(id: number, companyId: number): Promise<void> {
    const a = await this.findById(id, companyId);
    await this.repo.remove(a);
  }

  async regenerateSecret(id: number, companyId: number): Promise<{ sip_secret: string }> {
    const a = await this.findById(id, companyId);
    const newSecret = this.generateRandomSecret(24);
    a.sipSecretEncrypted = this.encryption.encrypt(newSecret);
    await this.repo.save(a);
    return { sip_secret: newSecret };
  }

  private generateRandomSecret(length = 24): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  /** Devuelve el secret en plano para usarlo al generar la config PJSIP. NUNCA exponer al cliente. */
  decryptSipSecret(agent: Agent): string {
    return this.encryption.decrypt(agent.sipSecretEncrypted);
  }

  // ============= STATUS DEL AGENTE (dropdown del dialer) =============

  /** Encuentra el agente del usuario actual (1 user → 1 agente). */
  async findByUserId(userId: number, companyId: number): Promise<Agent | null> {
    return this.repo.findOne({ where: { userId, companyId } });
  }

  async getMyStatus(userId: number, companyId: number): Promise<{ status: AgentStatus; changed_at: Date | null }> {
    const a = await this.findByUserId(userId, companyId);
    if (!a) throw new NotFoundException('No tienes un agente asociado');
    return {
      status: ((a.currentStatus as AgentStatus) ?? 'offline'),
      changed_at: a.currentStatusChangedAt,
    };
  }

  async setMyStatus(userId: number, companyId: number, status: string): Promise<{ status: AgentStatus; changed_at: Date }> {
    if (!VALID_STATUSES.includes(status as AgentStatus)) {
      throw new BadRequestException(`Estado inválido. Debe ser uno de: ${VALID_STATUSES.join(', ')}`);
    }
    const a = await this.findByUserId(userId, companyId);
    if (!a) throw new NotFoundException('No tienes un agente asociado');
    a.currentStatus = status;
    a.currentStatusChangedAt = new Date();
    await this.repo.save(a);
    // Log histórico (no crashea si falla)
    try {
      await this.ds.query(
        `INSERT INTO agent_status_log (agent_id, company_id, status) VALUES (?, ?, ?)`,
        [a.id, companyId, status],
      );
    } catch { /* ignore */ }
    return { status: status as AgentStatus, changed_at: a.currentStatusChangedAt };
  }

  // ============= REPORTES DEL AGENTE =============

  /**
   * Estadísticas para el panel de Reportes (renombrado de "Mi escritorio").
   * Cuenta llamadas entrantes, salientes, perdidas y duración promedio
   * en un rango de fechas.
   */
  async myReport(userId: number, companyId: number, fromIso: string, toIso: string) {
    const a = await this.findByUserId(userId, companyId);
    if (!a) throw new NotFoundException('No tienes un agente asociado');

    const params = [a.id, companyId, fromIso, toIso];

    // Totales por dirección/status
    const totals = await this.ds.query(
      `SELECT
         SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) AS outbound,
         SUM(CASE WHEN direction = 'inbound' AND status NOT IN ('missed','failed','no_answer','rejected','abandoned') THEN 1 ELSE 0 END) AS inbound,
         SUM(CASE WHEN direction = 'inbound' AND status IN ('missed','failed','no_answer','rejected','abandoned') THEN 1 ELSE 0 END) AS missed,
         AVG(CASE WHEN direction = 'inbound' AND duration_seconds > 0 THEN duration_seconds END) AS avg_inbound_duration,
         AVG(CASE WHEN direction = 'outbound' AND duration_seconds > 0 THEN duration_seconds END) AS avg_outbound_duration,
         COUNT(*) AS total
       FROM calls
       WHERE agent_id = ? AND company_id = ?
         AND started_at BETWEEN ? AND ?`,
      params,
    );

    // Series para gráficas (agrupadas por hora si rango ≤ 1 día, por día si más)
    const rangeMs = new Date(toIso).getTime() - new Date(fromIso).getTime();
    const byHour = rangeMs <= 36 * 3600 * 1000;  // ≤ 36 horas → por hora
    const series = await this.ds.query(
      byHour
        ? `SELECT DATE_FORMAT(started_at, '%Y-%m-%d %H:00:00') AS bucket,
                  SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) AS outbound,
                  SUM(CASE WHEN direction = 'inbound' AND status NOT IN ('missed','failed','no_answer','rejected','abandoned') THEN 1 ELSE 0 END) AS inbound,
                  SUM(CASE WHEN direction = 'inbound' AND status IN ('missed','failed','no_answer','rejected','abandoned') THEN 1 ELSE 0 END) AS missed
           FROM calls WHERE agent_id = ? AND company_id = ? AND started_at BETWEEN ? AND ?
           GROUP BY bucket ORDER BY bucket`
        : `SELECT DATE(started_at) AS bucket,
                  SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) AS outbound,
                  SUM(CASE WHEN direction = 'inbound' AND status NOT IN ('missed','failed','no_answer','rejected','abandoned') THEN 1 ELSE 0 END) AS inbound,
                  SUM(CASE WHEN direction = 'inbound' AND status IN ('missed','failed','no_answer','rejected','abandoned') THEN 1 ELSE 0 END) AS missed
           FROM calls WHERE agent_id = ? AND company_id = ? AND started_at BETWEEN ? AND ?
           GROUP BY bucket ORDER BY bucket`,
      params,
    );

    const t = totals[0] ?? {};
    return {
      from: fromIso,
      to: toIso,
      bucket: byHour ? 'hour' : 'day',
      totals: {
        outbound: Number(t.outbound ?? 0),
        inbound: Number(t.inbound ?? 0),
        missed: Number(t.missed ?? 0),
        total: Number(t.total ?? 0),
        avg_inbound_duration_seconds: t.avg_inbound_duration ? Math.round(Number(t.avg_inbound_duration)) : 0,
        avg_outbound_duration_seconds: t.avg_outbound_duration ? Math.round(Number(t.avg_outbound_duration)) : 0,
      },
      series: series.map((r: any) => ({
        bucket: r.bucket,
        outbound: Number(r.outbound),
        inbound: Number(r.inbound),
        missed: Number(r.missed),
      })),
    };
  }
}
