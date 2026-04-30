-- =====================================================================
--  999_seed_baseline.sql
--  Datos semilla iniciales: roles del sistema, permisos base, plan free
-- =====================================================================
SET NAMES utf8mb4;

-- ---------- Plan Free + Pro --------------------
INSERT IGNORE INTO plans (slug, name, description, price_monthly, currency, max_users, max_agents, max_concurrent_calls, included_minutes, included_sms, storage_gb, features, is_public)
VALUES
('free', 'Free', 'Plan gratuito de prueba (limitado)', 0.00, 'USD', 3, 2, 2, 100, 50, 1, JSON_OBJECT('ai',false,'webhooks',true,'sms',false,'recordings',true), TRUE),
('pro', 'Pro', 'Plan profesional con IA y SMS', 99.00, 'USD', 25, 25, 25, 5000, 1000, 50, JSON_OBJECT('ai',true,'webhooks',true,'sms',true,'recordings',true,'campaigns',true), TRUE),
('enterprise','Enterprise','Plan empresarial sin límites', 499.00, 'USD', NULL, NULL, NULL, NULL, NULL, NULL, JSON_OBJECT('ai',true,'webhooks',true,'sms',true,'recordings',true,'campaigns',true,'custom_branding',true,'sso',true,'priority_support',true), TRUE);

-- ---------- Roles del sistema (globales, company_id NULL) ----------
INSERT IGNORE INTO roles (company_id, slug, name, description, is_system) VALUES
(NULL, 'super_admin',    'Super Admin',    'Administra el SaaS completo y todas las empresas', TRUE),
(NULL, 'company_admin',  'Company Admin',  'Administra una empresa y todos sus recursos',     TRUE),
(NULL, 'supervisor',     'Supervisor',     'Monitoreo en vivo, reportes y calidad',           TRUE),
(NULL, 'agent',          'Agent',          'Atiende llamadas y gestiona clientes',            TRUE);

-- ---------- Permisos base ----------
INSERT IGNORE INTO permissions (slug, resource, action, description, is_dangerous) VALUES
-- companies
('companies.view',      'companies',  'view',      'Ver empresas',                          FALSE),
('companies.create',    'companies',  'create',    'Crear empresas (super_admin)',          TRUE),
('companies.update',    'companies',  'update',    'Actualizar empresas',                   FALSE),
('companies.delete',    'companies',  'delete',    'Eliminar empresas (super_admin)',       TRUE),
-- users
('users.view',          'users',      'view',      'Ver usuarios',                          FALSE),
('users.create',        'users',      'create',    'Crear usuarios',                        FALSE),
('users.update',        'users',      'update',    'Actualizar usuarios',                   FALSE),
('users.delete',        'users',      'delete',    'Eliminar usuarios',                     TRUE),
-- roles & permissions
('roles.manage',        'roles',      'manage',    'Crear/editar roles y asignar permisos', TRUE),
-- agents
('agents.view',         'agents',     'view',      'Ver agentes',                           FALSE),
('agents.manage',       'agents',     'manage',    'Crear/editar/eliminar agentes',         FALSE),
-- sip / asterisk
('sip.view',            'sip',        'view',      'Ver troncales SIP',                     FALSE),
('sip.manage',          'sip',        'manage',    'Crear/editar/eliminar troncales SIP',   TRUE),
-- calls
('calls.view',          'calls',      'view',      'Ver llamadas',                          FALSE),
('calls.export',        'calls',      'export',    'Exportar llamadas',                     FALSE),
('calls.delete',        'calls',      'delete',    'Eliminar llamadas',                     TRUE),
-- queues
('queues.view',         'queues',     'view',      'Ver colas',                             FALSE),
('queues.manage',       'queues',     'manage',    'Crear/editar colas',                    FALSE),
-- ivr
('ivr.view',            'ivr',        'view',      'Ver IVR',                               FALSE),
('ivr.manage',          'ivr',        'manage',    'Crear/editar IVR',                      FALSE),
-- recordings
('recordings.view',     'recordings', 'view',      'Listar grabaciones',                    FALSE),
('recordings.play',     'recordings', 'play',      'Reproducir grabaciones',                FALSE),
('recordings.download', 'recordings', 'download',  'Descargar grabaciones',                 TRUE),
('recordings.delete',   'recordings', 'delete',    'Eliminar grabaciones',                  TRUE),
-- crm
('customers.view',      'customers',  'view',      'Ver clientes',                          FALSE),
('customers.manage',    'customers',  'manage',    'Crear/editar/eliminar clientes',        FALSE),
('customers.import',    'customers',  'import',    'Importar clientes',                     FALSE),
-- supervisor
('supervisor.live',     'supervisor', 'live',      'Acceso al panel en vivo',               FALSE),
('supervisor.listen',   'supervisor', 'listen',    'Escuchar llamadas',                     TRUE),
('supervisor.whisper',  'supervisor', 'whisper',   'Susurrar a agente',                     TRUE),
('supervisor.barge',    'supervisor', 'barge',     'Entrar a llamada (barge-in)',           TRUE),
-- ai
('ai.view',             'ai',         'view',      'Ver bots y prompts IA',                 FALSE),
('ai.manage',           'ai',         'manage',    'Crear/editar bots, prompts y tools',    TRUE),
-- webhooks
('webhooks.view',       'webhooks',   'view',      'Ver endpoints webhook',                 FALSE),
('webhooks.manage',     'webhooks',   'manage',    'Crear/editar endpoints webhook',        TRUE),
-- sms
('sms.send',            'sms',        'send',      'Enviar SMS',                            FALSE),
('sms.manage',          'sms',        'manage',    'Configurar proveedores SMS',            FALSE),
-- billing
('billing.view',        'billing',    'view',      'Ver facturación',                       FALSE),
('billing.manage',      'billing',    'manage',    'Cambiar plan, métodos de pago',         TRUE),
-- audit
('audit.view',          'audit',      'view',      'Ver logs de auditoría',                 FALSE),
-- public api
('api_keys.manage',     'api_keys',   'manage',    'Crear/revocar API keys',                TRUE);

-- ---------- Asignación de permisos por rol ----------
-- super_admin: TODOS los permisos
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.slug = 'super_admin';

-- company_admin: todos excepto companies.create/delete
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'company_admin'
  AND p.slug NOT IN ('companies.create','companies.delete');

-- supervisor
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'supervisor'
  AND p.slug IN (
    'companies.view','users.view','agents.view',
    'calls.view','calls.export',
    'queues.view','recordings.view','recordings.play',
    'customers.view','customers.manage',
    'supervisor.live','supervisor.listen','supervisor.whisper','supervisor.barge',
    'ai.view','sms.send','audit.view'
  );

-- agent
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'agent'
  AND p.slug IN (
    'calls.view',
    'queues.view',
    'customers.view','customers.manage',
    'sms.send'
  );

-- ---------- Default call dispositions baseline (a ser clonadas por empresa al crearla) ----------
-- (las dispositions reales se crean por empresa; este es un set "plantilla")
-- Nota: los seeds por empresa se generan al ejecutar /companies/bootstrap en el backend.
