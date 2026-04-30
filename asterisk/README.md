# Asterisk — configuración base

Esta carpeta contiene la configuración mínima para que Asterisk arranque con:
- PJSIP (UDP/TCP/TLS/WSS)
- AMI (puerto 5038, usuario `admin`)
- ARI (puerto 8088, usuario `ariadmin`, app `callcenter-app`)
- Stasis dialplan (toda lógica delegada al backend)

## Cómo funciona

1. Una llamada entrante por una troncal cae en el contexto `from-trunk`.
2. El dialplan invoca `Stasis(callcenter-app, ...)`.
3. El backend NestJS está conectado al ARI vía WebSocket y recibe el evento `StasisStart`.
4. El backend decide qué hacer: tocar IVR, encolar, enviar a agente, derivar a bot IA, colgar fuera de horario, etc.
5. El backend ejecuta acciones vía ARI (continueInDialplan, playback, hold, bridge, snoop, hangup).

## Archivos

| Archivo | Propósito |
|---|---|
| `manager.conf` | Habilita AMI |
| `http.conf` | HTTP server (necesario para ARI/WSS) |
| `ari.conf` | Habilita ARI y define usuario |
| `pjsip.conf` | Transports + plantillas WebRTC |
| `extensions.conf` | Dialplan minimal (delega a Stasis) |
| `rtp.conf` | Rango de puertos RTP + STUN |
| `queues.conf` | Defaults de colas |
| `modules.conf` | Lista módulos a cargar |
| `logger.conf` | Logs |

## Producción

- Generar certificados TLS y habilitar `transport-tls` y `transport-wss` (`tlsenable = yes` en `http.conf`).
- Cambiar todos los `change_me_*` en `manager.conf` y `ari.conf` por valores fuertes que coincidan con `.env`.
- Configurar firewall: SIP (5060/UDP, 5060/TCP, 5061/TLS), WSS (8089/TCP), RTP (10000-20000/UDP).
- Endpoints PJSIP de troncales se generan dinámicamente desde el backend (Fase 3).
