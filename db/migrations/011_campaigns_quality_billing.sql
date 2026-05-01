-- =====================================================================
--  011_campaigns_quality_billing.sql
--  Campañas, calidad, facturación, reportes, API pública, notificaciones
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ---------- campaigns -----------
CREATE TABLE IF NOT EXISTS campaigns (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    campaign_type ENUM('outbound','survey','reminder','collection') NOT NULL,
    dialer_mode ENUM('manual','preview','progressive','predictive') NOT NULL DEFAULT 'preview',
    queue_id BIGINT NULL,
    bot_id BIGINT NULL,
    trunk_id BIGINT NULL,
    caller_id VARCHAR(60) NULL,
    -- ritmo
    max_concurrent_calls INT NOT NULL DEFAULT 1,
    pacing_ratio DECIMAL(3,2) NOT NULL DEFAULT 1.00,    -- predictive ratio
    max_attempts_per_contact INT NOT NULL DEFAULT 3,
    retry_interval_minutes INT NOT NULL DEFAULT 60,
    -- AMD
    amd_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    amd_action ENUM('hangup','leave_message','transfer_to_ivr','to_agent') NULL,
    amd_message_audio_id BIGINT NULL,
    -- horarios
    business_hours_id BIGINT NULL,
    starts_at TIMESTAMP NULL,
    ends_at TIMESTAMP NULL,
    -- compliance
    respect_dnc BOOLEAN NOT NULL DEFAULT TRUE,
    dnc_list_id BIGINT NULL,
    record_calls BOOLEAN NOT NULL DEFAULT TRUE,
    -- estado
    status ENUM('draft','scheduled','running','paused','completed','cancelled') NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_camp_slug (company_id, slug),
    CONSTRAINT fk_camp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_contacts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    campaign_id BIGINT NOT NULL,
    customer_id BIGINT NULL,
    phone VARCHAR(40) NOT NULL,
    name VARCHAR(200) NULL,
    custom_data JSON NULL,
    status ENUM('pending','queued','dialing','answered','no_answer','busy','failed','done','dnc','duplicate') NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMP NULL,
    next_retry_at TIMESTAMP NULL,
    last_call_id BIGINT NULL,
    KEY idx_cc_camp_status (campaign_id, status),
    KEY idx_cc_phone (company_id, phone),
    CONSTRAINT fk_cc_camp FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_attempts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    campaign_id BIGINT NOT NULL,
    contact_id BIGINT NOT NULL,
    call_id BIGINT NULL,
    attempt_number INT NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    outcome ENUM('answered','voicemail','no_answer','busy','failed','wrong_number','dnc','amd_machine','amd_human') NULL,
    duration_seconds INT NULL,
    KEY idx_ca_campaign (campaign_id),
    KEY idx_ca_contact (contact_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    campaign_id BIGINT NOT NULL,
    contact_id BIGINT NOT NULL,
    call_id BIGINT NULL,
    disposition_id BIGINT NULL,
    notes TEXT NULL,
    custom_results JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_cr_campaign (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- quality (calidad) -----------
CREATE TABLE IF NOT EXISTS quality_forms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    `schema` JSON NOT NULL,                      -- definición de criterios y ponderaciones
    max_score DECIMAL(8,2) NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_qf_slug (company_id, slug),
    CONSTRAINT fk_qf_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quality_reviews (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    form_id BIGINT NOT NULL,
    call_id BIGINT NOT NULL,
    agent_id BIGINT NOT NULL,
    reviewer_user_id BIGINT NOT NULL,
    score DECIMAL(8,2) NULL,
    pass BOOLEAN NULL,
    feedback TEXT NULL,
    answers JSON NULL,
    reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_qr_company (company_id, reviewed_at),
    KEY idx_qr_agent (agent_id),
    KEY idx_qr_call (call_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quality_scores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    review_id BIGINT NOT NULL,
    criterion_key VARCHAR(120) NOT NULL,
    score DECIMAL(8,2) NOT NULL,
    weight DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    comment TEXT NULL,
    KEY idx_qs_review (review_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- compliance rules — sugerencia añadida -----------
CREATE TABLE IF NOT EXISTS compliance_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    rule_type ENUM('required_phrase','forbidden_phrase','data_pattern','disclosure') NOT NULL,
    pattern TEXT NOT NULL,
    severity ENUM('info','warn','critical') NOT NULL DEFAULT 'warn',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY uniq_cr_slug (company_id, slug),
    CONSTRAINT fk_cr_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- usage_counters (para billing) -----------
CREATE TABLE IF NOT EXISTS usage_counters (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    metric ENUM('voice_minutes','sms_count','ai_tokens','storage_gb','agent_count','user_count','concurrent_calls') NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    used_value DECIMAL(20,4) NOT NULL DEFAULT 0,
    quota_value DECIMAL(20,4) NULL,
    is_overage BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_uc (company_id, metric, period_start),
    CONSTRAINT fk_uc_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- invoices -----------
CREATE TABLE IF NOT EXISTS invoices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    subscription_id BIGINT NULL,
    invoice_number VARCHAR(60) NOT NULL,
    status ENUM('draft','open','paid','past_due','void','uncollectible') NOT NULL DEFAULT 'draft',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    tax DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    issued_at TIMESTAMP NULL,
    due_at TIMESTAMP NULL,
    paid_at TIMESTAMP NULL,
    line_items JSON NULL,
    pdf_url VARCHAR(500) NULL,
    metadata JSON NULL,
    UNIQUE KEY uniq_inv_number (company_id, invoice_number),
    KEY idx_inv_status (company_id, status),
    CONSTRAINT fk_inv_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    payload JSON NOT NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_be_company (company_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- reports -----------
CREATE TABLE IF NOT EXISTS reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    report_type VARCHAR(80) NOT NULL,          -- 'inbound_calls', 'agent_productivity'
    config JSON NULL,                          -- filtros, columnas, etc.
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_rep_slug (company_id, slug),
    CONSTRAINT fk_rep_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_exports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    report_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    format ENUM('csv','xlsx','pdf','json') NOT NULL,
    filters JSON NULL,
    file_path VARCHAR(500) NULL,
    status ENUM('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
    rows_count BIGINT NULL,
    error_message TEXT NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_re_company (company_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_schedules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    report_id BIGINT NOT NULL,
    cron_expression VARCHAR(60) NOT NULL,
    format ENUM('csv','xlsx','pdf','json') NOT NULL DEFAULT 'xlsx',
    recipients JSON NOT NULL,                  -- ["email@x.com"]
    filters JSON NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMP NULL,
    next_run_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_rs_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- API keys / public api -----------
CREATE TABLE IF NOT EXISTS api_keys (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,           -- visible (ej: 'cck_live_')
    key_hash VARCHAR(255) NOT NULL,            -- bcrypt del secreto
    scopes JSON NOT NULL,                      -- ["calls:read","customers:write"]
    rate_limit_per_minute INT NULL,
    expires_at TIMESTAMP NULL,
    last_used_at TIMESTAMP NULL,
    revoked_at TIMESTAMP NULL,
    created_by BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ak_company (company_id),
    KEY idx_ak_prefix (key_prefix),
    CONSTRAINT fk_ak_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_request_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NULL,
    api_key_id BIGINT NULL,
    user_id BIGINT NULL,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    status_code INT NULL,
    duration_ms INT NULL,
    ip_address VARCHAR(50) NULL,
    user_agent VARCHAR(500) NULL,
    request_id VARCHAR(80) NULL,
    error_message TEXT NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_arl_company (company_id, occurred_at),
    KEY idx_arl_key (api_key_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- notifications (in-app) -----------
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    type VARCHAR(80) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NULL,
    severity ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
    link_url VARCHAR(500) NULL,
    read_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_n_user (user_id, created_at),
    KEY idx_n_unread (user_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- WebRTC settings — sugerencia añadida -----------
CREATE TABLE IF NOT EXISTS webrtc_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL UNIQUE,
    stun_servers JSON NULL,                    -- ["stun:stun.l.google.com:19302"]
    turn_servers JSON NULL,                    -- [{urls,username_encrypted,credential_encrypted}]
    use_secure_transport BOOLEAN NOT NULL DEFAULT TRUE,
    sip_wss_url VARCHAR(500) NULL,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ws_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Data retention policies — sugerencia añadida -----------
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    entity ENUM('call_events','recordings','asterisk_events','ai_messages','audit_logs','sms_logs','email_logs') NOT NULL,
    retention_days INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_drp (company_id, entity),
    CONSTRAINT fk_drp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Event outbox (pattern) — sugerencia añadida -----------
CREATE TABLE IF NOT EXISTS event_outbox (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NULL,
    event_type VARCHAR(80) NOT NULL,
    aggregate_type VARCHAR(80) NULL,
    aggregate_id VARCHAR(80) NULL,
    payload JSON NOT NULL,
    status ENUM('pending','processing','sent','failed') NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    KEY idx_eo_status (status, next_attempt_at),
    KEY idx_eo_company (company_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
