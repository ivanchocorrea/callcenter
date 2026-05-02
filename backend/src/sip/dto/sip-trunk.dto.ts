import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateSipTrunkDto {
  @ApiProperty({ example: 'didww-bogota' })
  @IsString()
  @Length(2, 150)
  name!: string;

  @ApiProperty({ example: 'sip.didww.com' })
  @IsString()
  host!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  proxy?: string;

  @ApiProperty({ required: false, default: 5060 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiProperty({ example: '550012345' })
  @IsString()
  username!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  auth_username?: string;

  @ApiProperty({ description: 'Se cifrará en BD' })
  @IsString()
  password!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({ required: false, example: '+5713000000' })
  @IsOptional()
  @IsString()
  caller_id?: string;

  @ApiProperty({ required: false, enum: ['udp', 'tcp', 'tls'], default: 'udp' })
  @IsOptional()
  @IsEnum(['udp', 'tcp', 'tls'])
  transport?: 'udp' | 'tcp' | 'tls';

  @ApiProperty({ required: false, isArray: true, example: ['opus', 'ulaw', 'alaw'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  codecs?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  nat_enabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  ice_enabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  rewrite_contact?: boolean;

  @ApiProperty({ required: false, default: 300 })
  @IsOptional()
  @IsInt()
  register_interval?: number;

  @ApiProperty({ required: false, default: 15 })
  @IsOptional()
  @IsInt()
  keep_alive_interval?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  encrypted_communication?: boolean;

  @ApiProperty({ required: false, enum: ['disabled', 'optional', 'required'] })
  @IsOptional()
  @IsEnum(['disabled', 'optional', 'required'])
  srtp_mode?: 'disabled' | 'optional' | 'required';

  @ApiProperty({ required: false, enum: ['inbound', 'outbound', 'both'] })
  @IsOptional()
  @IsEnum(['inbound', 'outbound', 'both'])
  direction?: 'inbound' | 'outbound' | 'both';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  fallback_trunk_id?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  max_concurrent_calls?: number;

  @ApiProperty({ required: false, description: 'JSON libre con campos avanzados' })
  @IsOptional()
  advanced_config?: Record<string, unknown>;

  // ----- Prefijos de marcación (específicos del proveedor) -----

  @ApiProperty({ required: false, example: '06', description: 'Prefijo para celulares (ej Colombia RED: 06)' })
  @IsOptional()
  @IsString()
  dial_prefix_mobile?: string;

  @ApiProperty({ required: false, example: '57', description: 'Prefijo para fijos (ej Colombia RED: 57)' })
  @IsOptional()
  @IsString()
  dial_prefix_landline?: string;

  @ApiProperty({ required: false, example: '06', description: 'Prefijo para internacionales (cuando el agente ya escribió código país)' })
  @IsOptional()
  @IsString()
  dial_prefix_intl?: string;
}

export class UpdateSipTrunkDto extends PartialType(CreateSipTrunkDto) {}
