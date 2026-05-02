-- =====================================================================
--  018_agent_status_and_call_notes.sql
--  - Estado actual del agente (Disponible / Ocupado / etc) + log histórico.
--  - Notas en tabla calls (lo que el agente escribe durante/después).
-- =====================================================================
SET NAMES utf8mb4;

-- ---------- agents.current_status + current_status_changed_at ----------
SET @col_check := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agents'
      AND COLUMN_NAME = 'current_status'
);
SET @sql := IF(@col_check = 0,
    'ALTER TABLE agents ADD COLUMN current_status VARCHAR(30) NOT NULL DEFAULT ''offline'' COMMENT ''available|busy|paused|lunch|training|offline''',
    'SELECT ''current_status already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_check := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agents'
      AND COLUMN_NAME = 'current_status_changed_at'
);
SET @sql := IF(@col_check = 0,
    'ALTER TABLE agents ADD COLUMN current_status_changed_at TIMESTAMP NULL DEFAULT NULL',
    'SELECT ''current_status_changed_at already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- agent_status_log (histórico para reportes) ----------
CREATE TABLE IF NOT EXISTS agent_status_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    agent_id BIGINT NOT NULL,
    company_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agent_status_log_agent (agent_id, changed_at),
    INDEX idx_agent_status_log_company (company_id, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- calls.notes (texto libre del agente) ----------
SET @col_check := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'calls'
      AND COLUMN_NAME = 'notes'
);
SET @sql := IF(@col_check = 0,
    'ALTER TABLE calls ADD COLUMN notes TEXT NULL DEFAULT NULL',
    'SELECT ''notes already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
