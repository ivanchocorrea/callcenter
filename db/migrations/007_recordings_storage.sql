-- =====================================================================
--  007_recordings_storage.sql
--  Grabaciones, storage providers, retention, access logs
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ---------- storage_providers -----------
CREATE TABLE IF NOT EXISTS storage_providers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    driver ENUM('local','s3','minio','wasabi','backblaze') NOT NULL,
    name VARCHAR(150) NOT NULL,
    region VARCHAR(60) NULL,
    bucket VARCHAR(180) NULL,
    endpoint VARCHAR(255) NULL,
    access_key_encrypted TEXT NULL,
    secret_key_encrypted TEXT NULL,
    use_path_style BOOLEAN NOT NULL DEFAULT TRUE,
    base_path VARCHAR(255) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_sp_slug (company_id, slug),
    CONSTRAINT fk_sp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- recording_storage_settings -----------
CREATE TABLE IF NOT EXISTS recording_storage_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL UNIQUE,
    storage_provider_id BIGINT NULL,
    record_inbound BOOLEAN NOT NULL DEFAULT TRUE,
    record_outbound BOOLEAN NOT NULL DEFAULT TRUE,
    record_internal BOOLEAN NOT NULL DEFAULT FALSE,
    play_disclosure_audio BOOLEAN NOT NULL DEFAULT TRUE,
    disclosure_audio_id BIGINT NULL,
    retention_days INT NOT NULL DEFAULT 90,
    delete_after_retention BOOLEAN NOT NULL DEFAULT FALSE,
    encryption_at_rest BOOLEAN NOT NULL DEFAULT FALSE,
    pause_on_dtmf_input BOOLEAN NOT NULL DEFAULT TRUE,    -- PCI compliance
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rss_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- recordings -----------
CREATE TABLE IF NOT EXISTS recordings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    call_id BIGINT NOT NULL,
    storage_provider_id BIGINT NULL,
    file_path VARCHAR(500) NOT NULL,
    format VARCHAR(20) NOT NULL DEFAULT 'wav',
    file_size_bytes BIGINT NULL,
    duration_seconds INT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NULL,
    is_pci_redacted BOOLEAN NOT NULL DEFAULT FALSE,
    transcription_id BIGINT NULL,
    expires_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL,
    KEY idx_rec_company_started (company_id, started_at),
    KEY idx_rec_call (call_id),
    CONSTRAINT fk_rec_call FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE,
    CONSTRAINT fk_rec_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- recording_access_logs -----------
CREATE TABLE IF NOT EXISTS recording_access_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    recording_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    action ENUM('view','download','delete','share') NOT NULL,
    ip_address VARCHAR(50) NULL,
    user_agent VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ral_recording (recording_id),
    KEY idx_ral_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- call_recording_events -----------
CREATE TABLE IF NOT EXISTS call_recording_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    call_id BIGINT NOT NULL,
    recording_id BIGINT NULL,
    event ENUM('start','pause','resume','stop') NOT NULL,
    actor_user_id BIGINT NULL,
    reason VARCHAR(255) NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_cre_call (call_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
