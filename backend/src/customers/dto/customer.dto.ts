import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Iván Correa' })
  @IsString()
  @Length(2, 200)
  full_name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  document_type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  document_number?: string;

  @ApiProperty({ required: false, example: '+573001112233' })
  @IsOptional()
  @IsString()
  primary_phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  company_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiProperty({ required: false, enum: ['active', 'inactive', 'blocked', 'prospect'] })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'blocked', 'prospect'])
  status?: 'active' | 'inactive' | 'blocked' | 'prospect';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_vip?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  important_notes?: string;

  @ApiProperty({ required: false, description: 'JSON con campos personalizados' })
  @IsOptional()
  custom_fields?: Record<string, unknown>;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class CreateNoteDto {
  @ApiProperty()
  @IsString()
  content!: string;

  @ApiProperty({ required: false, enum: ['general', 'important', 'followup', 'internal', 'warning'] })
  @IsOptional()
  @IsEnum(['general', 'important', 'followup', 'internal', 'warning'])
  note_type?: 'general' | 'important' | 'followup' | 'internal' | 'warning';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_pinned?: boolean;
}
