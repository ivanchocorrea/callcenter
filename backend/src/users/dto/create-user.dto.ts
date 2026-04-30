import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'agente1@empresa.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  password!: string;

  @ApiProperty({ example: 'Iván Correa' })
  @IsString()
  full_name!: string;

  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  company_id?: number;

  @ApiProperty({ required: false, isArray: true, example: ['agent'] })
  @IsOptional()
  @IsArray()
  role_slugs?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  locale?: string;
}

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: 'active' | 'disabled' | 'locked' | 'pending';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  role_slugs?: string[];
}
