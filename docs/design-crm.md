# Diseño CRM

## 1. Modelo

```
customers (1) ─< customer_phones (N)
customers (1) ─< customer_notes (N)
customers (N) ─< customer_tag_assignments >─ customer_tags (N)
customers (1) ─< customer_interactions (N)   ← timeline unificado
customers (1) ─< tickets (N)
customers (1) ─< appointments (N)
```

`customer_interactions` es la **tabla espina dorsal**: agrega calls, sms, email, notas, tickets, citas, conversaciones IA, y webhooks recibidos en una sola línea de tiempo por cliente.

## 2. Búsqueda de cliente al recibir llamada

Cuando entra una llamada con `from_number`:

```
Step 1. Lookup en customer_phones (E.164 normalizado)
         └─ Si existe → cargar customer + últimos 10 interactions
Step 2. Si no existe y hay connector configurado:
         └─ Llamar GoogleSheetsConnector.lookup(phone)
         └─ Llamar ExternalApiConnector.lookup(phone)  (si configurado)
Step 3. Mostrar resultado en screen pop del agente
Step 4. Si el connector devolvió datos pero no existía → opcionalmente
         crear customer de forma automática (`auto_create_from_connector`).
```

## 3. Identificación E.164

Todos los teléfonos se normalizan a formato E.164 (`+57...`, `+1...`) antes de:
- Guardar en `customer_phones`
- Buscar
- Llamar

Función `phoneE164(rawNumber, countryDefault)` en `common/utils/phone.ts`. Usa `libphonenumber-js`.

## 4. Importación

Formatos:
- **Excel .xlsx / CSV**: `multipart/form-data` → import_jobs en estado `pending`.
- **Google Sheets**: configurar en `data_connectors` + `google_sheets_configs`.
- **API externa**: configurar URL + auth + paginación.
- **MySQL externo**: configurar connection string.

Flujo:
1. Usuario sube archivo o configura connector.
2. Backend detecta columnas (lee primeras 100 filas).
3. UI muestra **column mapping** con sugerencias automáticas (heurística: "Teléfono"→`primary_phone`, "Nombre"→`full_name`, "Documento"→`document_number`, etc.).
4. Usuario aprueba mapping. Backend valida muestra de filas.
5. Job corre en worker:
   - Para cada fila: validar, normalizar teléfono, dedupe por (`primary_phone` o `document_number`), insertar/actualizar.
   - Errores van a `import_job_rows` con `status='error'`.
6. UI muestra progreso en vivo.
7. Al terminar, descarga reporte de errores en CSV.

## 5. Notas y tipificación

Tipos: `general`, `important`, `followup`, `internal`, `warning`.
- Las `important` y `warning` se muestran en el **screen pop** del agente al recibir llamada.
- Notas internas no son visibles para el cliente en interacciones (futuro: cuando integre WhatsApp por ejemplo).

## 6. Tickets

Modelo simplificado tipo Helpscout:
- Estados: `open`, `in_progress`, `waiting_customer`, `resolved`, `closed`, `cancelled`.
- Asignación a usuarios (`assigned_to`).
- SLA por prioridad (`due_at`).

Integración con calls: cuando un agente crea un ticket durante una llamada, queda referenciado por `tickets.call_id`.

## 7. Citas

`appointments`:
- `start_at` con timezone del cliente (no del sistema).
- Estados: scheduled → confirmed → completed/no_show/rescheduled/cancelled.
- Recordatorios automáticos (24h, 1h antes) vía `automation_rules` + plantillas SMS/email.
- Sincronización opcional con Google Calendar / Outlook (futuro).

## 8. Tags

Etiquetas con color para clasificar clientes (VIP, problemático, prospecto, frío, etc.). Se usan en:
- Búsqueda y filtros
- Reglas de automatización (`automation_conditions`)
- Routing de colas (skill matching)

## 9. Custom fields

`customers.custom_fields` (JSON) permite a cada empresa definir campos propios sin alterar schema:
```json
{ "tipo_cliente": "premium", "vendedor_asignado": 12, "ultima_renovacion": "2025-12-01" }
```
La UI los renderiza dinámicamente leyendo de `company_settings.setting_key='customer_custom_fields_schema'` (JSON Schema).

## 10. Right-to-be-forgotten (GDPR / Habeas Data)

Endpoint `DELETE /api/customers/{id}/forget`:
- Marca `customers.deleted_at` y limpia datos PII (nombre → "BORRADO", phones → hash).
- Conserva `id` para preservar integridad de calls/recordings (solo redacta).
- Loguea en `audit_logs` con `action='customer.forgotten'`.

Política configurable por empresa en `data_retention_policies`.
