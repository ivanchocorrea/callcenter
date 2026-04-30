import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { IvrMenu } from './entities/ivr-menu.entity';
import { IvrOption } from './entities/ivr-option.entity';
import { IvrAudioFile } from './entities/ivr-audio-file.entity';
import {
  CreateIvrMenuDto,
  UpdateIvrMenuDto,
  CreateIvrAudioDto,
  IvrOptionDto,
} from './dto/ivr.dto';
import { AsteriskBridgeService } from '../asterisk/asterisk-bridge.service';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class IvrService {
  private readonly logger = new Logger(IvrService.name);

  constructor(
    @InjectRepository(IvrMenu) private readonly menuRepo: Repository<IvrMenu>,
    @InjectRepository(IvrOption) private readonly optionRepo: Repository<IvrOption>,
    @InjectRepository(IvrAudioFile) private readonly audioRepo: Repository<IvrAudioFile>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly config: ConfigService,
    private readonly asterisk: AsteriskBridgeService,
    private readonly bus: EventBusService,
  ) {}

  // ------------------------------------------ menus

  async listMenus(companyId: number): Promise<IvrMenu[]> {
    return this.menuRepo.find({ where: { companyId }, order: { name: 'ASC' } });
  }

  async findMenu(id: number, companyId: number): Promise<IvrMenu & { options: IvrOption[] }> {
    const menu = await this.menuRepo.findOne({ where: { id, companyId } });
    if (!menu) throw new NotFoundException(`IVR ${id} no encontrado`);
    const options = await this.optionRepo.find({ where: { ivrMenuId: id }, order: { dtmfKey: 'ASC' } });
    return { ...menu, options };
  }

  async createMenu(companyId: number, dto: CreateIvrMenuDto): Promise<IvrMenu> {
    const exists = await this.menuRepo.findOne({ where: { companyId, slug: dto.slug } });
    if (exists) throw new ConflictException('Ya existe IVR con ese slug');
    const menu = this.menuRepo.create({
      companyId,
      slug: dto.slug,
      name: dto.name,
      description: dto.description ?? null,
      welcomeAudioId: dto.welcome_audio_id ?? null,
      menuAudioId: dto.menu_audio_id ?? null,
      invalidAudioId: dto.invalid_audio_id ?? null,
      timeoutAudioId: dto.timeout_audio_id ?? null,
      outOfHoursAudioId: dto.out_of_hours_audio_id ?? null,
      businessHoursId: dto.business_hours_id ?? null,
      timeoutSeconds: dto.timeout_seconds ?? 5,
      maxAttempts: dto.max_attempts ?? 3,
      onInvalid: 'repeat',
      onTimeout: 'repeat',
      fallbackDestinationType: null,
      fallbackDestinationId: null,
      isActive: true,
    });
    const saved = await this.menuRepo.save(menu);
    if (dto.options?.length) {
      await this.replaceOptions(Number(saved.id), companyId, dto.options);
    }
    return saved;
  }

  async updateMenu(id: number, companyId: number, dto: UpdateIvrMenuDto): Promise<IvrMenu> {
    const m = await this.menuRepo.findOne({ where: { id, companyId } });
    if (!m) throw new NotFoundException();
    if (dto.name !== undefined) m.name = dto.name;
    if (dto.description !== undefined) m.description = dto.description ?? null;
    if (dto.welcome_audio_id !== undefined) m.welcomeAudioId = dto.welcome_audio_id ?? null;
    if (dto.menu_audio_id !== undefined) m.menuAudioId = dto.menu_audio_id ?? null;
    if (dto.invalid_audio_id !== undefined) m.invalidAudioId = dto.invalid_audio_id ?? null;
    if (dto.timeout_audio_id !== undefined) m.timeoutAudioId = dto.timeout_audio_id ?? null;
    if (dto.out_of_hours_audio_id !== undefined) m.outOfHoursAudioId = dto.out_of_hours_audio_id ?? null;
    if (dto.business_hours_id !== undefined) m.businessHoursId = dto.business_hours_id ?? null;
    if (dto.timeout_seconds !== undefined) m.timeoutSeconds = dto.timeout_seconds;
    if (dto.max_attempts !== undefined) m.maxAttempts = dto.max_attempts;
    const saved = await this.menuRepo.save(m);
    if (dto.options) await this.replaceOptions(Number(saved.id), companyId, dto.options);
    return saved;
  }

  async deleteMenu(id: number, companyId: number): Promise<void> {
    const m = await this.menuRepo.findOne({ where: { id, companyId } });
    if (!m) throw new NotFoundException();
    await this.menuRepo.remove(m);
  }

  private async replaceOptions(menuId: number, companyId: number, options: IvrOptionDto[]): Promise<void> {
    await this.optionRepo.delete({ ivrMenuId: menuId });
    for (const o of options) {
      await this.optionRepo.save(
        this.optionRepo.create({
          companyId,
          ivrMenuId: menuId,
          dtmfKey: o.dtmf_key,
          label: o.label ?? null,
          destinationType: o.destination_type,
          destinationId: o.destination_id ?? null,
          destinationValue: o.destination_value ?? null,
          isActive: true,
        }),
      );
    }
  }

  // ------------------------------------------ audios

  async listAudios(companyId: number): Promise<IvrAudioFile[]> {
    return this.audioRepo.find({ where: { companyId }, order: { createdAt: 'DESC' } });
  }

  async uploadAudio(companyId: number, userId: number, dto: CreateIvrAudioDto): Promise<IvrAudioFile> {
    const buffer = Buffer.from(dto.file_b64, 'base64');
    if (buffer.length === 0) throw new ConflictException('Archivo vacío');
    if (buffer.length > 20 * 1024 * 1024) throw new ConflictException('Archivo > 20 MB');

    const baseDir = path.join(this.config.get<string>('storage.localPath') ?? '/var/recordings', `ivr/${companyId}`);
    fs.mkdirSync(baseDir, { recursive: true });
    const safe = dto.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const filename = `${Date.now()}_${safe}.${dto.format}`;
    const filePath = path.join(baseDir, filename);
    fs.writeFileSync(filePath, buffer);

    const audio = this.audioRepo.create({
      companyId,
      name: dto.name,
      filePath,
      format: dto.format,
      fileSizeBytes: buffer.length,
      purpose: dto.purpose,
      transcription: dto.transcription ?? null,
      createdBy: userId,
      isActive: true,
    });
    return this.audioRepo.save(audio);
  }

  async deleteAudio(id: number, companyId: number): Promise<void> {
    const a = await this.audioRepo.findOne({ where: { id, companyId } });
    if (!a) throw new NotFoundException();
    if (a.filePath && fs.existsSync(a.filePath)) {
      try { fs.unlinkSync(a.filePath); } catch { /* ignore */ }
    }
    await this.audioRepo.remove(a);
  }

  /** Devuelve la URI ARI media para reproducir. Asterisk soporta `sound:` para
   *  audios estándar y `recording:` para grabaciones; para archivos custom
   *  usamos `sound:/path/sin-extension` (Asterisk añade la extensión). */
  audioMediaUri(audio: IvrAudioFile): string {
    const noExt = audio.filePath.replace(/\.[^.]+$/, '');
    return `sound:${noExt}`;
  }

  // ------------------------------------------ engine

  /**
   * Ejecuta un IVR sobre un canal Asterisk. Esta función se invoca desde
   * el InboundDispatcher cuando el destino es `ivr`.
   */
  async runIvr(channelId: string, companyId: number, ivrMenuId: number, callId: number): Promise<void> {
    const menu = await this.findMenu(ivrMenuId, companyId);
    let attempt = 0;
    let resolved = false;
    while (attempt < menu.maxAttempts && !resolved) {
      attempt += 1;
      try {
        if (attempt === 1 && menu.welcomeAudioId) {
          const a = await this.audioRepo.findOne({ where: { id: menu.welcomeAudioId, companyId } });
          if (a) await this.asterisk.playback(channelId, this.audioMediaUri(a));
        }
        if (menu.menuAudioId) {
          const a = await this.audioRepo.findOne({ where: { id: menu.menuAudioId, companyId } });
          if (a) await this.asterisk.playback(channelId, this.audioMediaUri(a));
        }

        // Esperar DTMF (timeout)
        const dtmf = await this.waitForDtmf(channelId, menu.timeoutSeconds * 1000);
        await this.logIvr(callId, companyId, ivrMenuId, dtmf, attempt, dtmf ? 'selected' : 'timeout');

        if (!dtmf) {
          if (menu.onTimeout === 'hangup') { await this.asterisk.hangup(channelId); return; }
          if (attempt >= menu.maxAttempts) break;
          continue;
        }

        const opt = menu.options.find(o => o.dtmfKey === dtmf && o.isActive);
        if (!opt) {
          if (menu.invalidAudioId) {
            const a = await this.audioRepo.findOne({ where: { id: menu.invalidAudioId, companyId } });
            if (a) await this.asterisk.playback(channelId, this.audioMediaUri(a));
          }
          continue;
        }

        await this.dispatchOption(channelId, companyId, callId, opt);
        resolved = true;
        return;
      } catch (err: any) {
        this.logger.error(`IVR error en canal ${channelId}: ${err?.message ?? err}`);
      }
    }
    // Fallback al destino final
    if (menu.fallbackDestinationType && menu.fallbackDestinationId) {
      await this.dispatchOption(channelId, companyId, callId, {
        ...({} as any),
        dtmfKey: '*',
        destinationType: menu.fallbackDestinationType,
        destinationId: menu.fallbackDestinationId,
        destinationValue: null,
        isActive: true,
      } as IvrOption);
    } else {
      await this.asterisk.hangup(channelId).catch(() => undefined);
    }
  }

  /** Promesa que se resuelve con el primer DTMF o null si timeout. */
  private waitForDtmf(channelId: string, timeoutMs: number): Promise<string | null> {
    return new Promise(resolve => {
      let resolved = false;
      const off = this.bus.on('asterisk:event', (e: any) => {
        if (resolved) return;
        if (e?.source !== 'ari' || e.name !== 'ChannelDtmfReceived') return;
        if (e.payload?.channel?.id !== channelId) return;
        const digit = e.payload?.event?.digit;
        if (digit) {
          resolved = true;
          off();
          resolve(digit);
        }
      });
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        off();
        resolve(null);
      }, timeoutMs);
    });
  }

  private async dispatchOption(channelId: string, companyId: number, callId: number, opt: IvrOption): Promise<void> {
    switch (opt.destinationType) {
      case 'hangup':
        await this.asterisk.hangup(channelId);
        return;
      case 'queue':
        await this.bus.publish(`co:${companyId}:call`, {
          type: 'ivr.dispatch.queue',
          call_id: callId,
          channel_id: channelId,
          queue_id: opt.destinationId,
        });
        return;
      case 'agent':
      case 'bot':
      case 'voicemail':
      case 'ivr':
      case 'tool':
      case 'external':
      case 'webhook':
        await this.bus.publish(`co:${companyId}:call`, {
          type: `ivr.dispatch.${opt.destinationType}`,
          call_id: callId,
          channel_id: channelId,
          destination_id: opt.destinationId,
          destination_value: opt.destinationValue,
        });
        return;
    }
  }

  private async logIvr(
    callId: number,
    companyId: number,
    menuId: number,
    digit: string | null,
    attempt: number,
    outcome: 'selected' | 'invalid' | 'timeout' | 'exited' | 'transferred',
  ): Promise<void> {
    await this.ds.query(
      `INSERT INTO ivr_logs (company_id, call_id, ivr_menu_id, dtmf_pressed, attempt, outcome, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [companyId, callId, menuId, digit, attempt, outcome],
    );
  }
}
