import {
  AIProvider, ClassifyInput, ClassifyOutput, GenerateResponseInput, GenerateResponseOutput,
  SummarizeInput, SummarizeOutput, TranscribeInput, TranscribeOutput,
} from './ai-provider.interface';

export class OpenAIProvider implements AIProvider {
  readonly slug = 'openai';

  constructor(private readonly apiKey: string, private readonly defaultModel = 'gpt-4o-mini') {}

  private async chatCompletions(model: string, messages: any[], tools?: any[], temperature = 0.5): Promise<any> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature, tools: tools?.length ? tools : undefined, tool_choice: tools?.length ? 'auto' : undefined }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async generateResponse(input: GenerateResponseInput): Promise<GenerateResponseOutput> {
    const tools = input.tools?.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
    const data = await this.chatCompletions(input.model || this.defaultModel, input.messages as any[], tools, input.temperature);
    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? '';
    const toolCalls = (choice?.message?.tool_calls ?? []).map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments || '{}'),
    }));
    return {
      content,
      tool_calls: toolCalls,
      tokens: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
      raw: data,
    };
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeOutput> {
    const fs = await import('fs');
    const buf = fs.readFileSync(input.audio_path);
    const form = new FormData();
    form.append('file', new Blob([buf]), input.audio_path.split('/').pop());
    form.append('model', input.model || 'whisper-1');
    if (input.language) form.append('language', input.language);
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`OpenAI STT ${res.status}: ${await res.text()}`);
    const data = await res.json() as any;
    return { text: data.text };
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
        { role: 'system', content: `Clasifica el texto en una de estas etiquetas: ${input.labels.join(', ')}. Responde SOLO con el nombre de la etiqueta.` },
        { role: 'user', content: input.text },
      ],
      temperature: 0,
    });
    const label = r.content.trim();
    const match = input.labels.find(l => l.toLowerCase() === label.toLowerCase()) ?? input.labels[0];
    return { label: match, confidence: 0.8 };
  }
}
