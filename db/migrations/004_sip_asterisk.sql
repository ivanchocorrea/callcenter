-- =====================================================================
--  004_sip_asterisk.sql
--  Troncales SIP, extensiones, sesiones WebRTC, eventos Asterisk
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ---------- sip_trunks -----------
CREATE TABLE IF NOT EXISTS sip_trunks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    host VARCHAR(255) NOT NULL,
    proxy VARCHAR(255) NULL,
    port INT NOT NULL DEFAULT 5060,
    username VARCHAR(150) NOT NULL,
    auth_username VARCHAR(150) NULL,
    password_encrypted TEXT NOT NULL,
    domain VARCHAR(255) NULL,
    caller_id VARCHAR(100) NULL,
    transport ENUM('udp','tcp','tls') NOT NULL DEFAULT 'udp',
    codecs JSON NULL,                          -- ["opus","ulaw","alaw","g729"]
    nat_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ice_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    rewrite_contact BOOLEAN NOT NULL DEFAULT TRUE,
    register_interval INT NOT NULL DEFAULT 300,
    keep_alive_interval INT NOT NULL DEFAULT 15,
    encrypted_communication BOOLEAN NOT NULL DEFAULT FALSE,    -- TLS+SRTP
    srtp_mode ENUM('disabled','optional','required') NOT NULL DEFAULT 'disabled',
    direction ENUM('inbound','outbound','both') NOT NULL DEFAULT 'both',
    priority INT NOT NULL DEFAULT 100,         -- failover
    fallback_trunk_id BIGINT NULL,
    max_concurrent_calls INT NULL,
    advanced_config JSON NULL,                 -- modo avanzado: campos extra
    status ENUM('active','inactive','error','registering') NOT NULL DEFAULT 'inactive',
    last_registered_at TIMESTAMP NULL,
    last_error TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_trunk_company (company_id),
    CONSTRAINT fk_trunk_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_trunk_fallback FOREIGN KEY (fallback_trunk_id) REFERENCES sip_trunks(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- did_numbers (números asociados a troncales) -----------
CREATE TABLE IF NOT EXISTS did_numbers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    trunk_id BIGINT NOT NULL,
    number VARCHAR(40) NOT NULL,               -- E.164
    description VARCHAR(255) NULL,
    inbound_destination_type ENUM('ivr','queue','agent','bot','voicemail','webhook','hangup') NULL,
    inbound_destination_id BIGINT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_did_number (company_id, number),
    KEY idx_did_trunk (trunk_id),
    CONSTRAINT fk_did_trunk FOREIGN KEY (trunk_id) REFERENCES sip_trunks(id) ON DELETE CASCADE,
    CONSTRAINT fk_did_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- extensions (alias, IVR-callable, etc.) -----------
CREATE TABLE IF NOT EXISTS extensions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    extension VARCHAR(20) NOT NULL,
    type ENUM('agent','queue','ivr','voicemail','external','feature') NOT NULL,
    target_id BIGINT NULL,
    description VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY uniq_ext_company (company_id, extension),
    CONSTRAINT fk_ext_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- webrtc_sessions -----------
CREATE TABLE IF NOT EXISTS webrtc_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    agent_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    pjsip_contact VARCHAR(255) NULL,
    user_agent VARCHAR(500) NULL,
    ip_address VARCHAR(50) NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    KEY idx_ws_company (company_id, started_at),
    CONSTRAINT fk_ws_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- asterisk_events (raw event log) -----------
CREATE TABLE IF NOT EXISTS asterisk_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NULL,
    event_source ENUM('ami','ari','dialplan') NOT NULL,
    event_name VARCHAR(80) NOT NULL,
    channel VARCHAR(180) NULL,
    unique_id VARCHAR(80) NULL,
    payload JSON NOT NULL,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ae_event (event_name, received_at),
    KEY idx_ae_unique (unique_id),
    KEY idx_ae_company (company_id, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci PARTITION BY RANGE (TO_DAYS(received_at)) (
    PARTITION p_initial VALUES LESS THAN MAXVALUE
);

SET FOREIGN_KEY_CHECKS=1;
