-- =====================================================================
--  003_agents_skills.sql
--  Agentes, estados, skills, pause reasons
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ---------- agents -----------
CREATE TABLE IF NOT EXISTS agents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,                   -- 1:1 con users
    extension VARCHAR(20) NOT NULL,            -- ext interna SIP, ej "1001"
    sip_secret_encrypted TEXT NOT NULL,        -- password de la cuenta SIP del agente
    display_name VARCHAR(150) NOT NULL,
    department VARCHAR(120) NULL,
    skill_level TINYINT NOT NULL DEFAULT 1,    -- 1..5
    max_concurrent_calls TINYINT NOT NULL DEFAULT 1,
    can_be_recorded BOOLEAN NOT NULL DEFAULT TRUE,
    auto_answer BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_agent_company_ext (company_id, extension),
    UNIQUE KEY uniq_agent_user (user_id),
    CONSTRAINT fk_agent_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_agent_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- skills (catálogo por empresa) — sugerencia añadida -----------
CREATE TABLE IF NOT EXISTS skills (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_skill_company_slug (company_id, slug),
    CONSTRAINT fk_skill_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_skills (
    agent_id BIGINT NOT NULL,
    skill_id BIGINT NOT NULL,
    proficiency TINYINT NOT NULL DEFAULT 3,    -- 1..5
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (agent_id, skill_id),
    CONSTRAINT fk_as_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    CONSTRAINT fk_as_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- pause_reasons (configurables por empresa) — sugerencia añadida -----------
CREATE TABLE IF NOT EXISTS pause_reasons (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(60) NOT NULL,                 -- 'lunch', 'training', 'bathroom'
    name VARCHAR(120) NOT NULL,
    counts_for_productivity BOOLEAN NOT NULL DEFAULT FALSE,
    max_duration_minutes INT NULL,
    color_hex CHAR(7) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY uniq_pr_company_slug (company_id, slug),
    CONSTRAINT fk_pr_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- agent_status_logs -----------
CREATE TABLE IF NOT EXISTS agent_status_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    agent_id BIGINT NOT NULL,
    status ENUM(
        'available','on_call','wrap_up','paused',
        'lunch','training','do_not_disturb','offline','login','logout'
    ) NOT NULL,
    pause_reason_id BIGINT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    duration_seconds INT NULL,
    metadata JSON NULL,
    KEY idx_asl_agent (agent_id, started_at),
    KEY idx_asl_company_started (company_id, started_at),
    CONSTRAINT fk_asl_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    CONSTRAINT fk_asl_pr FOREIGN KEY (pause_reason_id) REFERENCES pause_reasons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
