import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
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

  // ---- Super admin: gestión de plan por empresa ----
  @Post('companies/:id/change-plan')
  @Roles('super_admin')
  changePlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { plan_slug: string; is_trial?: boolean; trial_days?: number },
  ) {
    return this.billing.changePlan(id, body.plan_slug, {
      isTrial: body.is_trial,
      trialDays: body.trial_days,
    });
  }

  @Post('companies/:id/limits')
  @Roles('super_admin')
  setLimits(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { max_users?: number; max_agents?: number; max_concurrent_calls?: number },
  ) {
    return this.billing.setCustomLimits(id, body);
  }

  @Get('companies/:id/limits')
  @Roles('super_admin', 'company_admin')
  getLimits(@Param('id', ParseIntPipe) id: number) {
    return this.billing.getCompanyLimits(id);
  }
}
