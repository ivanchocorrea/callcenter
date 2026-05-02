-- =====================================================================
--  015_sip_trunks_dial_prefixes.sql
--  Agrega prefijos de marcación POR TRONCAL (móvil / fijo / internacional).
--
--  El agente marca el número natural (ej 3001234567 para celular o
--  6011234567 para fijo). El backend, al hacer ARI Originate, pasa el
--  prefijo correspondiente como variable del canal. El dialplan
--  (extensions.conf [outbound-bridge]) lo antepone al número antes del Dial.
--
--  Antes esto era global para todo el sistema en extensions.conf. Ahora
--  cada troncal puede tener sus propios prefijos sin tocar Asterisk.
-- =====================================================================
SET NAMES utf8mb4;

-- MySQL no tiene `ADD COLUMN IF NOT EXISTS` en versiones antiguas, así que
-- usamos un procedure pattern para ser idempotentes.
SET @col_check := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sip_trunks'
      AND COLUMN_NAME = 'dial_prefix_mobile'
);
SET @sql := IF(@col_check = 0,
    'ALTER TABLE sip_trunks ADD COLUMN dial_prefix_mobile VARCHAR(10) DEFAULT NULL COMMENT ''Prefijo para celulares (ej Colombia RED: 06)''',
    'SELECT ''dial_prefix_mobile already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_check := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sip_trunks'
      AND COLUMN_NAME = 'dial_prefix_landline'
);
SET @sql := IF(@col_check = 0,
    'ALTER TABLE sip_trunks ADD COLUMN dial_prefix_landline VARCHAR(10) DEFAULT NULL COMMENT ''Prefijo para fijos (ej Colombia RED: 57)''',
    'SELECT ''dial_prefix_landline already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_check := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sip_trunks'
      AND COLUMN_NAME = 'dial_prefix_intl'
);
SET @sql := IF(@col_check = 0,
    'ALTER TABLE sip_trunks ADD COLUMN dial_prefix_intl VARCHAR(10) DEFAULT NULL COMMENT ''Prefijo para llamadas internacionales''',
    'SELECT ''dial_prefix_intl already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
