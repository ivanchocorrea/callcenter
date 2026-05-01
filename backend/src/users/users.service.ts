import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  async list(companyId: number | null): Promise<User[]> {
    if (companyId == null) return this.repo.find();
    return this.repo.find({ where: { companyId }, order: { createdAt: 'DESC' } });
  }

  /** Lista TODOS los usuarios con info de empresa + roles (para super_admin global view). */
  async listAll(): Promise<unknown[]> {
    return this.ds.query(`
      SELECT
        u.id, u.email, u.full_name AS fullName, u.status, u.created_at AS createdAt,
        u.company_id AS companyId, c.display_name AS companyName, c.slug AS companySlug,
        GROUP_CONCAT(DISTINCT r.slug) AS roles
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT 500
    `);
  }

  async findById(id: number): Promise<User & { roles?: string[] }> {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException(`Usuario ${id} no encontrado`);
    const roles = await this.listRoles(Number(u.id));
    return Object.assign(u, { roles });
  }

  async create(dto: CreateUserDto, currentCompanyId: number | null): Promise<User> {
    const targetCompanyId = dto.company_id ?? currentCompanyId;

    const existing = await this.repo.findOne({
      where: { email: dto.email, companyId: targetCompanyId ?? undefined },
    });
    if (existing) throw new ConflictException(`Email ya registrado en esta empresa`);

    const hash = await bcrypt.hash(dto.password, 12);
    const user = this.repo.create({
      email: dto.email,
      passwordHash: hash,
      fullName: dto.full_name,
      companyId: targetCompanyId ?? null,
      phone: dto.phone ?? null,
      timezone: dto.timezone ?? null,
      locale: dto.locale ?? null,
      status: 'active',
    });
    const saved = await this.repo.save(user);

    if (dto.role_slugs?.length) {
      await this.assignRoles(Number(saved.id), dto.role_slugs, targetCompanyId);
    }
    return saved;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const u = await this.findById(id);
    if (dto.full_name) u.fullName = dto.full_name;
    if (dto.phone !== undefined) u.phone = dto.phone;
    if (dto.status) u.status = dto.status;
    const saved = await this.repo.save(u);
    if (dto.role_slugs) {
      await this.replaceRoles(Number(saved.id), dto.role_slugs, saved.companyId ? Number(saved.companyId) : null);
    }
    return saved;
  }

  async setPassword(id: number, newPassword: string): Promise<void> {
    if (newPassword.length < 10) throw new BadRequestException('Password mínimo 10 chars');
    const u = await this.findById(id);
    u.passwordHash = await bcrypt.hash(newPassword, 12);
    u.failedLoginCount = 0;
    u.lockedUntil = null;
    await this.repo.save(u);
  }

  // ---------- roles ----------
  async assignRoles(userId: number, roleSlugs: string[], companyId: number | null): Promise<void> {
    const placeholders = roleSlugs.map(() => '?').join(',');
    const roles = await this.ds.query(
      `SELECT id, slug FROM roles WHERE slug IN (${placeholders}) AND (company_id IS NULL OR company_id = ?)`,
      [...roleSlugs, companyId],
    );
    if (!roles.length) return;
    for (const r of roles) {
      await this.ds.query(
        `INSERT IGNORE INTO user_roles (user_id, role_id, company_id) VALUES (?, ?, ?)`,
        [userId, r.id, companyId],
      );
    }
  }

  async replaceRoles(userId: number, roleSlugs: string[], companyId: number | null): Promise<void> {
    await this.ds.query(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    if (roleSlugs.length) await this.assignRoles(userId, roleSlugs, companyId);
  }

  async listRoles(userId: number): Promise<string[]> {
    const rows = await this.ds.query(
      `SELECT r.slug FROM user_roles ur INNER JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?`,
      [userId],
    );
    return rows.map((r: any) => r.slug as string);
  }
}
