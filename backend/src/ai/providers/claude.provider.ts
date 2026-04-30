import {
  AIProvider, ClassifyInput, ClassifyOutput, GenerateResponseInput, GenerateResponseOutput,
  SummarizeInput, SummarizeOutput, TranscribeInput, TranscribeOutput,
} from './ai-provider.interface';

export class ClaudeProvider implements AIProvider {
  readonly slug = 'claude';

  constructor(private readonly apiKey: string, private readonly defaultModel = 'claude-sonnet-4-6') {}

  async generateResponse(input: GenerateResponseInput): Promise<GenerateResponseOutput> {
    const systemMsgs = input.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const userAssistantMsgs = input.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
      }));
    const tools = input.tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model || this.defaultModel,
        max_tokens: input.max_tokens ?? 1024,
        system: systemMsgs || undefined,
        messages: userAssistantMsgs,
        temperature: input.temperature,
        tools: tools?.length ? tools : undefined,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json() as any;

    let content = '';
    const tool_calls: GenerateResponseOutput['tool_calls'] = [];
    for (const block of data.content ?? []) {
      if (block.type === 'text') content += block.text;
      if (block.type === 'tool_use') tool_calls!.push({ id: block.id, name: block.name, input: block.input });
    }
    return {
      content,
      tool_calls,
      tokens: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
      raw: data,
    };
  }

  async transcribe(_: TranscribeInput): Promise<TranscribeOutput> {
    throw new Error('Anthropic no provee STT directo; usa OpenAI Whisper o Deepgram');
  }

  async summarize(input: SummarizeInput): Promise<SummarizeOutput> {
    const r = await this.generateResponse({
      model: this.defaultModel,
      messages: [
        { role: 'system', content: `Resume el texto en máximo ${input.max_words ?? 80} palabras${input.language ? `, en ${input.language}` : ''}.` },
        { role: 'user', content: input.text },
      ],
    });
    return { summary: r.content };
  }

  async classify(input: ClassifyInput): Promise<ClassifyOutput> {
    const r = await this.generateResponse({
      model: this.defaultModel,
      messages: [
        { role: 'system', content: `Clasifica el texto en una de estas etiquetas: ${input.labels.join(', ')}. Responde SOLO con el nombre exacto de la etiqueta.` },
        { role: 'user', content: input.text },
      ],
      temperature: 0,
    });
    const label = r.content.trim();
    const match = input.labels.find(l => l.toLowerCase() === label.toLowerCase()) ?? input.labels[0];
    return { label: match, confidence: 0.85 };
  }
}
