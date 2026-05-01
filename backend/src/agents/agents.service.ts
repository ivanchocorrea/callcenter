import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from './entities/agent.entity';
import { CreateAgentDto, UpdateAgentDto } from './dto/create-agent.dto';
import { EncryptionService } from '../common/encryption/encryption.service';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent) private readonly repo: Repository<Agent>,
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
}
