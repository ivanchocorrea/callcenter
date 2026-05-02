-- =====================================================================
--  017_companies_agent_settings.sql
--  Settings por empresa relacionados al panel del agente.
--  Por ahora: si los agentes pueden RECHAZAR llamadas entrantes.
-- =====================================================================
SET NAMES utf8mb4;

SET @col_check := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'companies'
      AND COLUMN_NAME = 'allow_agent_reject_inbound'
);
SET @sql := IF(@col_check = 0,
    'ALTER TABLE companies ADD COLUMN allow_agent_reject_inbound TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''Si false, los agentes no pueden rechazar llamadas entrantes (botón oculto)''',
    'SELECT ''allow_agent_reject_inbound already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
