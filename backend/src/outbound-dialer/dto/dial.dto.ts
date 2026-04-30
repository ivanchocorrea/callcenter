import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Matches } from 'class-validator';

export class DialDto {
  @ApiProperty({ example: '+573001112233' })
  @IsString()
  @Length(3, 25)
  @Matches(/^\+?[0-9*#]+$/, { message: 'número con dígitos, + opcional, * o #' })
  number!: string;

  @ApiProperty({ required: false, description: 'Trunk a usar (opcional, si null usa el de mayor prioridad)' })
  @IsOptional()
  @IsInt()
  trunk_id?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  caller_id?: string;

  @ApiProperty({ required: false, description: 'Customer asociado a la llamada' })
  @IsOptional()
  @IsInt()
  customer_id?: number;

  @ApiProperty({ required: false, description: 'Campaña asociada' })
  @IsOptional()
  @IsInt()
  campaign_id?: number;
}
