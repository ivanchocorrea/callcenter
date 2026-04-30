import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@nodoe.test' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMeNow!2026', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ required: false, description: 'Código TOTP si el usuario tiene 2FA activado' })
  @IsOptional()
  @IsString()
  totp_code?: string;

  @ApiProperty({ required: false, description: 'companyId opcional para super_admin con multi-empresa' })
  @IsOptional()
  companyId?: number;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refresh_token!: string;
}
