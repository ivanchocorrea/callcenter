import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { WhatsappService, CreateWhatsappAccountDto } from './whatsapp.service';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('whatsapp')
@Controller()
export class WhatsappController {
  constructor(private readonly svc: WhatsappService) {}

  // ────────── Webhook público (no auth) ──────────

  /** Verificación de Meta — devuelve hub.challenge si coincide verify_token */
  @Public()
  @Get('webhooks/whatsapp/:phoneNumberId')
  async verify(
    @Param('phoneNumberId') phoneNumberId: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const acc = await this.svc.findByPhoneId(phoneNumberId);
    if (!acc) {
      res.status(404).send('Account not found');
      return;
    }
    if (mode === 'subscribe' && token === acc.verify_token) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send('Forbidden');
  }

  /** Recepción de mensajes desde Meta */
  @Public()
  @Post('webhooks/whatsapp/:phoneNumberId')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param('phoneNumberId') phoneNumberId: string,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: any,
    @Req() req: any,
  ) {
    const acc = await this.svc.findByPhoneId(phoneNumberId);
    if (!acc) return { ok: true }; // Meta no debe reintentar — devolver OK siempre

    if (acc.webhook_secret) {
      const rawBody = req.rawBody?.toString() ?? JSON.stringify(body);
      const valid = this.svc.verifySignature(rawBody, signature, acc.webhook_secret);
      if (!valid) return { ok: true }; // descartar silenciosamente, no decirle a Meta que falló
    }

    await this.svc.processIncoming(acc.id, acc.company_id, body);
    return { ok: true };
  }

  // ────────── API administrativa (requiere auth) ──────────

  @Get('whatsapp/accounts')
  @ApiBearerAuth()
  @RequirePermissions('webhooks.view')
  list(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.svc.listAccounts(req.scopedCompanyId);
  }

  @Post('whatsapp/accounts')
  @ApiBearerAuth()
  @RequirePermissions('webhooks.manage')
  async create(@Body() dto: CreateWhatsappAccountDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.svc.createAccount(req.scopedCompanyId, dto);
  }

  @Delete('whatsapp/accounts/:id')
  @ApiBearerAuth()
  @HttpCode(204)
  @RequirePermissions('webhooks.manage')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.svc.removeAccount(id, req.scopedCompanyId);
  }

  @Get('whatsapp/messages')
  @ApiBearerAuth()
  @RequirePermissions('webhooks.view')
  messages(@Req() req: any, @Query('limit') limit = '100') {
    return this.svc.listMessages(req.scopedCompanyId, parseInt(limit, 10));
  }

  @Post('whatsapp/accounts/:id/send')
  @ApiBearerAuth()
  @RequirePermissions('webhooks.manage')
  send(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { to: string; text: string },
    @Req() req: any,
  ) {
    if (!body.to || !body.text) throw new BadRequestException('to y text requeridos');
    return this.svc.sendMessage(req.scopedCompanyId, id, body.to, body.text);
  }
}
