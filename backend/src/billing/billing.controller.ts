import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Get('plans')
  plans() {
    return this.billing.listPlans();
  }

  @Get('subscription')
  @RequirePermissions('billing.view')
  current(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.billing.currentSubscription(req.scopedCompanyId);
  }

  @Get('usage')
  @RequirePermissions('billing.view')
  usage(@Req() req: any) {
    return this.billing.currentUsage(req.scopedCompanyId);
  }

  @Get('invoices')
  @RequirePermissions('billing.view')
  invoices(@Req() req: any) {
    return this.billing.listInvoices(req.scopedCompanyId);
  }

  @Post('start-trial')
  @Roles('super_admin', 'company_admin')
  @RequirePermissions('billing.manage')
  startTrial(@Body() body: { plan_slug: string; days?: number }, @Req() req: any) {
    return this.billing.startTrial(req.scopedCompanyId, body.plan_slug, body.days);
  }

  @Post('generate-invoices')
  @Roles('super_admin')
  generateInvoices() {
    return this.billing.generateMonthlyInvoices();
  }
}
