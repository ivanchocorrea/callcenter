export interface SendSmsInput {
  to: string;
  from?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface SendSmsOutput {
  externalId?: string;
  cost?: number;
  raw?: unknown;
}

export interface SmsProvider {
  readonly slug: 'twilio' | 'generic_http' | 'vonage' | 'plivo' | 'aws_sns';
  send(input: SendSmsInput): Promise<SendSmsOutput>;
}
