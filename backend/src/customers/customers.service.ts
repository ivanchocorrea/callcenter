import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto, UpdateCustomerDto, CreateNoteDto } from './dto/customer.dto';

export interface CustomerListResult {
  items: Customer[];
  total: number;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  async list(
    companyId: number,
    options: { search?: string; status?: string; vipOnly?: boolean; limit?: number; offset?: number } = {},
  ): Promise<CustomerListResult> {
    const limit = Math.min(options.limit ?? 50, 200);
    const offset = options.offset ?? 0;
    const qb = this.repo.createQueryBuilder('c').where('c.company_id = :companyId', { companyId });
    if (options.status) qb.andWhere('c.status = :status', { status: options.status });
    if (options.vipOnly) qb.andWhere('c.is_vip = true');
    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      qb.andWhere(
        new Brackets(b => {
          b.where('c.full_name LIKE :term', { term })
            .orWhere('c.primary_phone LIKE :term', { term })
            .orWhere('c.document_number LIKE :term', { term })
            .orWhere('c.email LIKE :term', { term })
            .orWhere('c.company_name LIKE :term', { term });
        }),
      );
    }
    qb.orderBy('c.last_interaction_at', 'DESC').addOrderBy('c.created_at', 'DESC').skip(offset).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findById(id: number, companyId: number): Promise<Customer> {
    const c = await this.repo.findOne({ where: { id, companyId } });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }

  async findByPhone(companyId: number, phone: string): Promise<Customer | null> {
    const norm = phone.replace(/\s+/g, '');
    const r = await this.repo.findOne({ where: { companyId, primaryPhone: norm } });
    if (r) return r;
    const rows = await this.ds.query(
      `SELECT c.* FROM customers c
         INNER JOIN customer_phones p ON p.customer_id = c.id
         WHERE c.company_id = ? AND p.phone = ? LIMIT 1`,
      [companyId, norm],
    );
    if (!rows[0]) return null;
    return this.repo.findOne({ where: { id: rows[0].id, companyId } });
  }

  async create(companyId: number, dto: CreateCustomerDto, userId?: number): Promise<Customer> {
    const phone = dto.primary_phone?.replace(/\s+/g, '') ?? null;
    if (phone) {
      const dup = await this.repo.findOne({ where: { companyId, primaryPhone: phone } });
      if (dup) throw new ConflictException('Ya existe un cliente con ese teléfono');
    }
    const c = this.repo.create({
      companyId,
      fullName: dto.full_name,
      documentType: dto.document_type ?? null,
      documentNumber: dto.document_number ?? null,
      primaryPhone: phone,
      email: dto.email ?? null,
      companyName: dto.company_name ?? null,
      address: dto.address ?? null,
      city: dto.city ?? null,
      state: dto.state ?? null,
      country: dto.country ?? null,
      timezone: dto.timezone ?? null,
      locale: dto.locale ?? null,
      status: dto.status ?? 'active',
      isVip: dto.is_vip ?? false,
      importantNotes: dto.important_notes ?? null,
      customFields: dto.custom_fields ?? null,
      source: 'manual',
    });
    const saved = await this.repo.save(c);
    if (phone) {
      await this.ds.query(
        `INSERT IGNORE INTO customer_phones (company_id, customer_id, phone, label, is_primary)
         VALUES (?, ?, ?, 'mobile', TRUE)`,
        [companyId, saved.id, phone],
      );
    }
    return saved;
  }

  async update(id: number, companyId: number, dto: UpdateCustomerDto): Promise<Customer> {
    const c = await this.findById(id, companyId);
    if (dto.full_name !== undefined) c.fullName = dto.full_name;
    if (dto.document_type !== undefined) c.documentType = dto.document_type;
    if (dto.document_number !== undefined) c.documentNumber = dto.document_number;
    if (dto.primary_phone !== undefined) c.primaryPhone = dto.primary_phone?.replace(/\s+/g, '') ?? null;
    if (dto.email !== undefined) c.email = dto.email ?? null;
    if (dto.company_name !== undefined) c.companyName = dto.company_name ?? null;
    if (dto.address !== undefined) c.address = dto.address ?? null;
    if (dto.city !== undefined) c.city = dto.city ?? null;
    if (dto.state !== undefined) c.state = dto.state ?? null;
    if (dto.country !== undefined) c.country = dto.country ?? null;
    if (dto.timezone !== undefined) c.timezone = dto.timezone ?? null;
    if (dto.locale !== undefined) c.locale = dto.locale ?? null;
    if (dto.status !== undefined) c.status = dto.status;
    if (dto.is_vip !== undefined) c.isVip = dto.is_vip;
    if (dto.important_notes !== undefined) c.importantNotes = dto.important_notes ?? null;
    if (dto.custom_fields !== undefined) c.customFields = dto.custom_fields ?? null;
    return this.repo.save(c);
  }

  async remove(id: number, companyId: number): Promise<void> {
    const c = await this.findById(id, companyId);
    await this.repo.softRemove(c);
  }

  // ---------------------------------------------- notes
  async listNotes(customerId: number, companyId: number): Promise<unknown[]> {
    return this.ds.query(
      `SELECT id, note_type, content, is_pinned, user_id, created_at
         FROM customer_notes WHERE company_id = ? AND customer_id = ?
         ORDER BY is_pinned DESC, created_at DESC LIMIT 200`,
      [companyId, customerId],
    );
  }

  async addNote(customerId: number, companyId: number, userId: number, dto: CreateNoteDto): Promise<{ id: number }> {
    await this.findById(customerId, companyId);
    const r: any = await this.ds.query(
      `INSERT INTO customer_notes (company_id, customer_id, user_id, note_type, content, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [companyId, customerId, userId, dto.note_type ?? 'general', dto.content, dto.is_pinned ?? false],
    );
    return { id: r?.insertId ?? r?.[0]?.insertId };
  }

  // ---------------------------------------------- timeline
  async timeline(customerId: number, companyId: number): Promise<unknown[]> {
    return this.ds.query(
      `SELECT id, interaction_type, direction, related_id, summary, occurred_at
         FROM customer_interactions
         WHERE company_id = ? AND customer_id = ?
         ORDER BY occurred_at DESC LIMIT 200`,
      [companyId, customerId],
    );
  }
}
