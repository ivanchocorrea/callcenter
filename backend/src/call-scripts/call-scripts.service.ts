import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallScript } from './entities/call-script.entity';
import { CreateCallScriptDto, UpdateCallScriptDto } from './dto/call-script.dto';

export interface CallScriptPublic {
  id: number;
  name: string;
  content: string;
  script_type: 'outbound' | 'inbound' | 'both';
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class CallScriptsService {
  constructor(
    @InjectRepository(CallScript) private readonly repo: Repository<CallScript>,
  ) {}

  async listAll(companyId: number): Promise<CallScriptPublic[]> {
    const rows = await this.repo.find({
      where: { companyId },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return rows.map(this.toPublic);
  }

  async listActive(companyId: number, type?: 'outbound' | 'inbound'): Promise<CallScriptPublic[]> {
    const qb = this.repo.createQueryBuilder('s')
      .where('s.company_id = :companyId', { companyId })
      .andWhere('s.is_active = 1');
    if (type) {
      qb.andWhere('s.script_type IN (:...types)', { types: [type, 'both'] });
    }
    qb.orderBy('s.sort_order', 'ASC').addOrderBy('s.id', 'ASC');
    const rows = await qb.getMany();
    return rows.map(this.toPublic);
  }

  async create(companyId: number, dto: CreateCallScriptDto): Promise<CallScriptPublic> {
    const s = this.repo.create({
      companyId,
      name: dto.name,
      content: dto.content,
      sortOrder: dto.sort_order ?? 100,
      isActive: dto.is_active ?? true,
    });
    return this.toPublic(await this.repo.save(s));
  }

  async update(id: number, companyId: number, dto: UpdateCallScriptDto): Promise<CallScriptPublic> {
    const s = await this.repo.findOne({ where: { id, companyId } });
    if (!s) throw new NotFoundException('Guion no encontrado');
    if (dto.name !== undefined) s.name = dto.name;
    if (dto.content !== undefined) s.content = dto.content;
    if (dto.sort_order !== undefined) s.sortOrder = dto.sort_order;
    if (dto.is_active !== undefined) s.isActive = dto.is_active;
    return this.toPublic(await this.repo.save(s));
  }

  async remove(id: number, companyId: number): Promise<void> {
    const s = await this.repo.findOne({ where: { id, companyId } });
    if (!s) throw new NotFoundException('Guion no encontrado');
    await this.repo.remove(s);
  }

  private toPublic(s: CallScript): CallScriptPublic {
    return {
      id: Number(s.id),
      name: s.name,
      content: s.content,
      sort_order: s.sortOrder,
      is_active: s.isActive,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    };
  }
}
