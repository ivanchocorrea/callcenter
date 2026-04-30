# Diseño WebRTC

## 1. Stack

- **Cliente**: SIP.js v0.21+ corriendo en el navegador del agente.
- **Servidor**: Asterisk con `transport-wss` en puerto 8089 (TLS obligatorio en producción).
- **Señalización**: WSS (WebSocket Secure).
- **Medios**: SRTP/DTLS, ICE para NAT traversal con STUN/TURN.

## 2. Configuración Asterisk

`pjsip.conf` (ver archivo real en `asterisk/etc/pjsip.conf`):

```ini
[transport-wss]
type = transport
protocol = wss
bind = 0.0.0.0:8089
```

Endpoint del agente generado por backend al crear el agente:

```ini
[ext_<agent_id>]
type = endpoint
context = from-internal
disallow = all
allow = opus,ulaw,alaw
webrtc = yes
use_avpf = yes
media_encryption = dtls
dtls_verify = fingerprint
dtls_setup = actpass
ice_support = yes
rtcp_mux = yes
direct_media = no
auth = ext_<agent_id>
aors = ext_<agent_id>
```

## 3. Provisioning del agente

Cuando un agente se loguea en el frontend:

1. Frontend pide `GET /api/webrtc/credentials` → backend responde:
```json
{
  "sip_uri": "sip:1001@callcenter.example.com",
  "sip_password": "<one-time encrypted token>",
  "wss_url": "wss://sip.example.com:8089/ws",
  "ice_servers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "turn:turn.example.com", "username": "...", "credential": "..." }
  ]
}
```
2. El password puede ser un **token efímero** (15 min) en lugar del secret real, para minimizar exposición.
3. Frontend instancia `UserAgent` de SIP.js y registra.

## 4. Captura de audio

```javascript
const constraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 16000,
  },
  video: false,
};
const stream = await navigator.mediaDevices.getUserMedia(constraints);
```

UI muestra selector de dispositivos (input/output) — guarda preferencia en `localStorage`.

## 5. STUN / TURN

- **STUN** (gratis, Google): suficiente para 90% de los casos.
- **TURN** (relay): obligatorio para clientes detrás de NAT simétrico o firewalls corporativos restrictivos. Coturn auto-hospedado o servicio managed (Twilio Network Traversal, Xirsys).
- Configurable por empresa en `webrtc_settings` con credenciales TURN cifradas.

## 6. Dispositivos y devicestate

El backend escucha eventos AMI/ARI del dispositivo:
- `DeviceStateChange` → `agent.status_changed` (Idle, InUse, Ringing, OnHold).
- Refleja en `agent_status_logs` y `agents.status` (cache Redis).

## 7. Seguridad

- TLS obligatorio en producción (sin TLS = bloqueado por navegador).
- DTLS-SRTP para medios.
- Tokens efímeros para password SIP (rotados a cada login).
- IP allowlist por empresa para WSS (configurable).
- Detección de "fingerprint mismatch" → corta llamada.

## 8. Calidad

Frontend usa `RTCPeerConnection.getStats()` cada 5 s y publica al backend:
```json
{ leg:"caller", mos:4.2, jitter_ms:12, rtt_ms:80, packet_loss_pct:0.5, codec:"opus" }
```
Backend persiste en `call_quality_metrics` y dispara alertas si MOS < 3.5 sostenido.

## 9. Atajos de teclado (opcional)

- F1 = contestar
- F2 = colgar
- F3 = hold/resume
- F4 = transferir (abre modal)
- F8 = mute mic
- ESC = cerrar diálogos

Configurables por usuario en preferencias.

## 10. Reconexión

- Si WSS se cae, SIP.js intenta reconectar con backoff exponencial.
- UI muestra banner amarillo "Reconectando…".
- Si falla > 30 s, marca al agente offline y emite `agent.disconnected`.

## 11. Limitaciones conocidas

- iOS Safari requiere HTTPS y permite WebRTC, pero el manejo de audio en background es limitado. Se recomienda Chrome/Edge en desktop para producción.
- Algunas extensiones de navegador (uBlock con listas agresivas) bloquean WSS — documentar al usuario final.
