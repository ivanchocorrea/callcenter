import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateAgentDto {
  @ApiProperty({ example: 1, description: 'ID del usuario asociado' })
  @IsInt()
  user_id!: number;

  @ApiProperty({ example: '1001' })
  @IsString()
  @Length(2, 20)
  extension!: string;

  @ApiProperty({ example: 'sip-strong-pass' })
  @IsString()
  @Length(8, 80)
  sip_secret!: string;

  @ApiProperty({ example: 'Iván Correa' })
  @IsString()
  display_name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  skill_level?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  can_be_recorded?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  auto_answer?: boolean;
}
