/**
 * Interfaz común que TODOS los proveedores IA deben implementar.
 * Ningún módulo del sistema debe llamar directamente a OpenAI/Claude/Gemini:
 * todo pasa por AIProviderService → AIProvider.
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface AITool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>; // JSON Schema
}

export interface GenerateResponseInput {
  model: string;
  messages: AIMessage[];
  tools?: AITool[];
  temperature?: number;
  max_tokens?: number;
  metadata?: Record<string, unknown>;
}

export interface GenerateResponseOutput {
  content: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  tokens: { input: number; output: number };
  raw?: unknown;
}

export interface TranscribeInput {
  audio_path: string;
  language?: string;
  model?: string;
}
export interface TranscribeOutput {
  text: string;
  language?: string;
  segments?: Array<{ start: number; end: number; text: string }>;
}

export interface SummarizeInput {
  text: string;
  language?: string;
  max_words?: number;
}
export interface SummarizeOutput {
  summary: string;
  bullet_points?: string[];
}

export interface ClassifyInput {
  text: string;
  labels: string[];
}
export interface ClassifyOutput {
  label: string;
  confidence: number;
  scores?: Record<string, number>;
}

export interface AIProvider {
  readonly slug: string;
  generateResponse(input: GenerateResponseInput): Promise<GenerateResponseOutput>;
  transcribe(input: TranscribeInput): Promise<TranscribeOutput>;
  summarize(input: SummarizeInput): Promise<SummarizeOutput>;
  classify(input: ClassifyInput): Promise<ClassifyOutput>;
}
