import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug debe ser kebab-case en minúscula' })
  @Length(2, 120)
  slug!: string;

  @ApiProperty({ example: 'ACME Corporation S.A.S.' })
  @IsString()
  @Length(2, 200)
  legal_name!: string;

  @ApiProperty({ example: 'ACME' })
  @IsString()
  @Length(2, 150)
  display_name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tax_id?: string;

  @ApiProperty({ required: false, example: 'CO' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ required: false, example: 'America/Bogota' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ required: false, example: 'es-CO' })
  @IsOptional()
  @IsString()
  default_locale?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  primary_email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  primary_phone?: string;
}

export class UpdateCompanyDto extends CreateCompanyDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  declare slug: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  declare legal_name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  declare display_name: string;
}
