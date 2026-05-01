import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class IvrOptionDto {
  @ApiProperty({ example: '1' })
  @IsString()
  @Length(1, 4)
  dtmf_key!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ enum: ['queue', 'agent', 'bot', 'ivr', 'voicemail', 'webhook', 'hangup', 'tool', 'external'] })
  @IsEnum(['queue', 'agent', 'bot', 'ivr', 'voicemail', 'webhook', 'hangup', 'tool', 'external'])
  destination_type!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  destination_id?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  destination_value?: string;
}

export class CreateIvrMenuDto {
  @ApiProperty()
  @IsString()
  @Length(2, 80)
  slug!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 150)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  welcome_audio_id?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  menu_audio_id?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  invalid_audio_id?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  timeout_audio_id?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  out_of_hours_audio_id?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  business_hours_id?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  timeout_seconds?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  max_attempts?: number;

  @ApiProperty({ required: false, type: [IvrOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IvrOptionDto)
  options?: IvrOptionDto[];
}

export class UpdateIvrMenuDto extends PartialType(CreateIvrMenuDto) {}

export class CreateIvrAudioDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'base64 del archivo de audio' })
  @IsString()
  file_b64!: string;

  @ApiProperty({ description: 'wav, mp3, ogg' })
  @IsString()
  format!: string;

  @ApiProperty({ enum: ['welcome', 'menu', 'wait', 'moh', 'out_of_hours', 'invalid_option', 'timeout', 'recording_disclosure', 'position', 'custom'] })
  @IsEnum(['welcome', 'menu', 'wait', 'moh', 'out_of_hours', 'invalid_option', 'timeout', 'recording_disclosure', 'position', 'custom'])
  purpose!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  transcription?: string;

  @ApiProperty({ required: false, description: 'Duración en segundos calculada en cliente' })
  @IsOptional()
  @IsInt()
  duration_seconds?: number;
}
