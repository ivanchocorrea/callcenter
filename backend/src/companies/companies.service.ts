import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company) private readonly repo: Repository<Company>,
  ) {}

  async list(): Promise<Company[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: number): Promise<Company> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Empresa ${id} no encontrada`);
    return c;
  }

  async findBySlug(slug: string): Promise<Company | null> {
    return this.repo.findOne({ where: { slug } });
  }

  async create(dto: CreateCompanyDto): Promise<Company> {
    const exists = await this.findBySlug(dto.slug);
    if (exists) throw new ConflictException(`slug "${dto.slug}" ya existe`);
    const c = this.repo.create({
      slug: dto.slug,
      legalName: dto.legal_name,
      displayName: dto.display_name,
      taxId: dto.tax_id ?? null,
      country: dto.country ?? null,
      timezone: dto.timezone ?? 'America/Bogota',
      defaultLocale: dto.default_locale ?? 'es-CO',
      primaryEmail: dto.primary_email ?? null,
      primaryPhone: dto.primary_phone ?? null,
      status: 'trialing',
    });
    return this.repo.save(c);
  }

  async update(id: number, dto: UpdateCompanyDto): Promise<Company> {
    const c = await this.findById(id);
    Object.assign(c, {
      slug: dto.slug ?? c.slug,
      legalName: dto.legal_name ?? c.legalName,
      displayName: dto.display_name ?? c.displayName,
      taxId: dto.tax_id ?? c.taxId,
      country: dto.country ?? c.country,
      timezone: dto.timezone ?? c.timezone,
      defaultLocale: dto.default_locale ?? c.defaultLocale,
      primaryEmail: dto.primary_email ?? c.primaryEmail,
      primaryPhone: dto.primary_phone ?? c.primaryPhone,
    });
    return this.repo.save(c);
  }

  async suspend(id: number, reason: string): Promise<Company> {
    const c = await this.findById(id);
    c.status = 'suspended';
    c.suspendedReason = reason;
    return this.repo.save(c);
  }

  async activate(id: number): Promise<Company> {
    const c = await this.findById(id);
    c.status = 'active';
    c.suspendedReason = null;
    return this.repo.save(c);
  }

  /** Settings de UI del agente para la empresa. */
  async getAgentSettings(companyId: number): Promise<{ allow_agent_reject_inbound: boolean }> {
    const c = await this.findById(companyId);
    return { allow_agent_reject_inbound: c.allowAgentRejectInbound ?? true };
  }

  async updateAgentSettings(
    companyId: number,
    dto: { allow_agent_reject_inbound?: boolean },
  ): Promise<{ allow_agent_reject_inbound: boolean }> {
    const c = await this.findById(companyId);
    if (dto.allow_agent_reject_inbound !== undefined) {
      c.allowAgentRejectInbound = dto.allow_agent_reject_inbound;
    }
    await this.repo.save(c);
    return { allow_agent_reject_inbound: c.allowAgentRejectInbound };
  }
}
