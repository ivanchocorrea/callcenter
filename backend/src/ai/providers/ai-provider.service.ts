import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { AIProvider, GenerateResponseInput, GenerateResponseOutput } from './ai-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { ClaudeProvider } from './claude.provider';
import { GeminiProvider } from './gemini.provider';
import { GenericHttpAIProvider } from './generic-http.provider';

@Injectable()
export class AIProviderService {
  private readonly logger = new Logger(AIProviderService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly encryption: EncryptionService,
  ) {}

  /** Resuelve provider activo de la empresa (default), o uno específico por id. */
  async getProvider(companyId: number, providerId?: number): Promise<{ provider: AIProvider; model: string; row: any }> {
    const rows = providerId
      ? await this.ds.query(`SELECT * FROM ai_providers WHERE id = ? AND company_id = ? AND is_active = TRUE`, [providerId, companyId])
      : await this.ds.query(`SELECT * FROM ai_providers WHERE company_id = ? AND is_active = TRUE AND is_default = TRUE LIMIT 1`, [companyId]);
    const r = rows[0];
    if (!r) throw new NotFoundException('Sin proveedor IA configurado');

    const apiKey = r.api_key_encrypted ? this.encryption.decrypt(r.api_key_encrypted) : '';
    let provider: AIProvider;
    switch (r.provider_type) {
      case 'openai':
      case 'azure_openai':
        provider = new OpenAIProvider(apiKey, r.default_model ?? 'gpt-4o-mini');
        break;
      case 'anthropic':
        provider = new ClaudeProvider(apiKey, r.default_model ?? 'claude-sonnet-4-6');
        break;
      case 'google':
        provider = new GeminiProvider(apiKey, r.default_model ?? 'gemini-1.5-flash');
        break;
      case 'generic_http': {
        const cfg = typeof r.headers === 'string' ? JSON.parse(r.headers) : (r.headers ?? {});
        provider = new GenericHttpAIProvider({
          base_url: r.base_url,
          headers: cfg,
          response_content_path: r.response_path?.content ?? 'choices.0.message.content',
        }, r.default_model ?? 'default');
        break;
      }
      default:
        throw new NotFoundException(`Provider ${r.provider_type} no soportado`);
    }
    return { provider, model: r.default_model ?? 'gpt-4o-mini', row: r };
  }

  async generateResponse(companyId: number, input: GenerateResponseInput, providerId?: number, botId?: number): Promise<GenerateResponseOutput> {
    const { provider, model, row } = await this.getProvider(companyId, providerId);
    const start = Date.now();
    try {
      const out = await provider.generateResponse({ ...input, model: input.model || model });
      await this.ds.query(
        `INSERT INTO ai_usage_logs (company_id, provider_id, bot_id, operation, model, tokens_input, tokens_output, duration_ms, success)
         VALUES (?, ?, ?, 'chat', ?, ?, ?, ?, TRUE)`,
        [companyId, row.id, botId ?? null, input.model || model, out.tokens.input, out.tokens.output, Date.now() - start],
      );
      return out;
    } catch (err: any) {
      await this.ds.query(
        `INSERT INTO ai_usage_logs (company_id, provider_id, bot_id, operation, model, duration_ms, success)
         VALUES (?, ?, ?, 'chat', ?, ?, FALSE)`,
        [companyId, row.id, botId ?? null, input.model || model, Date.now() - start],
      );
      throw err;
    }
  }
}
