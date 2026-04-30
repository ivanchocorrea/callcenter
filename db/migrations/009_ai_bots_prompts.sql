-- =====================================================================
--  009_ai_bots_prompts.sql
--  AI providers, bots, prompts versionados, herramientas, conversaciones
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ---------- ai_providers -----------
CREATE TABLE IF NOT EXISTS ai_providers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    provider_type ENUM('openai','anthropic','google','azure_openai','generic_http','deepgram','whisper') NOT NULL,
    name VARCHAR(150) NOT NULL,
    base_url VARCHAR(500) NULL,
    api_key_encrypted TEXT NULL,
    organization_id VARCHAR(150) NULL,
    default_model VARCHAR(120) NULL,
    capabilities JSON NULL,                    -- ["chat","tts","stt","embeddings","tools"]
    headers JSON NULL,                         -- generic_http custom headers
    request_template JSON NULL,                -- generic_http template
    response_path JSON NULL,                   -- generic_http path mapping
    rate_limit_per_minute INT NULL,
    timeout_ms INT NOT NULL DEFAULT 30000,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_aip_slug (company_id, slug),
    CONSTRAINT fk_aip_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ai_prompts -----------
CREATE TABLE IF NOT EXISTS ai_prompts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NULL,                    -- NULL = prompt global del sistema
    slug VARCHAR(120) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    scope ENUM('global','company','bot','campaign','queue','summary','classification','sentiment','transfer','tools') NOT NULL DEFAULT 'company',
    target_id BIGINT NULL,                     -- bot_id, campaign_id, queue_id según scope
    active_version_id BIGINT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_ap_company (company_id),
    KEY idx_ap_scope (scope, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ai_prompt_versions -----------
CREATE TABLE IF NOT EXISTS ai_prompt_versions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    prompt_id BIGINT NOT NULL,
    version INT NOT NULL,
    content LONGTEXT NOT NULL,
    variables JSON NULL,                       -- ["customer_name","queue_name"]
    notes TEXT NULL,
    created_by BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_apv (prompt_id, version),
    CONSTRAINT fk_apv_prompt FOREIGN KEY (prompt_id) REFERENCES ai_prompts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ai_bots -----------
CREATE TABLE IF NOT EXISTS ai_bots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    bot_type ENUM('reception','appointment','sales','support','collections','survey','custom') NOT NULL DEFAULT 'custom',
    provider_id BIGINT NOT NULL,
    model VARCHAR(120) NOT NULL,
    voice VARCHAR(120) NULL,                   -- p.ej. 'es-CO-Wavenet-B'
    locale VARCHAR(10) NOT NULL DEFAULT 'es-CO',
    prompt_id BIGINT NULL,
    welcome_message TEXT NULL,
    fallback_message TEXT NULL,
    transfer_to_human_keywords JSON NULL,      -- ["asesor","humano","operador"]
    transfer_destination_type ENUM('queue','agent','external') NULL,
    transfer_destination_id BIGINT NULL,
    business_hours_id BIGINT NULL,
    max_turns INT NULL,
    max_duration_seconds INT NULL,
    monthly_token_limit BIGINT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_bot_slug (company_id, slug),
    CONSTRAINT fk_bot_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_bot_provider FOREIGN KEY (provider_id) REFERENCES ai_providers(id),
    CONSTRAINT fk_bot_prompt FOREIGN KEY (prompt_id) REFERENCES ai_prompts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ai_bot_queues (relación bot↔cola) -----------
CREATE TABLE IF NOT EXISTS ai_bot_queues (
    bot_id BIGINT NOT NULL,
    queue_id BIGINT NOT NULL,
    PRIMARY KEY (bot_id, queue_id),
    CONSTRAINT fk_abq_bot FOREIGN KEY (bot_id) REFERENCES ai_bots(id) ON DELETE CASCADE,
    CONSTRAINT fk_abq_queue FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ai_tools (function calling) -----------
CREATE TABLE IF NOT EXISTS ai_tools (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(120) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    input_schema JSON NOT NULL,                -- JSON Schema
    output_schema JSON NULL,
    handler_type ENUM('builtin','connector','webhook','sql') NOT NULL,
    handler_config JSON NULL,
    connector_id BIGINT NULL,
    timeout_ms INT NOT NULL DEFAULT 10000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_tool_slug (company_id, slug),
    CONSTRAINT fk_tool_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ai_tool_permissions (qué bot puede usar qué tool) -----------
CREATE TABLE IF NOT EXISTS ai_tool_permissions (
    bot_id BIGINT NOT NULL,
    tool_id BIGINT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (bot_id, tool_id),
    CONSTRAINT fk_atp_bot FOREIGN KEY (bot_id) REFERENCES ai_bots(id) ON DELETE CASCADE,
    CONSTRAINT fk_atp_tool FOREIGN KEY (tool_id) REFERENCES ai_tools(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ai_tool_execution_logs -----------
CREATE TABLE IF NOT EXISTS ai_tool_execution_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    bot_id BIGINT NOT NULL,
    tool_id BIGINT NOT NULL,
    conversation_id BIGINT NULL,
    call_id BIGINT NULL,
    input JSON NULL,
    output JSON NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT NULL,
    duration_ms INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_atel_bot (bot_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ai_conversations -----------
CREATE TABLE IF NOT EXISTS ai_conversations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    bot_id BIGINT NOT NULL,
    call_id BIGINT NULL,
    customer_id BIGINT NULL,
    channel ENUM('voice','chat','sms','whatsapp','email') NOT NULL DEFAULT 'voice',
    status ENUM('active','completed','transferred','failed') NOT NULL DEFAULT 'active',
    transferred_to_user_id BIGINT NULL,
    summary TEXT NULL,
    sentiment VARCHAR(20) NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    KEY idx_aic_company (company_id, started_at),
    KEY idx_aic_call (call_id),
    CONSTRAINT fk_aic_bot FOREIGN KEY (bot_id) REFERENCES ai_bots(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ai_messages -----------
CREATE TABLE IF NOT EXISTS ai_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    conversation_id BIGINT NOT NULL,
    role ENUM('system','user','assistant','tool') NOT NULL,
    content LONGTEXT NULL,
    tool_call_id VARCHAR(120) NULL,
    tool_name VARCHAR(120) NULL,
    tool_input JSON NULL,
    tool_output JSON NULL,
    audio_path VARCHAR(500) NULL,
    transcription TEXT NULL,
    tokens_input INT NULL,
    tokens_output INT NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_aim_conv (conversation_id, occurred_at),
    CONSTRAINT fk_aim_conv FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ai_usage_logs -----------
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    provider_id BIGINT NOT NULL,
    bot_id BIGINT NULL,
    operation ENUM('chat','tts','stt','embedding','classify','summarize') NOT NULL,
    model VARCHAR(120) NULL,
    tokens_input INT NULL,
    tokens_output INT NULL,
    duration_ms INT NULL,
    cost_usd DECIMAL(10,6) NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_aul_company (company_id, occurred_at),
    KEY idx_aul_provider (provider_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- knowledge base — sugerencia añadida -----------
CREATE TABLE IF NOT EXISTS kb_documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    source VARCHAR(120) NULL,
    content LONGTEXT NULL,
    metadata JSON NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_kb_company (company_id),
    CONSTRAINT fk_kb_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kb_chunks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    document_id BIGINT NOT NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding_provider VARCHAR(60) NULL,
    embedding_dimensions INT NULL,
    embedding_vector_path VARCHAR(500) NULL,    -- ruta a vector externo / o JSON
    KEY idx_kbc_doc (document_id, chunk_index),
    CONSTRAINT fk_kbc_doc FOREIGN KEY (document_id) REFERENCES kb_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
