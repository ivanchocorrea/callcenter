-- =====================================================================
--  001_core_tenants.sql
--  Tablas centrales de multi-tenant: companies, plans, subscriptions,
--  company_settings, business_hours, holidays, timezones.
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ---------- plans (catálogo SaaS, sin company_id) -----------
CREATE TABLE IF NOT EXISTS plans (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    max_users INT NULL,
    max_agents INT NULL,
    max_concurrent_calls INT NULL,
    included_minutes INT NULL,
    included_sms INT NULL,
    storage_gb INT NULL,
    features JSON NULL,                       -- feature flags
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- companies -----------
CREATE TABLE IF NOT EXISTS companies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(120) NOT NULL UNIQUE,
    legal_name VARCHAR(200) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    tax_id VARCHAR(60) NULL,
    country CHAR(2) NULL,                     -- ISO 3166-1 alpha-2
    timezone VARCHAR(80) NOT NULL DEFAULT 'America/Bogota',
    default_locale VARCHAR(10) NOT NULL DEFAULT 'es-CO',
    primary_email VARCHAR(180) NULL,
    primary_phone VARCHAR(40) NULL,
    logo_url VARCHAR(500) NULL,
    status ENUM('active','suspended','trialing','closed') NOT NULL DEFAULT 'trialing',
    suspended_reason VARCHAR(255) NULL,
    plan_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    KEY idx_companies_status (status),
    CONSTRAINT fk_companies_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- subscriptions -----------
CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    status ENUM('trialing','active','past_due','canceled','suspended') NOT NULL DEFAULT 'trialing',
    is_trial BOOLEAN NOT NULL DEFAULT TRUE,
    trial_ends_at TIMESTAMP NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_start TIMESTAMP NULL,
    current_period_end TIMESTAMP NULL,
    canceled_at TIMESTAMP NULL,
    external_provider VARCHAR(50) NULL,         -- stripe, mercadopago, manual
    external_id VARCHAR(150) NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_sub_company (company_id),
    KEY idx_sub_status (status),
    CONSTRAINT fk_sub_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- company_settings (key/value flexible) -----------
CREATE TABLE IF NOT EXISTS company_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    setting_key VARCHAR(120) NOT NULL,
    setting_value JSON NULL,
    is_secret BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_setting (company_id, setting_key),
    CONSTRAINT fk_settings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- business_hours (horarios laborales) -----------
CREATE TABLE IF NOT EXISTS business_hours (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,                -- 'default', 'colombia-soporte'
    timezone VARCHAR(80) NOT NULL DEFAULT 'America/Bogota',
    schedule JSON NOT NULL,                    -- { mon:[{from:"08:00",to:"18:00"}], tue:[...], ... }
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_bh_company (company_id),
    CONSTRAINT fk_bh_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- holidays (calendario) — sugerencia añadida -----------
CREATE TABLE IF NOT EXISTS holidays (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    holiday_date DATE NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    country CHAR(2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_holiday_company (company_id, holiday_date),
    CONSTRAINT fk_holiday_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
