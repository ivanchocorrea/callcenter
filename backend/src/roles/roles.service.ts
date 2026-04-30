import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(@InjectRepository(Role) private readonly repo: Repository<Role>) {}

  list(companyId: number | null): Promise<Role[]> {
    if (companyId == null) return this.repo.find({ where: { companyId: IsNull() } });
    return this.repo.find({ where: [{ companyId }, { companyId: IsNull() }] });
  }

  async findBySlug(slug: string, companyId: number | null): Promise<Role> {
    const role = await this.repo.findOne({
      where: companyId ? [{ slug, companyId }, { slug, companyId: IsNull() }] : { slug, companyId: IsNull() },
    });
    if (!role) throw new NotFoundException(`Rol ${slug} no encontrado`);
    return role;
  }
}
