import {
  AIProvider, ClassifyInput, ClassifyOutput, GenerateResponseInput, GenerateResponseOutput,
  SummarizeInput, SummarizeOutput, TranscribeInput, TranscribeOutput,
} from './ai-provider.interface';

interface GenericConfig {
  base_url: string;
  headers?: Record<string, string>;
  /** Path en la respuesta para la respuesta del modelo (ej. "choices.0.message.content"). */
  response_content_path?: string;
}

/** Provider HTTP genérico — útil para LLMs self-hosted (Ollama, vLLM, etc.) */
export class GenericHttpAIProvider implements AIProvider {
  readonly slug = 'generic_http';

  constructor(private readonly cfg: GenericConfig, private readonly defaultModel = 'default') {}

  async generateResponse(input: GenerateResponseInput): Promise<GenerateResponseOutput> {
    const res = await fetch(`${this.cfg.base_url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.cfg.headers ?? {}) },
      body: JSON.stringify({
        model: input.model || this.defaultModel,
        messages: input.messages,
        temperature: input.temperature,
        max_tokens: input.max_tokens,
      }),
    });
    if (!res.ok) throw new Error(`Generic HTTP AI ${res.status}: ${await res.text()}`);
    const data = await res.json() as any;
    const path = this.cfg.response_content_path ?? 'choices.0.message.content';
    const content = path.split('.').reduce<any>((o, k) => (o ? o[k] : undefined), data) ?? '';
    return {
      content: String(content),
      tool_calls: [],
      tokens: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
      raw: data,
    };
  }

  async transcribe(_: TranscribeInput): Promise<TranscribeOutput> {
    throw new Error('Generic HTTP provider sin STT; configura un provider de capability stt');
  }

  async summarize(input: SummarizeInput): Promise<SummarizeOutput> {
    const r = await this.generateResponse({
      model: this.defaultModel,
      messages: [
        { role: 'system', content: `Resume en ${input.max_words ?? 80} palabras` },
        { role: 'user', content: input.text },
      ],
    });
    return { summary: r.content };
  }

  async classify(input: ClassifyInput): Promise<ClassifyOutput> {
    const r = await this.generateResponse({
      model: this.defaultModel,
      messages: [
        { role: 'system', content: `Clasifica entre: ${input.labels.join(', ')}. Responde solo la etiqueta.` },
        { role: 'user', content: input.text },
      ],
      temperature: 0,
    });
    const match = input.labels.find(l => l.toLowerCase() === r.content.trim().toLowerCase()) ?? input.labels[0];
    return { label: match, confidence: 0.7 };
  }
}
