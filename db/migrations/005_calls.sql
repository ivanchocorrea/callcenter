-- =====================================================================
--  005_calls.sql
--  Calls, eventos, notas, disposiciones, transferencias, hold, calidad
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ---------- call_dispositions (catálogo) -----------
CREATE TABLE IF NOT EXISTS call_dispositions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    parent_id BIGINT NULL,                     -- jerárquica
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    requires_note BOOLEAN NOT NULL DEFAULT FALSE,
    is_positive BOOLEAN NULL,
    color_hex CHAR(7) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_disp (company_id, slug),
    CONSTRAINT fk_disp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_disp_parent FOREIGN KEY (parent_id) REFERENCES call_dispositions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- calls -----------
CREATE TABLE IF NOT EXISTS calls (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    asterisk_uniqueid VARCHAR(80) NULL,
    asterisk_linkedid VARCHAR(80) NULL,
    direction ENUM('inbound','outbound','internal') NOT NULL,
    -- partes
    from_number VARCHAR(60) NULL,
    to_number VARCHAR(60) NULL,
    did_number VARCHAR(60) NULL,
    trunk_id BIGINT NULL,
    -- routing
    customer_id BIGINT NULL,
    queue_id BIGINT NULL,
    ivr_menu_id BIGINT NULL,
    bot_id BIGINT NULL,
    campaign_id BIGINT NULL,
    agent_id BIGINT NULL,
    -- estado
    status ENUM(
        'initiated','ringing','in_queue','in_ivr','in_bot',
        'answered','on_hold','transferred','completed',
        'no_answer','busy','failed','abandoned','voicemail'
    ) NOT NULL DEFAULT 'initiated',
    disposition_id BIGINT NULL,
    is_recorded BOOLEAN NOT NULL DEFAULT FALSE,
    recording_id BIGINT NULL,
    -- tiempos
    started_at TIMESTAMP NULL,
    ringing_at TIMESTAMP NULL,
    answered_at TIMESTAMP NULL,
    ended_at TIMESTAMP NULL,
    duration_seconds INT NULL,
    queue_wait_seconds INT NULL,
    talk_seconds INT NULL,
    hold_seconds INT NULL,
    wrap_up_seconds INT NULL,
    -- IA
    ai_summary TEXT NULL,
    ai_sentiment VARCHAR(20) NULL,
    ai_tags JSON NULL,
    -- fees / costos
    cost_minutes DECIMAL(10,4) NULL,
    cost_currency CHAR(3) NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_calls_company_started (company_id, started_at),
    KEY idx_calls_agent (agent_id, started_at),
    KEY idx_calls_queue (queue_id, started_at),
    KEY idx_calls_status (status),
    KEY idx_calls_uniqueid (asterisk_uniqueid),
    KEY idx_calls_customer (customer_id),
    CONSTRAINT fk_calls_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- call_events -----------
CREATE TABLE IF NOT EXISTS call_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    call_id BIGINT NOT NULL,
    event_type VARCHAR(80) NOT NULL,           -- 'ringing','answered','hold','dtmf','queue.position', ...
    actor_type ENUM('system','agent','customer','supervisor','bot','asterisk') NULL,
    actor_id BIGINT NULL,
    payload JSON NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ce_call (call_id, occurred_at),
    KEY idx_ce_company (company_id, occurred_at),
    CONSTRAINT fk_ce_call FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- call_notes -----------
CREATE TABLE IF NOT EXISTS call_notes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    call_id BIGINT NOT NULL,
    customer_id BIGINT NULL,
    user_id BIGINT NOT NULL,
    note_type ENUM('call','important','internal','followup','result','observation') NOT NULL DEFAULT 'call',
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_cn_call (call_id),
    KEY idx_cn_customer (customer_id),
    CONSTRAINT fk_cn_call FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- call_transfers -----------
CREATE TABLE IF NOT EXISTS call_transfers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    call_id BIGINT NOT NULL,
    transfer_type ENUM('blind','attended','to_queue','to_bot','to_external') NOT NULL,
    from_agent_id BIGINT NULL,
    to_agent_id BIGINT NULL,
    to_queue_id BIGINT NULL,
    to_bot_id BIGINT NULL,
    to_external_number VARCHAR(60) NULL,
    initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    success BOOLEAN NULL,
    failure_reason VARCHAR(255) NULL,
    KEY idx_ct_call (call_id),
    CONSTRAINT fk_ct_call FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- call_hold_events -----------
CREATE TABLE IF NOT EXISTS call_hold_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    call_id BIGINT NOT NULL,
    agent_id BIGINT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NULL,
    duration_seconds INT NULL,
    KEY idx_che_call (call_id),
    CONSTRAINT fk_che_call FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- call_quality_metrics — sugerencia añadida -----------
CREATE TABLE IF NOT EXISTS call_quality_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    call_id BIGINT NOT NULL,
    sample_at TIMESTAMP NOT NULL,
    leg ENUM('caller','callee') NOT NULL,
    mos DECIMAL(3,2) NULL,                     -- Mean Opinion Score (1.0–5.0)
    jitter_ms INT NULL,
    rtt_ms INT NULL,
    packet_loss_pct DECIMAL(5,2) NULL,
    codec VARCHAR(20) NULL,
    KEY idx_cqm_call (call_id),
    CONSTRAINT fk_cqm_call FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
