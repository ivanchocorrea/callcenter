# Diseño Webhooks (outbound)

## 1. Concepto

El cliente (la empresa que usa el SaaS) configura URLs en `webhook_endpoints` para recibir notificaciones HTTP cuando ocurren eventos en el sistema. El SaaS firma cada request con HMAC-SHA256 y reintenta con backoff exponencial.

## 2. Patrón outbox

Para no perder eventos ante crashes, usamos el patrón **outbox**:

```
Operación de negocio (TX)
   ├─ INSERT INTO calls ...
   └─ INSERT INTO event_outbox (event_type, payload, status='pending')
      ↑ misma transacción
   COMMIT

WebhookDispatcher (worker)
   ├─ SELECT * FROM event_outbox WHERE status='pending' LIMIT 100
   ├─ Para cada evento:
   │   ├─ Encontrar endpoints de la empresa suscritos al event_type
   │   ├─ Para cada endpoint:
   │   │   ├─ Crear webhook_delivery_logs(status='pending')
   │   │   └─ POST al endpoint con firma
   │   │       ├─ 2xx → status='sent'
   │   │       └─ otherwise → calcular next_retry_at o dead_letter
   └─ MARK event_outbox status='sent'
```

## 3. Headers del request enviado

```
POST https://cliente.com/webhook
Content-Type: application/json
User-Agent: CallCenter-NODOE/0.1
X-Event: call.ended
X-Event-Id: 928374
X-Company-Id: 42
X-Timestamp: 1745878800
X-Signature: hmac-sha256=<hex>
```

`X-Signature` se calcula como:
```
HMAC_SHA256(secret, "<X-Timestamp>.<body_raw>")
```

El receptor debe:
1. Verificar `X-Timestamp` no más viejo que 5 min (anti-replay).
2. Recalcular y comparar firma con `crypto.timingSafeEqual`.

## 4. Eventos disponibles

(Lista no exhaustiva — ver `webhooks/EVENTS.md` cuando se implemente Fase 13)

| Categoría | Eventos |
|---|---|
| Calls | `call.started`, `call.incoming`, `call.ringing`, `call.answered`, `call.ended`, `call.abandoned`, `call.transferred`, `call.recorded` |
| Queues | `queue.entered`, `queue.position_changed`, `queue.abandoned`, `queue.wait_time_exceeded` |
| Agents | `agent.online`, `agent.offline`, `agent.paused`, `agent.available`, `agent.disconnected` |
| Recordings | `recording.created`, `recording.deleted`, `recording.accessed` |
| SMS | `sms.sent`, `sms.delivered`, `sms.failed`, `sms.received` |
| Callbacks | `callback.created`, `callback.completed`, `callback.failed` |
| AI | `ai.summary.created`, `ai.handoff_to_human`, `ai.tool_executed`, `ai.failed` |
| Customers | `customer.created`, `customer.updated`, `customer.tagged` |
| Reports | `report.generated` |
| Trunks | `trunk.unreachable`, `trunk.recovered` |

## 5. Reintentos

Backoff por defecto: `[0, 30, 300, 1800, 7200, 43200]` segundos (immediate, 30s, 5min, 30min, 2h, 12h). Total = 6 intentos. Después → `status = 'dead_letter'`.

`webhook_endpoints.consecutive_failures` se incrementa en cada fallo. Si supera 50 sin un éxito → endpoint queda **deshabilitado automáticamente** y se notifica al admin de la empresa por email.

## 6. Dead-letter retry manual

Endpoint `POST /api/webhooks/deliveries/{id}/retry` permite a un admin reintentar manualmente un delivery en `dead_letter`. Cambia status a `manual_retry` y lo encola.

## 7. Logs y debugging

`webhook_delivery_logs` guarda:
- `request_payload` (lo que se envió)
- `response_body` (los primeros 64 KB de la respuesta)
- `http_status`, `duration_ms`, `error_message`

UI muestra una vista tipo Stripe Webhook Logs con filtros por endpoint, status, fecha, evento.

## 8. Botón "probar webhook"

En la UI de configuración, un botón envía un evento `webhook.test` al endpoint con payload de ejemplo y muestra el resultado en vivo. Útil para validar que el cliente está recibiendo correctamente.

## 9. Idempotencia

El receptor debe ser **idempotente**: si recibe el mismo `X-Event-Id` dos veces (por reintentos), no debe procesar dos veces. Documentamos esto en la guía pública de integración.

## 10. Rate limiting al cliente

Si el endpoint del cliente responde muy lento (> 10 s) o devuelve 429, el dispatcher reduce automáticamente la frecuencia para ese endpoint (token bucket). Esto evita saturar al cliente.

## 11. Seguridad

- Solo URLs HTTPS (excepto en desarrollo).
- DNS resolution se hace al momento de enviar (no se cachea más de 60 s).
- IPs privadas (RFC 1918) bloqueadas para evitar SSRF dentro del cluster.
