import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('security')
@ApiBearerAuth()
@Controller('security')
@Roles('super_admin')
export class SecurityController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get('overview')
  async overview() {
    const [activeBans, expiredBans, totalAttacks, attacksToday, attacksByJail, topAttackers] = await Promise.all([
      this.ds.query(`SELECT COUNT(*) as c FROM security_bans WHERE status = 'active'`),
      this.ds.query(`SELECT COUNT(*) as c FROM security_bans WHERE status = 'expired'`),
      this.ds.query(`SELECT COUNT(*) as c FROM security_attacks`),
      this.ds.query(`SELECT COUNT(*) as c FROM security_attacks WHERE detected_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`),
      this.ds.query(`SELECT jail, COUNT(*) as count FROM security_attacks WHERE detected_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) GROUP BY jail ORDER BY count DESC`),
      this.ds.query(`SELECT ip, COUNT(*) as attempts FROM security_attacks WHERE detected_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) GROUP BY ip ORDER BY attempts DESC LIMIT 10`),
    ]);
    return {
      active_bans: activeBans[0]?.c ?? 0,
      expired_bans: expiredBans[0]?.c ?? 0,
      total_attacks: totalAttacks[0]?.c ?? 0,
      attacks_24h: attacksToday[0]?.c ?? 0,
      attacks_by_jail: attacksByJail,
      top_attackers: topAttackers,
    };
  }

  @Get('bans')
  async listBans(@Query('status') status = 'active', @Query('limit') limit = '100') {
    return this.ds.query(
      `SELECT id, ip, jail, banned_at, unbanned_at, ban_count, last_event_at, status
         FROM security_bans
         WHERE status = ?
         ORDER BY banned_at DESC
         LIMIT ?`,
      [status, parseInt(limit, 10)],
    );
  }

  @Get('attacks/recent')
  async recentAttacks(@Query('limit') limit = '200') {
    return this.ds.query(
      `SELECT ip, jail, attempted_user, detected_at
         FROM security_attacks
         ORDER BY detected_at DESC
         LIMIT ?`,
      [parseInt(limit, 10)],
    );
  }

  @Post('whitelist')
  async addToWhitelist(@Body() body: { ip: string }) {
    // Marca como whitelist (status manual_unban) y desbanea en próximo sync
    await this.ds.query(
      `UPDATE security_bans SET status = 'manual_unban', unbanned_at = NOW() WHERE ip = ? AND status = 'active'`,
      [body.ip],
    );
    return { ok: true, message: 'IP marcada para desbaneo en próximo sync' };
  }

  @Delete('bans/:id')
  async removeBan(@Param('id') id: number) {
    await this.ds.query(`UPDATE security_bans SET status = 'manual_unban', unbanned_at = NOW() WHERE id = ?`, [id]);
    return { ok: true };
  }
}
