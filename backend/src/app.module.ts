import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { configValidationSchema } from './config/config.schema';
import appConfig from './config/app.config';
import dbConfig from './config/db.config';
import jwtConfig from './config/jwt.config';
import asteriskConfig from './config/asterisk.config';
import storageConfig from './config/storage.config';

// Common / globals
import { HealthModule } from './common/health/health.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { RedisModule } from './common/redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { EventsModule } from './events/events.module';
import { StorageModule } from './storage/storage.module';
import { ConnectorsModule } from './connectors/connectors.module';
import { WebhooksModule } from './webhooks/webhooks.module';

// Auth + tenancy (Fase 1)
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AgentsModule } from './agents/agents.module';

// Telefonía (Fase 3-7)
import { SipModule } from './sip/sip.module';
import { AsteriskModule } from './asterisk/asterisk.module';
import { WebRtcModule } from './webrtc/webrtc.module';
import { CallsModule } from './calls/calls.module';
import { InboundCallsModule } from './inbound-calls/inbound-calls.module';
import { RealtimeModule } from './realtime/realtime.module';
import { OutboundDialerModule } from './outbound-dialer/outbound-dialer.module';

// CRM + IVR + Queues + Recordings (Fase 8-12)
import { CustomersModule } from './customers/customers.module';
import { IvrModule } from './ivr/ivr.module';
import { QueuesModule } from './queues/queues.module';
// import { RecordingsModule } from './recordings/recordings.module'; // TEMP: deshabilitado para deploy inicial
import { ReportsModule } from './reports/reports.module';

// SMS / Callbacks (Fase 14)
import { SmsModule } from './sms/sms.module';
import { CallbacksModule } from './callbacks/callbacks.module';

// IA (Fase 15-18)
import { AIModule } from './ai/ai.module';

// Automations + Campaigns (Fase 19-20)
import { AutomationsModule } from './automations/automations.module';
import { CampaignsModule } from './campaigns/campaigns.module';

// Quality + Billing + Monitoring (Fase 21-23)
import { QualityModule } from './quality/quality.module';
import { BillingModule } from './billing/billing.module';
import { MonitoringModule } from './monitoring/monitoring.module';

// Public API + Omnichannel (Fase 24-25)
import { PublicApiModule } from './public-api/public-api.module';
import { OmnichannelModule } from './omnichannel/omnichannel.module';

// Mantenimiento (Fase 26)
import { MaintenanceModule } from './maintenance/maintenance.module';

// Schedules (FASE 18)
import { SchedulesModule } from './schedules/schedules.module';

// WhatsApp (FASE 19)
import { WhatsappModule } from './whatsapp/whatsapp.module';

import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { CompanyScopeGuard } from './common/guards/company-scope.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, jwtConfig, asteriskConfig, storageConfig],
      validationSchema: configValidationSchema,
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        customProps: req => ({ requestId: (req as any).requestId }),
        redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.password_hash'],
      },
    }),

    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'mysql',
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT ?? '3306', 10),
        username: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        autoLoadEntities: true,
        synchronize: false,
        timezone: 'Z',
        charset: 'utf8mb4',
        extra: { connectionLimit: 20 },
      }),
    }),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10) * 1000,
        limit: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
      },
    ]),

    HealthModule,
    EncryptionModule,
    RedisModule,
    EventsModule,
    StorageModule,
    ConnectorsModule,
    WebhooksModule,
    AuditModule,

    // Auth + tenancy
    AuthModule,
    CompaniesModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    AgentsModule,

    // Telefonía
    SipModule,
    AsteriskModule,
    WebRtcModule,
    CallsModule,
    InboundCallsModule,
    RealtimeModule,
    OutboundDialerModule,

    // CRM / IVR / Queues / Recordings / Reports
    CustomersModule,
    IvrModule,
    QueuesModule,
    // RecordingsModule, // TEMP: deshabilitado para deploy inicial
    ReportsModule,

    // SMS / Callbacks
    SmsModule,
    CallbacksModule,

    // IA
    AIModule,

    // Automations + Campaigns
    AutomationsModule,
    CampaignsModule,

    // Quality + Billing + Monitoring
    QualityModule,
    BillingModule,
    MonitoringModule,

    // Public API + Omnichannel
    PublicApiModule,
    OmnichannelModule,

    // Mantenimiento (panel para no desarrolladores)
    MaintenanceModule,

    // Schedules (horarios + holidays)
    SchedulesModule,

    // WhatsApp Business
    WhatsappModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CompanyScopeGuard },
  ],
})
export class AppModule {}
