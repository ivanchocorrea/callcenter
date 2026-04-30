import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RestartDto {
  @IsEnum(['backend', 'frontend', 'asterisk', 'redis', 'all'])
  target!: 'backend' | 'frontend' | 'asterisk' | 'redis' | 'all';

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;

  /** Confirmación explícita del usuario (debe llegar en true). */
  @IsBoolean()
  confirm!: boolean;
}

export class CreateBackupDto {
  @IsOptional() @IsBoolean() includeDb?: boolean;
  @IsOptional() @IsBoolean() includeUploads?: boolean;
  @IsOptional() @IsBoolean() includeConfig?: boolean;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class RestoreBackupDto {
  @IsInt() @Min(1)
  backupId!: number;

  /** Doble confirmación: ambos deben ser true. */
  @IsBoolean() confirm1!: boolean;
  @IsBoolean() confirm2!: boolean;

  /** Frase exacta que el usuario debe escribir: "RESTAURAR". */
  @IsString()
  confirmationPhrase!: string;
}

export class ApplyUpdatesDto {
  @IsEnum(['backend', 'frontend', 'all'])
  project!: 'backend' | 'frontend' | 'all';

  /** Solo aplica patch + minor. Mayor requiere acción manual del desarrollador. */
  @IsBoolean()
  onlySafe!: boolean;

  @IsBoolean()
  confirm!: boolean;
}

export class AcknowledgeErrorDto {
  @IsInt() @Min(1) errorId!: number;
  @IsEnum(['acknowledged', 'resolved', 'ignored']) newStatus!: 'acknowledged' | 'resolved' | 'ignored';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class ListErrorsQueryDto {
  @IsOptional() @IsEnum(['info', 'warning', 'error', 'critical']) severity?: string;
  @IsOptional() @IsEnum(['open', 'acknowledged', 'resolved', 'ignored']) status?: string;
  @IsOptional() @IsEnum(['backend', 'frontend', 'database', 'telephony', 'external_api', 'scheduled_task', 'other']) source?: string;
  @IsOptional() @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsInt() @Min(0) offset?: number;
}
