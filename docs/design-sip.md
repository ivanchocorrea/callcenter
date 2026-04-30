# Diseño SIP

## 1. Modelo

Una **troncal SIP** (`sip_trunks`) representa la conexión con un proveedor de telefonía (DIDWW, Voxbeam, Twilio, etc.). Cada troncal pertenece a una empresa y se traduce a una configuración PJSIP (`pjsip_endpoint` + `pjsip_aor` + `pjsip_auth`) en Asterisk.

```
sip_trunks (1) ─────< did_numbers (N)
       │
       └─< extensions (N)   (mapeo amistoso a destinos internos)
```

## 2. Modos simple y avanzado

### Simple (UI básica)
Para 95% de los proveedores. Solo pide:
- Nombre, host, puerto (default 5060)
- usuario, password
- transport (UDP/TCP/TLS)
- caller_id

### Avanzado (UI expandida)
Expone todo: `auth_username`, `proxy`, `domain`, `nat_enabled`, `ice_enabled`, `rewrite_contact`, `register_interval`, `keep_alive_interval`, `srtp_mode`, `codecs[]`, `priority`, `fallback_trunk_id`, `max_concurrent_calls`, `advanced_config` (JSON libre).

## 3. Generación de configuración PJSIP

Cuando se crea/edita una troncal:

1. Backend cifra `password` con `EncryptionService` y guarda `password_encrypted`.
2. Backend genera 3 entradas equivalentes a:

```ini
[trunk_<id>]                    ; aor
type = aor
contact = sip:<host>:<port>
qualify_frequency = 30

[trunk_<id>]                    ; auth
type = auth
auth_type = userpass
username = <username>
password = <password_decrypted>

[trunk_<id>]                    ; endpoint
type = endpoint
context = from-trunk
disallow = all
allow = <codecs>
outbound_auth = trunk_<id>
aors = trunk_<id>
direct_media = no
rtp_symmetric = yes
force_rport = yes
rewrite_contact = yes
ice_support = <ice_enabled>
media_encryption = <none|sdes|dtls>
```

3. Backend escribe esta configuración (vía realtime DB o vía archivos rotados + `pjsip reload` por AMI). Recomendamos **realtime** (modulo `res_pjsip_realtime`) para evitar reloads.

## 4. Test de conexión

Botón "Probar" en UI:
- Backend envía un SIP `OPTIONS` al `host:port` con auth `username:password`.
- Espera respuesta 200/401/403 y mide latencia.
- Si 200 → guarda `last_registered_at = NOW()`, status `active`.
- Si 4xx auth → `last_error = "Credenciales rechazadas"`, status `error`.
- Si timeout → status `error`, last_error = "No respondió".

## 5. Failover

Cuando una troncal de outbound recibe un origen y está en `error`, el dialplan de Asterisk lo intenta con el `fallback_trunk_id` automáticamente:

```
exten => _X.,1,Set(TRUNK=trunk_${ARG1})
 same => n,Dial(PJSIP/${EXTEN}@${TRUNK},30,T)
 same => n,GotoIf($["${DIALSTATUS}" = "CHANUNAVAIL" | "${DIALSTATUS}" = "CONGESTION"]?fallback)
 same => n,Hangup()
 same => n(fallback),Set(TRUNK_FB=trunk_${ARG2})
 same => n,Dial(PJSIP/${EXTEN}@${TRUNK_FB},30,T)
```

## 6. Health monitoring

Worker en backend cada 30 s:
- AMI `PJSIPShowEndpoint trunk_<id>` para cada troncal activa.
- Si Status != Available → marca `error`, dispara webhook `trunk.unreachable`.
- Cuando vuelve a estar disponible → webhook `trunk.recovered`.

## 7. Direcciones permitidas

Para evitar abuso, los endpoints de troncales solo aceptan tráfico del IP del proveedor (campo `allowed_ips` en `advanced_config`). Si está vacío, se permite cualquiera (no recomendado en producción).

## 8. SRTP / TLS

Para clientes que requieren cifrado de medios:
- `srtp_mode = required` → solo `media_encryption = sdes` o `dtls`.
- `transport = tls` → puerto 5061, certificados gestionados via Let's Encrypt.

## 9. Caller ID dinámico

Outbound puede sobreescribir el caller_id por:
- Campaña (`campaigns.caller_id`)
- DID asignado al agente
- Caller_id manual del agente (con permiso explícito)

El backend resuelve el caller_id final antes de invocar `Dial()` y lo pasa como `${CALLER_ID_NUM}`.

## 10. Eventos emitidos

| Evento | Cuándo |
|---|---|
| `trunk.created` | Al crear |
| `trunk.updated` | Al modificar |
| `trunk.deleted` | Al borrar |
| `trunk.test.success` / `trunk.test.failed` | Tras probar conexión |
| `trunk.unreachable` / `trunk.recovered` | Health monitor |
