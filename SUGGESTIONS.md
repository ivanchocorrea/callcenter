# Sugerencias añadidas a la especificación original

Tras leer el documento maestro completo, identifiqué los siguientes elementos que **no estaban en la spec original** pero que en mi experiencia son críticos para un call center SaaS profesional vendible. Los marqué como **incluidos** (ya los agregué al diseño y al esquema) o **opcionales** (los dejo documentados para que decidas).

---

## 1. Operación y compliance (INCLUIDOS)

### 1.1. Lista DNC (Do Not Call) por empresa
- **Por qué:** En muchos países (USA, Colombia con SIC, Reglamento UE, México con REPEP) es **obligación legal** no marcar a números registrados en listas DNC. Una multa puede cerrar tu negocio.
- **Implementación:** tabla `dnc_lists` y `dnc_entries`, validación previa a cada llamada saliente y antes de cargar campañas.

### 1.2. Aviso legal de grabación
- **Por qué:** En la mayoría de jurisdicciones es obligatorio anunciar al inicio "esta llamada puede ser grabada con fines de calidad". Sin esto las grabaciones no tienen valor probatorio.
- **Implementación:** audio configurable por empresa que se reproduce automáticamente al inicio de toda llamada con grabación activa, antes de IVR/cola.

### 1.3. Calendario de festivos / Holidays
- **Por qué:** `business_hours` por sí sola no maneja festivos (que cambian cada año y por país). Debe poder importarse `.ics` o configurarse manualmente.
- **Implementación:** tabla `holidays` con company_id, fecha, nombre, país, y respeto en el motor de enrutamiento IVR/cola.

### 1.4. Wrap-up time / ACW (After Call Work)
- **Por qué:** Un agente necesita unos segundos tras colgar para tipificar/tomar notas antes de recibir la siguiente llamada. Es estándar en cualquier ACD serio.
- **Implementación:** `wrap_up_seconds` por cola, estado `agent_status = wrap_up` automático, configurable.

### 1.5. Skills-based routing
- **Por qué:** Más allá de colas, los agentes tienen skills (idioma, producto, nivel). Una llamada se enruta al agente con mejor match de skills.
- **Implementación:** tablas `skills`, `agent_skills`, `queue_skill_requirements`, motor de scoring en el dispatcher.

### 1.6. Time zone por empresa, agente y cliente
- **Por qué:** Sin esto, los reportes y horarios se desalinean en operaciones internacionales.
- **Implementación:** columna `timezone` en `companies`, `users`, `customers` (default desde la empresa).

---

## 2. Calidad de llamada y red (INCLUIDOS)

### 2.1. STUN/TURN configurable
- **Por qué:** WebRTC sin TURN falla detrás de muchos firewalls corporativos. Sin TURN tu producto no funciona en clientes empresariales.
- **Implementación:** `webrtc_settings` por empresa con servidores STUN/TURN, credenciales TURN cifradas.

### 2.2. Métricas de calidad de llamada (MOS, jitter, packet loss, RTT)
- **Por qué:** Cuando un cliente reporta "se escuchaba mal" necesitas datos. Asterisk emite estos eventos, hay que persistirlos.
- **Implementación:** tabla `call_quality_metrics` con muestras periódicas durante la llamada.

### 2.3. Códecs y SRTP por troncal y por extensión
- **Por qué:** Negociación de códecs es la causa #1 de "llamadas mudas". Hay que tener control fino.
- **Implementación:** ya está en `sip_trunks.codecs`, agregué `srtp_mode` ENUM('disabled','optional','required').

---

## 3. Outbound profesional (INCLUIDOS)

### 3.1. Dialer modes: manual, preview, progressive, predictive
- **Por qué:** El doc menciona "outbound dialer" genérico. Una operación seria diferencia 4 modos: manual (agente marca), preview (agente ve la ficha y decide), progressive (sistema marca cuando agente está libre, 1:1), predictive (sistema marca antes de tener agente libre, ratio configurable).
- **Implementación:** ENUM en `campaigns.dialer_mode` y motor distinto por modo.

### 3.2. AMD (Answering Machine Detection)
- **Por qué:** Para no quemar minutos del agente con buzones de voz. Asterisk tiene `AMD()`.
- **Implementación:** `campaigns.amd_enabled` + acción configurable cuando es buzón (colgar / dejar mensaje TTS / enviar a IVR).

### 3.3. Rate limiting de llamadas salientes por troncal
- **Por qué:** Las troncales tienen capacidad limitada. Si la rebasas, fallan llamadas.
- **Implementación:** `sip_trunks.max_concurrent_calls`, contador en Redis.

