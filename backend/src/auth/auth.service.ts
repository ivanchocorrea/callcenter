import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';

import { User } from '../users/entities/user.entity';
import { UserRefreshToken } from './entities/user-refresh-token.entity';
import { EncryptionService } from '../common/encryption/encryption.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserRefreshToken) private readonly tokenRepo: Repository<UserRefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
    private readonly ds: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSuperAdmin();
  }

  /** Crea el super_admin desde .env si aún no existe ningún usuario en la BD. */
  private async ensureSuperAdmin(): Promise<void> {
    const count = await this.userRepo.count();
    if (count > 0) return;

    const email = this.config.get<string>('app.bootstrap.email')!;
    const password = this.config.get<string>('app.bootstrap.password')!;
    const fullName = this.config.get<string>('app.bootstrap.name')!;

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await this.ds.query(
      `INSERT INTO users (company_id, email, password_hash, full_name, status, email_verified_at)
       VALUES (NULL, ?, ?, ?, 'active', NOW())`,
      [email, passwordHash, fullName],
    );
    const userId = result?.insertId ?? result?.[0]?.insertId;
    await this.ds.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT ?, id FROM roles WHERE slug='super_admin' AND company_id IS NULL`,
      [userId],
    );
    this.logger.log(`Super admin bootstrap creado: ${email}`);
  }

  async validateUserCredentials(dto: LoginDto, ip?: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Cuenta bloqueada temporalmente. Intenta más tarde.');
    }
    if (user.status !== 'active') {
      throw new ForbiddenException('Cuenta no activa');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      user.failedLoginCount += 1;
      if (user.failedLoginCount >= MAX_FAILED) {
        user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
        user.failedLoginCount = 0;
      }
      await this.userRepo.save(user);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.twoFactorEnabled) {
      if (!dto.totp_code) throw new UnauthorizedException('Código 2FA requerido');
      const secret = user.twoFactorSecretEncrypted
        ? this.encryption.decrypt(user.twoFactorSecretEncrypted)
        : null;
      if (!secret || !authenticator.check(dto.totp_code, secret)) {
        throw new UnauthorizedException('Código 2FA inválido');
      }
    }

    user.failedLoginCount = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    user.lastLoginIp = ip ?? null;
    await this.userRepo.save(user);
    return user;
  }

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
    const user = await this.validateUserCredentials(dto, meta.ip);
    const { roles, permissions } = await this.loadAuthorization(user.id);

    const payload: JwtPayload = {
      sub: Number(user.id),
      email: user.email,
      companyId: user.companyId ? Number(user.companyId) : null,
      roles,
      permissions,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    });

    const refreshToken = this.encryption.generateRandomToken(48);
    const refreshHash = this.encryption.hashToken(refreshToken);
    const expiresAt = this.parseExpirationToDate(this.config.get<string>('jwt.refreshExpiresIn') ?? '7d');

    await this.tokenRepo.save(
      this.tokenRepo.create({
        userId: Number(user.id),
        tokenHash: refreshHash,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ip ?? null,
        expiresAt,
      }),
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.parseExpirationToSeconds(this.config.get<string>('jwt.accessExpiresIn') ?? '15m'),
      user: {
        id: Number(user.id),
        email: user.email,
        full_name: user.fullName,
        company_id: user.companyId ? Number(user.companyId) : null,
        roles,
        permissions,
      },
    };
  }

  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
    const hash = this.encryption.hashToken(refreshToken);
    const stored = await this.tokenRepo.findOne({
      where: { tokenHash: hash, expiresAt: MoreThan(new Date()) },
    });
    if (!stored || stored.revokedAt) throw new UnauthorizedException('Refresh token inválido');

    const user = await this.userRepo.findOne({ where: { id: stored.userId } });
    if (!user || user.status !== 'active') throw new UnauthorizedException('Usuario no válido');

    // rotación
    stored.revokedAt = new Date();

    const newToken = this.encryption.generateRandomToken(48);
    const newHash = this.encryption.hashToken(newToken);
    const expiresAt = this.parseExpirationToDate(this.config.get<string>('jwt.refreshExpiresIn') ?? '7d');
    const newRow = await this.tokenRepo.save(
      this.tokenRepo.create({
        userId: Number(user.id),
        tokenHash: newHash,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ip ?? null,
        expiresAt,
      }),
    );
    stored.replacedBy = Number(newRow.id);
    await this.tokenRepo.save(stored);

    const { roles, permissions } = await this.loadAuthorization(user.id);
    const payload: JwtPayload = {
      sub: Number(user.id),
      email: user.email,
      companyId: user.companyId ? Number(user.companyId) : null,
      roles,
      permissions,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    });
    return { access_token: accessToken, refresh_token: newToken, token_type: 'Bearer' };
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.encryption.hashToken(refreshToken);
    await this.tokenRepo.update({ tokenHash: hash }, { revokedAt: new Date() });
  }

  async loadAuthorization(userId: number): Promise<{ roles: string[]; permissions: string[] }> {
    const rolesRows = await this.ds.query(
      `SELECT r.slug FROM user_roles ur INNER JOIN roles r ON ur.role_id=r.id WHERE ur.user_id=?`,
      [userId],
    );
    const roles = rolesRows.map((r: any) => r.slug as string);

    let permissions: string[] = [];
    if (roles.length) {
      const permRows = await this.ds.query(
        `SELECT DISTINCT p.slug FROM user_roles ur
           INNER JOIN role_permissions rp ON rp.role_id = ur.role_id
           INNER JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = ?`,
        [userId],
      );
      permissions = permRows.map((p: any) => p.slug as string);
    }
    return { roles, permissions };
  }

  // ---------- helpers ----------
  private parseExpirationToSeconds(s: string): number {
    const m = /^(\d+)([smhd])$/.exec(s);
    if (!m) return 900;
    const n = parseInt(m[1], 10);
    const unit = m[2];
    return unit === 's' ? n : unit === 'm' ? n * 60 : unit === 'h' ? n * 3600 : n * 86400;
  }
  private parseExpirationToDate(s: string): Date {
    return new Date(Date.now() + this.parseExpirationToSeconds(s) * 1000);
  }
}
