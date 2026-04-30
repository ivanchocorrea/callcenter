-- =====================================================================
--  006_queues_ivr.sql
--  Colas, posición/turnos, IVR, audios, MoH
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ---------- queues -----------
CREATE TABLE IF NOT EXISTS queues (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    strategy ENUM('ringall','leastrecent','fewestcalls','random','rrmemory','linear','wrandom','skills') NOT NULL DEFAULT 'rrmemory',
    priority INT NOT NULL DEFAULT 100,
    -- timeouts
    max_wait_seconds INT NULL,
    ring_seconds INT NOT NULL DEFAULT 20,
    wrap_up_seconds INT NOT NULL DEFAULT 10,
    retry_seconds INT NOT NULL DEFAULT 5,
    -- behavior
    join_empty BOOLEAN NOT NULL DEFAULT FALSE,
    leave_when_empty BOOLEAN NOT NULL DEFAULT TRUE,
    autopause ENUM('off','on','all') NOT NULL DEFAULT 'off',
    -- audios
    moh_id BIGINT NULL,
    welcome_audio_id BIGINT NULL,
    position_announce_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    position_announce_interval INT NOT NULL DEFAULT 30,
    estimated_wait_announce_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    -- callback
    callback_offer_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    callback_offer_after_seconds INT NULL,
    -- abandon
    sms_on_abandon_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    sms_on_abandon_template_id BIGINT NULL,
    -- horarios y festivos
    business_hours_id BIGINT NULL,
    out_of_hours_audio_id BIGINT NULL,
    -- bot IA fallback
    fallback_bot_id BIGINT NULL,
    -- skills routing
    required_skills JSON NULL,                  -- [{skill_id:1, min:3}, ...]
    record_calls BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_queue_slug (company_id, slug),
    CONSTRAINT fk_q_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- queue_agents -----------
CREATE TABLE IF NOT EXISTS queue_agents (
    queue_id BIGINT NOT NULL,
    agent_id BIGINT NOT NULL,
    penalty INT NOT NULL DEFAULT 0,            -- mayor = menor prioridad
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (queue_id, agent_id),
    KEY idx_qa_agent (agent_id),
    CONSTRAINT fk_qa_queue FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE,
    CONSTRAINT fk_qa_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- queue_supervisors -----------
CREATE TABLE IF NOT EXISTS queue_supervisors (
    queue_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    PRIMARY KEY (queue_id, user_id),
    CONSTRAINT fk_qs_queue FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE,
    CONSTRAINT fk_qs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- queue_calls (estado actual de cada llamada en cola) -----------
CREATE TABLE IF NOT EXISTS queue_calls (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    queue_id BIGINT NOT NULL,
    call_id BIGINT NOT NULL,
    position INT NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    estimated_wait_seconds INT NULL,
    status ENUM('waiting','answered','abandoned','timeout','transferred') NOT NULL DEFAULT 'waiting',
    entered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP NULL,
    abandoned_at TIMESTAMP NULL,
    abandon_position INT NULL,
    KEY idx_qc_queue (queue_id, status),
    KEY idx_qc_call (call_id),
    UNIQUE KEY uniq_qc_call (call_id),
    CONSTRAINT fk_qc_queue FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE,
    CONSTRAINT fk_qc_call FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- queue_position_logs (histórico) -----------
CREATE TABLE IF NOT EXISTS queue_position_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    queue_id BIGINT NOT NULL,
    call_id BIGINT NOT NULL,
    position INT NOT NULL,
    estimated_wait_seconds INT NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_qpl_call (call_id),
    KEY idx_qpl_queue (queue_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ivr_audio_files -----------
CREATE TABLE IF NOT EXISTS ivr_audio_files (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    storage_provider_id BIGINT NULL,
    duration_seconds INT NULL,
    file_size_bytes BIGINT NULL,
    format VARCHAR(20) NULL,                   -- wav, mp3, gsm
    sample_rate INT NULL,
    purpose ENUM(
        'welcome','menu','wait','moh','out_of_hours',
        'invalid_option','timeout','recording_disclosure',
        'position','custom'
    ) NOT NULL DEFAULT 'custom',
    transcription TEXT NULL,                   -- opcional STT
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_iaf_company (company_id),
    CONSTRAINT fk_iaf_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- music_on_hold (alias semántico) -----------
CREATE TABLE IF NOT EXISTS music_on_hold (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    audio_file_ids JSON NOT NULL,              -- [1,2,3] reproducidos en orden/random
    play_random BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_moh_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ivr_menus -----------
CREATE TABLE IF NOT EXISTS ivr_menus (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    welcome_audio_id BIGINT NULL,
    menu_audio_id BIGINT NULL,
    invalid_audio_id BIGINT NULL,
    timeout_audio_id BIGINT NULL,
    out_of_hours_audio_id BIGINT NULL,
    business_hours_id BIGINT NULL,
    timeout_seconds INT NOT NULL DEFAULT 5,
    max_attempts INT NOT NULL DEFAULT 3,
    on_invalid ENUM('repeat','goto','hangup','transfer') NOT NULL DEFAULT 'repeat',
    on_timeout ENUM('repeat','goto','hangup','transfer') NOT NULL DEFAULT 'repeat',
    fallback_destination_type ENUM('queue','agent','bot','voicemail','hangup','webhook') NULL,
    fallback_destination_id BIGINT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_ivr_slug (company_id, slug),
    CONSTRAINT fk_ivr_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ivr_options -----------
CREATE TABLE IF NOT EXISTS ivr_options (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    ivr_menu_id BIGINT NOT NULL,
    dtmf_key VARCHAR(4) NOT NULL,              -- '1','2','*','#','0'
    label VARCHAR(150) NULL,
    destination_type ENUM('queue','agent','bot','ivr','voicemail','webhook','hangup','tool','external') NOT NULL,
    destination_id BIGINT NULL,
    destination_value VARCHAR(255) NULL,        -- e.g. webhook URL, external number
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY uniq_ivr_opt (ivr_menu_id, dtmf_key),
    CONSTRAINT fk_iopt_ivr FOREIGN KEY (ivr_menu_id) REFERENCES ivr_menus(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ivr_logs -----------
CREATE TABLE IF NOT EXISTS ivr_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    call_id BIGINT NOT NULL,
    ivr_menu_id BIGINT NOT NULL,
    dtmf_pressed VARCHAR(4) NULL,
    option_id BIGINT NULL,
    attempt INT NOT NULL DEFAULT 1,
    outcome ENUM('selected','invalid','timeout','exited','transferred') NOT NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_il_call (call_id),
    KEY idx_il_ivr (ivr_menu_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