---

## 4. Omnicanal y notificaciones (INCLUIDOS BASE)

### 4.1. Email transaccional
- **Por qué:** El doc solo menciona SMS. Pero confirmaciones de cuenta, reset de password, alertas a admins, reportes programados → necesitan email. Es muy raro.
- **Implementación:** `email_providers` (SMTP genérico, SendGrid, SES, etc.), `email_templates`, `email_logs`.

### 4.2. Plantillas de notificación in-app
- **Por qué:** Notificar a usuarios dentro del sistema (callback asignado, llamada perdida, etc.).
- **Implementación:** ya está `notifications` en la spec, le añadí soporte para in-app + push web.

### 4.3. Push notifications web (PWA)
- **Por qué:** Para que el agente reciba alerta de llamada incluso si la pestaña está en segundo plano.
- **Implementación:** Service Worker + Web Push API.

---

## 5. IA avanzada (INCLUIDOS)

### 5.1. STT en tiempo real (live transcription)
- **Por qué:** El supervisor puede ver la transcripción mientras escucha. La IA puede actuar sobre lo que se dice (alertar palabras prohibidas, sentimiento).
- **Implementación:** `ai_providers` extendido con capability `realtime_stt`, integraciones Whisper, Deepgram, Google Speech-to-Text.

### 5.2. Análisis de sentimiento en vivo
- **Por qué:** Alerta al supervisor si el cliente está enojado para que entre a ayudar.
- **Implementación:** chunks de transcripción → AI provider → `call_sentiment_events`.

### 5.3. Knowledge Base / RAG por empresa
- **Por qué:** Bots IA que respondan en base a documentos de la empresa (manuales, FAQs). Sin esto los bots inventan.
- **Implementación:** tablas `kb_documents`, `kb_chunks` con embeddings (pgvector o servicio externo). Tool `consultar_base_conocimiento`.

### 5.4. Detección de palabras clave / compliance
- **Por qué:** Detectar que el agente dijo el script obligatorio, o que NO dijo cosas prohibidas (insultos, promesas no autorizadas).
- **Implementación:** `compliance_rules` + chequeo durante/post llamada vía LLM.

---

## 6. Seguridad y privacidad (INCLUIDOS)

### 6.1. PCI DSS — DTMF masking para pagos por teléfono
- **Por qué:** Si el cliente dicta su tarjeta por DTMF mientras se graba, estás en violación de PCI. El sistema debe pausar grabación durante el ingreso.
- **Implementación:** acción `pause_recording_for_dtmf` en IVR y comando manual del agente "iniciar pago seguro".

### 6.2. Retención y borrado automático (GDPR / Habeas Data)
- **Por qué:** Por ley hay que poder borrar datos de un cliente que lo solicite y aplicar políticas de retención.
- **Implementación:** `data_retention_policies` por empresa (días para llamadas, grabaciones, mensajes IA), job de purga, endpoint "right to be forgotten".

### 6.3. Cifrado de campos PII en BD
- **Por qué:** Si hay leak, los datos sensibles (documento, email, teléfonos) salen cifrados.
- **Implementación:** columnas con sufijo `_encrypted` para PII opcional, master key en `.env`.

### 6.4. IP allowlist por empresa para login
- **Por qué:** Empresas grandes lo exigen para sus contact centers internos.
- **Implementación:** `company_settings.allowed_login_ips` (CIDR list).

### 6.5. SSO / SAML (opcional, post-MVP)
- **Por qué:** Empresas medianas lo piden. Se integra con Okta, Azure AD, Google Workspace.
- **Implementación:** preparado el `User.sso_provider`, `sso_external_id`. Implementación detallada en fase 24+.

---

## 7. Operativa SaaS (INCLUIDOS)

### 7.1. Onboarding self-service
- **Por qué:** Para vender, una empresa debe poder registrarse sola sin esperar a un humano.
- **Implementación:** wizard de onboarding (registro → empresa → primera troncal → primer agente → llamada de prueba), `super_admin` puede activar/desactivar este modo.

### 7.2. Trial / período de prueba
- **Por qué:** Estándar SaaS. La spec menciona `subscriptions` pero no `trial_ends_at`.
- **Implementación:** columnas `trial_ends_at`, `is_trial` en `subscriptions`, banner de trial en frontend.

### 7.3. Webhooks de billing
- **Por qué:** Si integras Stripe / MercadoPago / Wompi, necesitas recibir webhooks de pago.
- **Implementación:** `billing_webhook_endpoints` + handler genérico + provider-specific verifiers.

