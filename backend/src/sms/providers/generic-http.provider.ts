import { SmsProvider, SendSmsInput, SendSmsOutput } from './sms-provider.interface';

interface GenericConfig {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  /** Body template con placeholders {{to}}, {{from}}, {{body}}. */
  body_template?: string;
  /** Si content-type es form-urlencoded en lugar de JSON. */
  form_urlencoded?: boolean;
  /** Path en la respuesta para extraer el id externo (ej "id" o "data.message_id"). */
  external_id_path?: string;
}

export class GenericHttpSmsProvider implements SmsProvider {
  readonly slug = 'generic_http' as const;

  constructor(
    private readonly cfg: GenericConfig,
    private readonly senderId?: string,
  ) {}

  async send(input: SendSmsInput): Promise<SendSmsOutput> {
    const placeholders: Record<string, string> = {
      to: input.to,
      from: input.from ?? this.senderId ?? '',
      body: input.body,
    };
    const replace = (s: string) => s.replace(/{{(\w+)}}/g, (_, k) => placeholders[k] ?? '');
    const headers: Record<string, string> = { ...(this.cfg.headers ?? {}) };
    if (!this.cfg.form_urlencoded && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

    let body: string;
    if (this.cfg.body_template) {
      body = replace(this.cfg.body_template);
    } else if (this.cfg.form_urlencoded) {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(placeholders)) sp.append(k, v);
      body = sp.toString();
    } else {
      body = JSON.stringify(placeholders);
    }

    const res = await fetch(this.cfg.url, { method: this.cfg.method ?? 'POST', headers, body });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Generic SMS error ${res.status}: ${text}`);
    }
    const text = await res.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { /* keep text */ }
    let externalId: string | undefined;
    if (this.cfg.external_id_path && typeof data === 'object') {
      externalId = this.cfg.external_id_path.split('.').reduce<any>((o, k) => (o ? o[k] : undefined), data);
    }
    return { externalId, raw: data };
  }
}
