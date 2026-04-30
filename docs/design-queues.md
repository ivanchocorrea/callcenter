# Diseño de colas y turnos

## 1. Por qué turnos explícitos

Asterisk `app_queue` mantiene una cola FIFO interna, pero **no expone la posición** al cliente, ni permite anuncios contextualizados ("usted es el #3", "espera 2 minutos"). Por eso modelamos colas en **dos planos**:

1. **Asterisk queue** = donde realmente esperan los canales (medios + bridge).
2. **`queue_calls` (BD) + Redis ZSET** = posición lógica + ETA + estado controlado por el backend.

El backend orquesta ambos.

## 2. Modelo

```
queues (1) ─< queue_agents (N)        miembros estáticos por agente
queues (1) ─< queue_supervisors (N)
queues (1) ─< queue_calls (N)         estado actual de cada llamada
queues (1) ─< queue_position_logs (N) histórico para reportes
```

## 3. Flujo al entrar una llamada

```
1. Backend recibe call.routed_to_queue(queue_id, call_id)
2. INSERT INTO queue_calls (queue_id, call_id, position=NEXT, priority, entered_at=NOW)
3. ZADD queue:{queue_id}:waiting <priority_score> call_id    (Redis)
4. Recalcular position de todas las llamadas (ZRANGE BY SCORE)
5. Calcular estimated_wait_seconds (ver §5)
6. Emitir evento socket queue.entered al supervisor
7. ARI: añadir el canal a la cola Asterisk con QueueAdd / Stasis bridge
8. Si hay agente libre y skill match → app_queue lo asigna
9. Mientras espera: cada N segundos (configurable), backend reproduce
   un audio TTS o pre-grabado anunciando "usted está en la posición X"
```

## 4. Skills-based routing

`queues.required_skills` JSON: `[{skill_id:1, min:3}, {skill_id:5, min:2}]`.
- En queue_agents, los miembros que cumplen TODOS los `min` proficiency son elegibles.
- Score de matching = suma de `(agent_proficiency - min)` para skills requeridas + 100.
- El agente con mayor score (y disponible) recibe la llamada.
- Si nadie cumple → fallback a estrategia base (rrmemory/leastrecent).

## 5. Cálculo de ETA

```
avg_handling_time = SELECT AVG(talk_seconds + wrap_up_seconds)
                    FROM calls WHERE queue_id=? AND ended_at > NOW() - INTERVAL 1 HOUR
agents_free_or_wrap = COUNT() agentes con status in ('available','wrap_up')
eta_seconds = (position * avg_handling_time) / max(1, agents_free_or_wrap)
```

Se actualiza en cada `position_changed`.

## 6. Anuncio de posición al cliente

Configurable por cola:
- `position_announce_enabled`
- `position_announce_interval` (segundos)
- `estimated_wait_announce_enabled`
- Voz TTS o audios pre-grabados con plantilla:
  - `"Usted está en la posición {position}"`
  - `"Su tiempo estimado de espera es {eta_minutes} minutos"`

Implementación: cada N segundos el backend ejecuta `ARI playback` sobre el canal del cliente con el audio sintetizado/cacheado.

## 7. Abandono

Si el cliente cuelga antes de ser atendido:
1. Asterisk dispara `Hangup` event con `linkedid = queue_call.unique_id`.
2. Backend marca `queue_calls.status = abandoned`, `abandoned_at = NOW()`, `abandon_position`.
3. Emite `call.abandoned` y `queue.abandoned` (webhooks).
4. Si la cola tiene `sms_on_abandon_enabled = true`: enviar SMS al `from_number`.
5. Si `callback_offer_enabled = true`: crear `callback_request`.
6. Notificar al supervisor.

## 8. Callback automático

`callback_requests`:
- Estados: `pending → scheduled → in_progress → completed | failed | cancelled`.
- Worker que cada minuto consulta requests pendientes con `preferred_at <= NOW()`.
- Cuando hay agente disponible en la cola objetivo → originar llamada al cliente.
- Si el cliente contesta, el agente atiende; si no contesta tras N intentos, falla.

## 9. Wrap-up (ACW)

Tras colgar una llamada en cola, el agente queda automáticamente en estado `wrap_up` durante `queues.wrap_up_seconds`. Durante ese tiempo:
- No recibe nuevas llamadas.
- Puede tomar notas / tipificar.
- Al terminar el timer, vuelve a `available` (a menos que el agente lo extienda).

## 10. Supervisor en vivo

Endpoint WS namespace `/co/{company_id}` room `queue:{queue_id}`:
- Eventos: `queue.entered`, `queue.position_changed`, `queue.answered`, `queue.abandoned`.
- `agent.status_changed` (filtrable por cola).
- KPIs en vivo: total esperando, ETA medio, agentes online, nivel de servicio (% atendidas en < X seg).

Acciones del supervisor:
- Escuchar (`Spy`)
- Susurrar (`Whisper`) — solo el agente lo oye
- Entrar (`Barge`) — los tres se oyen
- Forzar pausa de agente
- Mover llamada de cola

## 11. Eventos

`queue.created`, `queue.updated`, `queue.deleted`, `queue.entered`, `queue.position_changed`, `queue.answered`, `queue.abandoned`, `queue.wait_time_exceeded`, `queue.callback_requested`.
