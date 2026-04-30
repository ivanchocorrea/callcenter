# Diseño del Motor IA

## 1. Principios

1. **Provider-agnostic**: ningún módulo llama directo a OpenAI/Claude/Gemini. Todo va por `AIProviderService`.
2. **Multi-tenant**: cada empresa configura sus propios providers en `ai_providers` (con API keys cifradas).
3. **No alucinar datos**: la IA accede a datos reales solo vía **tools** autorizadas.
4. **Versionado**: prompts versionados; nunca pierdes una versión.
5. **Costo-control**: cada llamada se loguea en `ai_usage_logs` con tokens y costo estimado.

## 2. Interfaz común

```typescript
interface AIProvider {
  generateResponse(input: GenerateResponseInput): Promise<GenerateResponseOutput>;
  transcribe(input: TranscribeInput): Promise<TranscribeOutput>;
  summarize(input: SummarizeInput): Promise<SummarizeOutput>;
  classify(input: ClassifyInput): Promise<ClassifyOutput>;
}
```

Implementaciones (Fase 15):
- `OpenAIProvider` (chat completions, whisper, embeddings)
- `ClaudeProvider` (messages API, tool use nativo)
- `GeminiProvider` (generateContent + function calling)
- `GenericHttpAIProvider` (configurable: base_url, headers, request/response template)

## 3. Resolución de provider

Para cada conversación, el provider se resuelve así:

```
1. Si el bot tiene provider_id explícito → ese.
2. Else: ai_providers WHERE company_id=? AND is_default=true.
3. Else: error.
```

Si la llamada falla con código retentable (429, 5xx, timeout), el dispatcher intenta el provider de **fallback** definido en `company_settings.ai_fallback_provider_slug`.

## 4. Bots

`ai_bots`:
- Cada bot es una "personalidad" con un provider, modelo, voz, prompt activo y tools permitidas.
- Tipos predefinidos: recepción, citas, ventas, soporte, cobranza, encuestas, custom.
- Asignados a colas (vía `ai_bot_queues`) y/o a opciones IVR.

Cuando una llamada llega a un bot:
1. Backend crea `ai_conversations` con `channel='voice'`.
2. Empieza un loop:
   - STT del audio del cliente (Whisper / Deepgram / etc.)
   - Mensaje al provider con [system_prompt, ...history, user_message] + tools disponibles
   - Si responde con `tool_call` → ejecuta la tool con el `AIToolRegistry`
   - TTS de la respuesta y playback al cliente vía ARI
   - Si la respuesta contiene "transferir a humano" o keyword → bridge a cola humana

## 5. Prompts versionados

`ai_prompts` + `ai_prompt_versions`:
- Cada prompt tiene N versiones, una activa.
- Editor de prompt con Markdown + variables (`{{customer_name}}`, `{{queue_name}}`).
- Diff entre versiones.
- Rollback con un click.
- Test interactivo: "playground" con payload de prueba que simula una conversación.

Tipos por scope: `global`, `company`, `bot`, `campaign`, `queue`, `summary`, `classification`, `sentiment`, `transfer`, `tools`.

## 6. Tools (function calling)

`ai_tools`:
- Cada tool tiene un `input_schema` (JSON Schema) que el provider usará para forzar argumentos válidos.
- Ejecución en el backend, NO en el provider.
- `handler_type`:
  - `builtin` → función TypeScript registrada en `AIToolRegistry`
  - `connector` → llama a un `data_connector` (Google Sheets, API externa)
  - `webhook` → POST a una URL configurada
  - `sql` → ejecuta query parametrizada (con whitelist de tablas)

Tools mínimas predefinidas:
- `consultar_cliente(phone | document)`
- `crear_ticket(subject, description, priority, customer_id)`
- `buscar_cita(customer_id)` / `crear_cita(customer_id, start_at, ...)`
- `enviar_sms(template_slug, phone, vars)`
- `transferir_a_humano(queue_slug, reason)`
- `crear_callback(phone, preferred_at)`
- `consultar_google_sheets(connector_slug, query)`

Cada ejecución se loguea en `ai_tool_execution_logs` con duración, input/output y éxito.

## 7. Permisos

`ai_tool_permissions(bot_id, tool_id, is_required)`:
- Solo las tools listadas son visibles para ese bot.
- Si una tool es `is_required=true`, el bot no puede iniciar conversación sin ella disponible.

## 8. Knowledge Base / RAG (sugerencia)

`kb_documents` + `kb_chunks`:
- Cargar documentos (PDF, Markdown, txt, URL) → split en chunks.
- Generar embeddings (provider con capability `embeddings`).
- Tool `consultar_base_conocimiento(query, top_k=5)` busca por similitud y devuelve los chunks relevantes.
- El bot los inyecta en el contexto del LLM.

Storage de embeddings: archivo JSON en disco (Fase inicial) o servicio externo (Pinecone, Qdrant, pgvector) en futuro.

## 9. Sentiment + STT en vivo (sugerencia)

Durante una llamada humana, opcionalmente:
- Audio del cliente → STT en streaming (Deepgram/Whisper realtime).
- Cada N segundos, un chunk de transcripción → provider con prompt de sentiment.
- Si sentiment ≤ -0.5 sostenido → alertar supervisor.

Configurable por empresa (caro de operar — disabled por defecto).

## 10. Resumen automático post-llamada

Al terminar una llamada con `is_recorded=true`:
1. Worker lee la grabación, llama `transcribe()`.
2. Llama `summarize()` con prompt scope `summary`.
3. Guarda en `calls.ai_summary` y emite `ai.summary.created`.

## 11. Costo-control

`ai_usage_logs.cost_usd` se calcula con tarifas estáticas configurables por modelo. `usage_counters` agrega por mes para billing/alertas.

Si una empresa supera su `quota_value` → bloquea nuevas llamadas a IA o degrada a un modelo más barato (configurable).

## 12. Compliance

- Logs IA pueden ser sensibles → respetar `data_retention_policies`.
- Si el cliente pide "borrar mis datos", se purgan también `ai_messages` con su `customer_id`.
- Documentar al cliente final si las grabaciones se transcriben fuera del país (GDPR cross-border).
