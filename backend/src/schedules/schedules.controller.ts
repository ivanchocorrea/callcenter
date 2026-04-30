import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SchedulesService, BusinessHoursDto, HolidayDto } from './schedules.service';

@ApiTags('schedules')
@ApiBearerAuth()
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly svc: SchedulesService) {}

  // business_hours
  @Get('business-hours')
  listHours(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.svc.listHours(req.scopedCompanyId);
  }

  @Post('business-hours')
  createHours(@Body() dto: BusinessHoursDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.svc.createHours(req.scopedCompanyId, dto);
  }

  @Patch('business-hours/:id')
  updateHours(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<BusinessHoursDto>, @Req() req: any) {
    return this.svc.updateHours(id, req.scopedCompanyId, dto);
  }

  @Delete('business-hours/:id')
  @HttpCode(204)
  async removeHours(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.svc.removeHours(id, req.scopedCompanyId);
  }

  // holidays
  @Get('holidays')
  listHolidays(@Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.svc.listHolidays(req.scopedCompanyId);
  }

  @Post('holidays')
  createHoliday(@Body() dto: HolidayDto, @Req() req: any) {
    if (!req.scopedCompanyId) throw new BadRequestException();
    return this.svc.createHoliday(req.scopedCompanyId, dto);
  }

  @Delete('holidays/:id')
  @HttpCode(204)
  async removeHoliday(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.svc.removeHoliday(id, req.scopedCompanyId);
  }
}
