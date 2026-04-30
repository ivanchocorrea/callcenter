# Migraciones MySQL

Las migraciones se cargan en orden alfabético al iniciar el contenedor MySQL gracias al volumen `./db/migrations:/docker-entrypoint-initdb.d`.

| Archivo | Contenido |
|---|---|
| `001_core_tenants.sql` | plans, companies, subscriptions, company_settings, business_hours, holidays |
| `002_auth_users_roles.sql` | users, roles, permissions, role_permissions, user_roles, refresh_tokens, password_reset_tokens, audit_logs |
| `003_agents_skills.sql` | agents, skills, agent_skills, pause_reasons, agent_status_logs |
| `004_sip_asterisk.sql` | sip_trunks, did_numbers, extensions, webrtc_sessions, asterisk_events |
| `005_calls.sql` | calls, call_events, call_notes, call_dispositions, call_transfers, call_hold_events, call_quality_metrics |
| `006_queues_ivr.sql` | queues, queue_agents, queue_calls, queue_position_logs, ivr_menus, ivr_options, ivr_logs, ivr_audio_files, music_on_hold |
| `007_recordings_storage.sql` | storage_providers, recording_storage_settings, recordings, recording_access_logs, call_recording_events |
| `008_crm_customers.sql` | customers, customer_phones, customer_notes, customer_tags, customer_interactions, tickets, appointments, dnc_lists, import_jobs |
| `009_ai_bots_prompts.sql` | ai_providers, ai_bots, ai_prompts, ai_prompt_versions, ai_tools, ai_conversations, ai_messages, ai_usage_logs, kb_documents |
| `010_connectors_automations.sql` | data_connectors, google_sheets_configs, webhook_endpoints/events/logs, sms/email providers/templates/logs, callback_requests, automation_rules |
| `011_campaigns_quality_billing.sql` | campaigns, campaign_contacts/attempts/results, quality_forms/reviews/scores, usage_counters, invoices, reports, api_keys, notifications, webrtc_settings, retention, event_outbox |
| `999_seed_baseline.sql` | Datos semilla: plans, roles del sistema, permisos, asignación de permisos por rol |

## Convenciones

- Todas las tablas tienen `company_id BIGINT NOT NULL` (excepto las globales: `plans`, `permissions`, `roles` cuando `company_id IS NULL`).
- Charset `utf8mb4` + collation `utf8mb4_unicode_ci`.
- ENUMs preferidos sobre VARCHAR donde el conjunto es fijo.
- Foreign keys con `ON DELETE CASCADE` desde la empresa hacia abajo.
- Índices compuestos `(company_id, fecha)` para queries frecuentes.
- Campos `*_encrypted TEXT` para credenciales cifradas con AES-256-GCM.
- Soft-delete con `deleted_at` solo en `companies`, `users`, `customers`, `recordings`.

## Reseteo total (DEV)

```bash
docker-compose down -v
docker-compose up -d mysql
# (las migraciones se ejecutan automáticamente)
```

## Migraciones futuras

A partir de aquí, cada cambio de schema va en archivos numerados crecientes (`012_*.sql`, `013_*.sql`, etc.). Mantener orden alfabético = orden cronológico.
