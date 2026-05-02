import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateCallScriptDto {
  @ApiProperty({ example: 'Saludo institucional' })
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiProperty({ description: 'Markdown o HTML' })
  @IsString()
  content!: string;

  @ApiProperty({ required: false, enum: ['outbound', 'inbound', 'both'], default: 'both' })
  @IsOptional()
  @IsEnum(['outbound', 'inbound', 'both'])
  script_type?: 'outbound' | 'inbound' | 'both';

  @ApiProperty({ required: false, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateCallScriptDto extends PartialType(CreateCallScriptDto) {}
