# Diseño IVR

## 1. Modelo

```
ivr_menus (1) ─────< ivr_options (N)        opciones DTMF
ivr_menus (N) ───── ivr_audio_files (varias) bienvenida/menú/timeout/inválido/fuera-horario
ivr_menus (1) ─────< ivr_logs (N)            histórico de selecciones
```

## 2. Builder visual (frontend, Fase 9)

UI tipo "flowchart" con nodos:
- **Start** (audio bienvenida + menú)
- **Option** (tecla DTMF → destino)
- **Destination** (queue, agent, bot, ivr anidado, voicemail, webhook, hangup, tool)
- **Fallback** (timeout / inválido / fuera de horario)

Se serializa al backend como rows en `ivr_menus` + `ivr_options` (con `parent_ivr_menu_id` para anidados).

## 3. Subida de audios

- Endpoint `POST /api/ivr/audio` (multipart, max 10 MB).
- Backend valida formato (MP3, WAV, OGG) y opcionalmente convierte a WAV mono 8kHz/16kHz para Asterisk.
- Se guarda en `storage_provider` configurado para la empresa (`local` por defecto).
- Genera `transcription` opcional vía AI provider (capability `stt`) para búsquedas y reportes.

## 4. Ejecución del IVR

Cuando una llamada llega a un IVR (decidido por DID o por dispatcher):

1. Backend ARI: `playback(welcome_audio_id)` → espera fin de audio.
2. Backend ARI: `playback(menu_audio_id)` → espera fin.
3. Backend captura DTMF con timeout (`timeout_seconds`).
4. Si captura coincide con una opción activa → ejecuta destino.
5. Si timeout → según `on_timeout`: repetir / hangup / goto / transfer.
6. Si tecla inválida → `on_invalid`: repetir / hangup / goto / transfer.
7. Si excede `max_attempts` → `fallback_destination`.

Cada interacción se registra en `ivr_logs` (atributos: dtmf_pressed, attempt, outcome).

## 5. Horarios

`ivr_menus.business_hours_id` define cuándo el IVR está activo:
- Dentro de horario: comportamiento normal.
- Fuera de horario: reproduce `out_of_hours_audio_id` y termina con un destino configurado (buzón, bot 24/7, etc.).
- Festivos: tabla `holidays` se considera fuera de horario.

## 6. Destinos soportados

| Tipo | Acción |
|---|---|
| `queue` | Encola en `queue_id`, asigna posición |
| `agent` | Llama directo a una extensión específica |
| `bot` | Bridge a canal de bot IA |
| `ivr` | Submenú |
| `voicemail` | Buzón con `mail_to_email` opcional |
| `webhook` | POST al endpoint, espera 200 con `{action,destination}` para continuar |
| `hangup` | Cuelga |
| `tool` | Ejecuta una `ai_tool` con DTMF como input (e.g. consultar saldo) |
| `external` | Reenrutar a número externo |

## 7. TTS dinámico (opcional)

En lugar de subir audio, el admin puede escribir texto y elegir voz. El backend:
- Llama al provider IA con capability `tts`.
- Cachea el audio resultante en `ivr_audio_files` con `purpose=custom`.
- Reutiliza si el texto/voz/idioma no cambia.

Útil para mensajes que cambian frecuentemente.

## 8. Reportes

Endpoint `/api/reports/ivr/usage`:
- Top opciones marcadas
- % timeout / inválido por menú
- Tiempo medio en IVR
- Distribución de destinos finales

## 9. Eventos

`ivr.entered`, `ivr.option_selected`, `ivr.timeout`, `ivr.invalid_input`, `ivr.exited`.
