-- =====================================================================
--  013_maintenance_module.sql
--  Módulo de Mantenimiento: errores, respaldos, reinicios, dependencias
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ---------- system_errors -----------
-- Errores capturados por el sistema, traducidos a lenguaje claro
CREATE TABLE IF NOT EXISTS system_errors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NULL,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Origen
    source ENUM('backend','frontend','database','telephony','external_api','scheduled_task','other')
           NOT NULL DEFAULT 'backend',
    module VARCHAR(120) NOT NULL,
    -- Clasificación
    severity ENUM('info','warning','error','critical') NOT NULL DEFAULT 'error',
    error_code VARCHAR(80) NULL,
    -- Mensajes
    technical_message TEXT NOT NULL,
    friendly_message TEXT NOT NULL,
    recommendation TEXT NULL,
    -- Detalle (sin secretos)
    stack_trace MEDIUMTEXT NULL,
    metadata JSON NULL,
    -- Estado
    status ENUM('open','acknowledged','resolved','ignored') NOT NULL DEFAULT 'open',
    acknowledged_by BIGINT NULL,
    acknowledged_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    KEY idx_errors_occurred (occurred_at),
    KEY idx_errors_severity (severity),
    KEY idx_errors_status (status),
    KEY idx_errors_source (source),
    KEY idx_errors_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- backup_history -----------
CREATE TABLE IF NOT EXISTS backup_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP NULL,
    triggered_by BIGINT NULL,                  -- user.id que lo lanzó (NULL = sistema)
    trigger_type ENUM('manual','scheduled','pre_update') NOT NULL DEFAULT 'manual',
    -- Contenido
    includes_db BOOLEAN NOT NULL DEFAULT TRUE,
    includes_uploads BOOLEAN NOT NULL DEFAULT TRUE,
    includes_config BOOLEAN NOT NULL DEFAULT TRUE,
    -- Resultado
    status ENUM('running','success','failed') NOT NULL DEFAULT 'running',
    file_path VARCHAR(500) NULL,
    file_size_bytes BIGINT NULL,
    sha256 CHAR(64) NULL,
    error_message TEXT NULL,
    notes VARCHAR(500) NULL,
    KEY idx_backup_started (started_at),
    KEY idx_backup_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- restart_history -----------
CREATE TABLE IF NOT EXISTS restart_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    requested_by BIGINT NULL,
    target ENUM('backend','frontend','asterisk','redis','all') NOT NULL DEFAULT 'backend',
    reason VARCHAR(500) NULL,
    status ENUM('pending','running','success','failed') NOT NULL DEFAULT 'pending',
    error_message TEXT NULL,
    KEY idx_restart_requested (requested_at),
    KEY idx_restart_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- dependency_updates -----------
-- Histórico de chequeos y aplicaciones de actualización
CREATE TABLE IF NOT EXISTS dependency_updates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    triggered_by BIGINT NULL,
    project ENUM('backend','frontend') NOT NULL,
    package_name VARCHAR(200) NOT NULL,
    current_version VARCHAR(80) NOT NULL,
    wanted_version VARCHAR(80) NULL,
    latest_version VARCHAR(80) NULL,
    update_type ENUM('patch','minor','major','none') NOT NULL DEFAULT 'none',
    is_safe BOOLEAN NOT NULL DEFAULT TRUE,    -- patch+minor = seguro; major = manual
    action ENUM('detected','applied','skipped','failed') NOT NULL DEFAULT 'detected',
    error_message TEXT NULL,
    KEY idx_depupd_checked (checked_at),
    KEY idx_depupd_project (project),
    KEY idx_depupd_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- maintenance_actions -----------
-- Auditoría específica del panel (resumen + resultado por acción)
CREATE TABLE IF NOT EXISTS maintenance_actions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id BIGINT NULL,
    actor_email VARCHAR(180) NULL,
    action ENUM(
        'view_status','check_errors','download_logs',
        'check_updates','apply_safe_updates','apply_single_update',
        'create_backup','restore_backup',
        'restart_service','run_tests','toggle_maintenance_mode'
    ) NOT NULL,
    target VARCHAR(200) NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    duration_ms INT NULL,
    notes TEXT NULL,
    metadata JSON NULL,
    ip_address VARCHAR(50) NULL,
    KEY idx_mact_occurred (occurred_at),
    KEY idx_mact_action (action),
    KEY idx_mact_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
