import { SmsProvider, SendSmsInput, SendSmsOutput } from './sms-provider.interface';

/**
 * Provider de Twilio. Usa REST API con basic auth.
 * accountSid = api_key, authToken = api_secret, from = sender_id.
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly slug = 'twilio' as const;

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly senderId?: string,
  ) {}

  async send(input: SendSmsInput): Promise<SendSmsOutput> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const params = new URLSearchParams();
    params.append('To', input.to);
    params.append('From', input.from ?? this.senderId ?? '');
    params.append('Body', input.body);
    const auth = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio error ${res.status}: ${text}`);
    }
    const data = await res.json() as any;
    return { externalId: data.sid, raw: data, cost: data.price ? Math.abs(parseFloat(data.price)) : undefined };
  }
}
