import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicApiService } from './public-api.service';
import { ApiKeyGuard, RequireScope } from './api-key.guard';
import { Public } from '../common/decorators/public.decorator';
import { CallsService } from '../calls/calls.service';
import { CustomersService } from '../customers/customers.service';
import { SmsService } from '../sms/sms.service';
import { OutboundDialerService } from '../outbound-dialer/outbound-dialer.service';
import { Roles } from '../common/decorators/roles.decorator';

interface CreateKeyDto { name: string; scopes: string[]; rate_limit?: number; expires_at?: string }

/** Endpoints internos para gestionar API keys (autenticados con JWT). */
@ApiTags('public-api-admin')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly api: PublicApiService) {}

  @Get()
  @Roles('super_admin', 'company_admin')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.api.listKeys(req.scopedCompanyId);
  }

  @Post()
  @Roles('super_admin', 'company_admin')
  create(@Body() dto: CreateKeyDto, @Req() req: any) {
    return this.api.createKey(
      req.scopedCompanyId,
      dto.name,
      dto.scopes,
      dto.rate_limit,
      dto.expires_at ? new Date(dto.expires_at) : undefined,
      req.user?.userId,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('super_admin', 'company_admin')
  async revoke(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.api.revoke(id, req.scopedCompanyId);
  }
}

/**
 * API pública v1 — autenticada por API key (no JWT).
 * Bypassea el JWT guard global con @Public() y usa ApiKeyGuard.
 */
@ApiTags('public-api')
@Controller('v1')
@Public()
@UseGuards(ApiKeyGuard)
export class PublicApiV1Controller {
  constructor(
    private readonly calls: CallsService,
    private readonly customers: CustomersService,
    private readonly sms: SmsService,
    private readonly dialer: OutboundDialerService,
  ) {}

  @Get('calls')
  @ApiOperation({ summary: 'Lista llamadas (scope: calls:read)' })
  @RequireScope('calls:read')
  listCalls(@Req() req: any, @Query('limit') limit = '100', @Query('offset') offset = '0') {
    return this.calls.listByCompany(req.apiKey.companyId, parseInt(limit, 10), parseInt(offset, 10));
  }

  @Get('calls/:id')
  @RequireScope('calls:read')
  getCall(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.calls.findById(id, req.apiKey.companyId);
  }

  @Get('customers')
  @RequireScope('customers:read')
  listCustomers(@Req() req: any, @Query('search') search?: string) {
    return this.customers.list(req.apiKey.companyId, { search });
  }

  @Get('customers/:id')
  @RequireScope('customers:read')
  getCustomer(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.customers.findById(id, req.apiKey.companyId);
  }

  @Post('customers')
  @RequireScope('customers:write')
  createCustomer(@Body() dto: any, @Req() req: any) {
    return this.customers.create(req.apiKey.companyId, dto);
  }

  @Post('sms')
  @RequireScope('sms:send')
  sendSms(@Body() body: { to: string; body?: string; template_slug?: string; variables?: Record<string, string> }, @Req() req: any) {
    if (!body?.to) throw new BadRequestException('to requerido');
    return this.sms.send(req.apiKey.companyId, body.to, body.body, {
      templateSlug: body.template_slug,
      variables: body.variables,
    });
  }

  @Post('dial')
  @RequireScope('calls:dial')
  dial(@Body() body: { number: string; agent_user_id: number }, @Req() req: any) {
    return this.dialer.dial({ userId: body.agent_user_id, email: 'api', companyId: req.apiKey.companyId }, body as any);
  }
}
