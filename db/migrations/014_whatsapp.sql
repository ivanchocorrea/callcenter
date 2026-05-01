-- =====================================================================
--  014_whatsapp.sql
--  Cuentas de WhatsApp Business + mensajes recibidos
-- =====================================================================
SET NAMES utf8mb4;

-- Cuentas configuradas (una por empresa, soporta múltiples si necesario)
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(40) NOT NULL,           -- +57 300 ...
    phone_number_id VARCHAR(80) NOT NULL,        -- ID de Meta
    business_account_id VARCHAR(80) NULL,        -- WABA ID
    access_token_encrypted TEXT NOT NULL,        -- Token Bearer permanente
    verify_token VARCHAR(120) NOT NULL,          -- Token que verifica webhook
    webhook_secret VARCHAR(120) NULL,            -- Para HMAC signature
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_wa_phone_id (phone_number_id),
    UNIQUE KEY uniq_wa_slug (company_id, slug),
    CONSTRAINT fk_wa_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mensajes recibidos
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    account_id BIGINT NOT NULL,
    direction ENUM('inbound','outbound') NOT NULL DEFAULT 'inbound',
    message_id VARCHAR(120) NOT NULL,            -- wamid del Meta
    from_number VARCHAR(40) NOT NULL,
    to_number VARCHAR(40) NOT NULL,
    message_type ENUM('text','image','audio','video','document','location','sticker','contacts','interactive','button','reaction','unknown') NOT NULL DEFAULT 'text',
    body TEXT NULL,
    media_url VARCHAR(500) NULL,
    media_mime VARCHAR(100) NULL,
    raw_payload JSON NULL,
    customer_id BIGINT NULL,
    conversation_id BIGINT NULL,
    received_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_msg_id (message_id),
    KEY idx_wa_msg_company (company_id, created_at DESC),
    KEY idx_wa_msg_account (account_id, created_at DESC),
    CONSTRAINT fk_wa_msg_account FOREIGN KEY (account_id) REFERENCES whatsapp_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