### 7.4. Feature flags por plan
- **Por qué:** "Plan básico" no incluye IA, "Plan pro" sí. Hay que poder controlarlo sin re-deploy.
- **Implementación:** `plans.features` JSON con capability flags. Guard `RequireFeatureGuard`.

### 7.5. Idiomas (i18n) desde el día 1
- **Por qué:** Vender a Latam y EEUU sin reestructurar después. El backend retorna keys, el frontend traduce.
- **Implementación:** `next-intl`, archivos de locale `es-CO`, `es-MX`, `en-US`, `pt-BR`. Mensajes IA y prompts también traducidos.

---

## 8. Operación técnica (INCLUIDOS)

### 8.1. Failover de troncales SIP
- **Por qué:** Si la troncal primaria cae, las llamadas deben rutearse por la secundaria automáticamente.
- **Implementación:** `sip_trunks.priority`, `sip_trunks.fallback_trunk_id`, dialplan en Asterisk con grupos.

### 8.2. Health monitoring de troncales
- **Por qué:** OPTIONS ping cada N segundos. Si la troncal no responde, marcarla `error` y disparar alerta.
- **Implementación:** worker en backend que consume `PJSIPShowEndpoints` cada 30s.

### 8.3. Multi-region storage
- **Por qué:** Ley de "datos en el país" (Colombia, Brasil). Las grabaciones deben poder ir a buckets diferentes según jurisdicción.
- **Implementación:** `storage_providers` ya soporta esto, lo formalicé como `region` en cada provider.

### 8.4. Dead-letter queue para webhooks fallidos
- **Por qué:** Si el endpoint del cliente está caído, los reintentos deben tener tope y luego ir a DLQ revisable manualmente.
- **Implementación:** `webhook_delivery_logs.status` ENUM extendido con `dead_letter`, `manual_retry`.

### 8.5. CDC / outbox pattern para eventos
- **Por qué:** Para que los webhooks NO se pierdan ante un crash. Patrón outbox: la transacción que crea el evento también escribe en `outbox`, un worker la procesa.
- **Implementación:** tabla `event_outbox`.

---

## 9. UX agente (INCLUIDOS)

### 9.1. Atajos de teclado
- **Por qué:** Un agente que hace 100+ llamadas al día no quiere usar mouse. F1=contestar, F2=colgar, F3=hold, F4=transfer, etc.
- **Implementación:** servicio frontend `useShortcuts` con configuración por usuario.

### 9.2. Tipo de pausa configurable y cronometrada
- **Por qué:** "Pausa" es ambiguo. Hay pausas que cuentan para productividad y pausas que no (almuerzo, reunión, baño).
- **Implementación:** `pause_reasons` configurable por empresa, `agent_status_logs.pause_reason_id`, alertas si excede tiempo máximo.

### 9.3. Disposiciones / tipificaciones jerárquicas
- **Por qué:** "Resultado: venta" → "Tipo: producto X" → "Subtipo: plan Y". Sin jerarquía no hay buenos reportes.
- **Implementación:** `call_dispositions` con `parent_id` para árbol.

### 9.4. Modo "no molestar" individual del agente
- **Por qué:** Para terminar una llamada compleja sin que entren más.
- **Implementación:** estado `do_not_disturb`, configurable por supervisor si lo permite.

---

## 10. Operación del sistema

### 10.1. Logs estructurados (JSON) con request_id
- **Por qué:** Para troubleshooting. Cada request lleva un `X-Request-Id` que se propaga en todos los logs.
- **Implementación:** `pino` en NestJS con `nestjs-pino`, middleware de request id.

### 10.2. Métricas Prometheus
- **Por qué:** Sin métricas operativas no puedes operar producción.
- **Implementación:** `/metrics` endpoint con métricas de llamadas activas, latencia API, error rate, DB pool, etc.

### 10.3. Tracing distribuido (OpenTelemetry)
- **Por qué:** Cuando una llamada pasa por Asterisk → backend → IA → webhook, hay que poder seguirla.
- **Implementación:** OTel SDK preparado, exportable a Jaeger/Tempo.

---

## Resumen

Todos estos elementos **ya están reflejados** en el esquema MySQL, en las interfaces del backend y/o documentados en `docs/`. No alteran tu visión original, solo la completan para que el producto sea realmente vendible y operable.

Si alguno te parece innecesario o quieres discutirlo, lo discutimos antes de implementar las fases avanzadas.
