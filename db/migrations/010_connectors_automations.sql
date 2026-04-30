-- =====================================================================
--  010_connectors_automations.sql
--  Data connectors, automations, webhooks, sms, email, callbacks
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ---------- data_connectors -----------
CREATE TABLE IF NOT EXISTS data_connectors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    connector_type ENUM('google_sheets','external_api','mysql_external','postgres_external','webhook') NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    config JSON NOT NULL,                      -- url, query, sheet_id, etc.
    is_read_only BOOLEAN NOT NULL DEFAULT TRUE,
    sync_interval_seconds INT NULL,            -- null = on demand
    last_sync_at TIMESTAMP NULL,
    last_sync_status ENUM('ok','error','running') NULL,
    last_sync_error TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_dc_slug (company_id, slug),
    CONSTRAINT fk_dc_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- connector_credentials -----------
CREATE TABLE IF NOT EXISTS connector_credentials (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    connector_id BIGINT NOT NULL,
    credential_type ENUM('api_key','oauth2','basic','bearer','custom') NOT NULL,
    value_encrypted TEXT NOT NULL,
    expires_at TIMESTAMP NULL,
    refresh_token_encrypted TEXT NULL,
    metadata JSON NULL,
    KEY idx_cc_connector (connector_id),
    CONSTRAINT fk_cc_connector FOREIGN KEY (connector_id) REFERENCES data_connectors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- google_sheets_configs -----------
CREATE TABLE IF NOT EXISTS google_sheets_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    connector_id BIGINT NOT NULL,
    spreadsheet_id VARCHAR(120) NOT NULL,
    sheet_name VARCHAR(120) NOT NULL,
    range_a1 VARCHAR(80) NULL,
    column_mapping JSON NOT NULL,              -- {phone:"A", name:"B", ...}
    mode ENUM('read','read_write') NOT NULL DEFAULT 'read',
    purpose ENUM('customer_lookup','bot_data','import','export','sync') NOT NULL DEFAULT 'customer_lookup',
    sync_interval_seconds INT NULL,
    last_sync_at TIMESTAMP NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    KEY idx_gsc_connector (connector_id),
    CONSTRAINT fk_gsc_connector FOREIGN KEY (connector_id) REFERENCES data_connectors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- webhook_endpoints -----------
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    secret_encrypted TEXT NOT NULL,            -- HMAC secret
    events JSON NOT NULL,                      -- ["call.ended","queue.abandoned"]
    headers JSON NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    max_retries INT NOT NULL DEFAULT 6,
    retry_backoff_seconds JSON NULL,           -- [0,30,300,1800,7200,43200]
    timeout_ms INT NOT NULL DEFAULT 10000,
    last_success_at TIMESTAMP NULL,
    last_failure_at TIMESTAMP NULL,
    consecutive_failures INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_we_company (company_id),
    CONSTRAINT fk_we_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- webhook_events (event outbox) — sugerencia añadida -----------
CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    payload JSON NOT NULL,
    related_resource_type VARCHAR(60) NULL,
    related_resource_id VARCHAR(60) NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_we_event (event_type, occurred_at),
    KEY idx_we_company (company_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- webhook_delivery_logs -----------
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    endpoint_id BIGINT NOT NULL,
    event_id BIGINT NOT NULL,
    attempt INT NOT NULL DEFAULT 1,
    status ENUM('pending','sent','failed','dead_letter','manual_retry') NOT NULL DEFAULT 'pending',
    http_status INT NULL,
    request_payload LONGTEXT NULL,
    response_body TEXT NULL,
    error_message TEXT NULL,
    next_retry_at TIMESTAMP NULL,
    sent_at TIMESTAMP NULL,
    duration_ms INT NULL,
    KEY idx_wdl_endpoint (endpoint_id, status),
    KEY idx_wdl_event (event_id),
    CONSTRAINT fk_wdl_endpoint FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    CONSTRAINT fk_wdl_event FOREIGN KEY (event_id) REFERENCES webhook_events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- sms_providers -----------
CREATE TABLE IF NOT EXISTS sms_providers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    provider_type ENUM('twilio','generic_http','vonage','plivo','aws_sns') NOT NULL,
    name VARCHAR(150) NOT NULL,
    config JSON NULL,
    api_key_encrypted TEXT NULL,
    api_secret_encrypted TEXT NULL,
    sender_id VARCHAR(60) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY uniq_sp_slug (company_id, slug),
    CONSTRAINT fk_smsp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- sms_templates -----------
CREATE TABLE IF NOT EXISTS sms_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,                     -- soporta {{variables}}
    variables JSON NULL,
    purpose ENUM('abandon','callback','survey','reminder','manual','custom') NOT NULL DEFAULT 'custom',
    locale VARCHAR(10) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY uniq_st_slug (company_id, slug),
    CONSTRAINT fk_st_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- sms_logs -----------
CREATE TABLE IF NOT EXISTS sms_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    provider_id BIGINT NULL,
    template_id BIGINT NULL,
    customer_id BIGINT NULL,
    call_id BIGINT NULL,
    direction ENUM('outbound','inbound') NOT NULL,
    to_number VARCHAR(40) NOT NULL,
    from_number VARCHAR(40) NULL,
    body TEXT NOT NULL,
    status ENUM('queued','sent','delivered','failed','received') NOT NULL DEFAULT 'queued',
    external_id VARCHAR(150) NULL,
    error_message TEXT NULL,
    cost DECIMAL(10,4) NULL,
    sent_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_smsl_company (company_id, created_at),
    KEY idx_smsl_to (to_number),
    KEY idx_smsl_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- email_providers — sugerencia añadida -----------
CREATE TABLE IF NOT EXISTS email_providers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    provider_type ENUM('smtp','sendgrid','ses','mailgun','postmark','generic_http') NOT NULL,
    name VARCHAR(150) NOT NULL,
    config JSON NULL,
    api_key_encrypted TEXT NULL,
    from_email VARCHAR(180) NOT NULL,
    from_name VARCHAR(150) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY uniq_ep_slug (company_id, slug),
    CONSTRAINT fk_ep_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    html_body LONGTEXT NULL,
    text_body LONGTEXT NULL,
    variables JSON NULL,
    locale VARCHAR(10) NULL,
    purpose ENUM('verification','reset','notification','report','custom') NOT NULL DEFAULT 'custom',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY uniq_et_slug (company_id, slug),
    CONSTRAINT fk_et_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    provider_id BIGINT NULL,
    template_id BIGINT NULL,
    user_id BIGINT NULL,
    customer_id BIGINT NULL,
    to_email VARCHAR(180) NOT NULL,
    from_email VARCHAR(180) NOT NULL,
    subject VARCHAR(255) NULL,
    status ENUM('queued','sent','delivered','bounced','failed','complained') NOT NULL DEFAULT 'queued',
    external_id VARCHAR(150) NULL,
    error_message TEXT NULL,
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_el_company (company_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- callback_requests -----------
CREATE TABLE IF NOT EXISTS callback_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    customer_id BIGINT NULL,
    queue_id BIGINT NULL,
    original_call_id BIGINT NULL,
    callback_call_id BIGINT NULL,
    phone VARCHAR(40) NOT NULL,
    customer_name VARCHAR(200) NULL,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    preferred_at TIMESTAMP NULL,
    priority INT NOT NULL DEFAULT 0,
    status ENUM('pending','scheduled','in_progress','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    last_attempt_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    failure_reason VARCHAR(255) NULL,
    metadata JSON NULL,
    KEY idx_cb_company_status (company_id, status),
    KEY idx_cb_phone (phone),
    CONSTRAINT fk_cb_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- automation_rules -----------
CREATE TABLE IF NOT EXISTS automation_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    trigger_event VARCHAR(80) NOT NULL,        -- 'call.abandoned', 'queue.wait_time_exceeded', etc.
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INT NOT NULL DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_ar_slug (company_id, slug),
    CONSTRAINT fk_ar_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automation_conditions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_id BIGINT NOT NULL,
    field_path VARCHAR(255) NOT NULL,          -- 'queue.id', 'customer.is_vip'
    operator ENUM('eq','neq','gt','lt','gte','lte','in','not_in','contains','matches') NOT NULL,
    value JSON NULL,
    sort_order INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_ac_rule FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automation_actions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_id BIGINT NOT NULL,
    action_type ENUM(
        'send_sms','send_email','create_callback','send_webhook',
        'transfer_to_ai','transfer_to_queue','notify_supervisor',
        'create_ticket','generate_ai_summary','tag_customer','custom_http'
    ) NOT NULL,
    config JSON NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_aa_rule FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS automation_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    rule_id BIGINT NOT NULL,
    triggered_by_event_id BIGINT NULL,
    matched BOOLEAN NOT NULL DEFAULT FALSE,
    actions_executed INT NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_al_rule (rule_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
