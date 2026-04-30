import {
  AIProvider, ClassifyInput, ClassifyOutput, GenerateResponseInput, GenerateResponseOutput,
  SummarizeInput, SummarizeOutput, TranscribeInput, TranscribeOutput,
} from './ai-provider.interface';

export class GeminiProvider implements AIProvider {
  readonly slug = 'gemini';

  constructor(private readonly apiKey: string, private readonly defaultModel = 'gemini-1.5-flash') {}

  async generateResponse(input: GenerateResponseInput): Promise<GenerateResponseOutput> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${input.model || this.defaultModel}:generateContent?key=${this.apiKey}`;
    const contents = input.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const systemInstruction = input.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const tools = input.tools?.length ? [{ function_declarations: input.tools.map(t => ({ name: t.name, description: t.description, parameters: t.input_schema })) }] : undefined;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        tools,
        generationConfig: { temperature: input.temperature, maxOutputTokens: input.max_tokens },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json() as any;
    const cand = data.candidates?.[0];
    let content = '';
    const tool_calls: GenerateResponseOutput['tool_calls'] = [];
    for (const part of cand?.content?.parts ?? []) {
      if (part.text) content += part.text;
      if (part.functionCall) tool_calls!.push({ id: part.functionCall.name, name: part.functionCall.name, input: part.functionCall.args ?? {} });
    }
    return {
      content,
      tool_calls,
      tokens: { input: data.usageMetadata?.promptTokenCount ?? 0, output: data.usageMetadata?.candidatesTokenCount ?? 0 },
      raw: data,
    };
  }

  async transcribe(_: TranscribeInput): Promise<TranscribeOutput> {
    throw new Error('Gemini STT vía Google Speech-to-Text es separado; usa OpenAI o Deepgram');
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
        { role: 'system', content: `Clasifica el texto entre estas etiquetas: ${input.labels.join(', ')}. Responde SOLO la etiqueta.` },
        { role: 'user', content: input.text },
      ],
      temperature: 0,
    });
    const label = r.content.trim();
    const match = input.labels.find(l => l.toLowerCase() === label.toLowerCase()) ?? input.labels[0];
    return { label: match, confidence: 0.8 };
  }
}
