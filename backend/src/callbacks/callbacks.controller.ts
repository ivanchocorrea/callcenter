import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CallbacksService } from './callbacks.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

interface CreateCallbackDto {
  phone: string;
  customer_id?: number;
  queue_id?: number;
  original_call_id?: number;
  customer_name?: string;
  preferred_at?: string;
  priority?: number;
}

@ApiTags('callbacks')
@ApiBearerAuth()
@Controller('callbacks')
export class CallbacksController {
  constructor(private readonly callbacks: CallbacksService) {}

  @Get()
  @RequirePermissions('queues.view')
  list(@Req() req: any, @Query('status') status?: string) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.callbacks.list(req.scopedCompanyId, status);
  }

  @Post()
  @RequirePermissions('queues.view')
  create(@Body() dto: CreateCallbackDto, @Req() req: any) {
    if (!dto.phone) throw new BadRequestException('phone requerido');
    return this.callbacks.create(
      req.scopedCompanyId,
      dto.phone,
      dto.customer_id,
      dto.queue_id,
      dto.original_call_id,
      dto.customer_name,
      dto.preferred_at ? new Date(dto.preferred_at) : undefined,
      dto.priority ?? 0,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('queues.manage')
  async cancel(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.callbacks.cancel(id, req.scopedCompanyId);
  }
}
