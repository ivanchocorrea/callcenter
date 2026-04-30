-- =====================================================================
--  008_crm_customers.sql
--  CRM: customers, phones, notes, tags, interactions, tickets, appointments,
--  DNC, importación
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ---------- customers -----------
CREATE TABLE IF NOT EXISTS customers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    external_id VARCHAR(120) NULL,
    full_name VARCHAR(200) NOT NULL,
    document_type VARCHAR(20) NULL,
    document_number VARCHAR(60) NULL,
    primary_phone VARCHAR(40) NULL,
    email VARCHAR(180) NULL,
    company_name VARCHAR(180) NULL,
    address VARCHAR(255) NULL,
    city VARCHAR(120) NULL,
    state VARCHAR(120) NULL,
    country CHAR(2) NULL,
    timezone VARCHAR(80) NULL,
    locale VARCHAR(10) NULL,
    status ENUM('active','inactive','blocked','prospect') NOT NULL DEFAULT 'active',
    source VARCHAR(80) NULL,                   -- 'manual','import','sheets','api','call'
    is_vip BOOLEAN NOT NULL DEFAULT FALSE,
    important_notes TEXT NULL,
    custom_fields JSON NULL,
    last_interaction_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    KEY idx_cust_company_phone (company_id, primary_phone),
    KEY idx_cust_company_doc (company_id, document_number),
    KEY idx_cust_company_email (company_id, email),
    FULLTEXT KEY idx_cust_search (full_name, company_name, important_notes),
    CONSTRAINT fk_cust_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- customer_phones (alternos) -----------
CREATE TABLE IF NOT EXISTS customer_phones (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    phone VARCHAR(40) NOT NULL,
    label VARCHAR(60) NULL,                    -- 'mobile','home','work'
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_dnc BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE KEY uniq_cp (company_id, customer_id, phone),
    KEY idx_cp_phone (company_id, phone),
    CONSTRAINT fk_cp_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- customer_notes -----------
CREATE TABLE IF NOT EXISTS customer_notes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    note_type ENUM('general','important','followup','internal','warning') NOT NULL DEFAULT 'general',
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_cn_customer (customer_id, created_at),
    CONSTRAINT fk_cnotes_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- customer_tags (catálogo + relación) -----------
CREATE TABLE IF NOT EXISTS customer_tags (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    color_hex CHAR(7) NULL,
    UNIQUE KEY uniq_ct_slug (company_id, slug),
    CONSTRAINT fk_ct_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_tag_assignments (
    customer_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (customer_id, tag_id),
    CONSTRAINT fk_cta_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_cta_tag FOREIGN KEY (tag_id) REFERENCES customer_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- customer_interactions (timeline) -----------
CREATE TABLE IF NOT EXISTS customer_interactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    interaction_type ENUM('call','sms','email','note','ticket','appointment','ai_chat','webhook') NOT NULL,
    direction ENUM('inbound','outbound','internal') NULL,
    related_id BIGINT NULL,                    -- call_id, sms_id, ticket_id...
    summary VARCHAR(500) NULL,
    occurred_at TIMESTAMP NOT NULL,
    KEY idx_ci_customer (customer_id, occurred_at),
    CONSTRAINT fk_ci_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- tickets -----------
CREATE TABLE IF NOT EXISTS tickets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    customer_id BIGINT NULL,
    call_id BIGINT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NULL,
    status ENUM('open','in_progress','waiting_customer','resolved','closed','cancelled') NOT NULL DEFAULT 'open',
    priority ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
    assigned_to BIGINT NULL,
    due_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_t_company_status (company_id, status),
    KEY idx_t_customer (customer_id),
    CONSTRAINT fk_t_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- appointments -----------
CREATE TABLE IF NOT EXISTS appointments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    customer_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    start_at TIMESTAMP NOT NULL,
    end_at TIMESTAMP NULL,
    timezone VARCHAR(80) NULL,
    location VARCHAR(255) NULL,
    status ENUM('scheduled','confirmed','rescheduled','cancelled','completed','no_show') NOT NULL DEFAULT 'scheduled',
    reminder_sent_at TIMESTAMP NULL,
    created_by BIGINT NULL,
    created_via ENUM('manual','ai_bot','api','automation') NOT NULL DEFAULT 'manual',
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_app_company_start (company_id, start_at),
    KEY idx_app_customer (customer_id),
    CONSTRAINT fk_app_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- DNC lists — sugerencia añadida -----------
CREATE TABLE IF NOT EXISTS dnc_lists (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    source VARCHAR(80) NULL,                   -- 'manual','import','national_registry'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_dnc_slug (company_id, slug),
    CONSTRAINT fk_dnc_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dnc_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    dnc_list_id BIGINT NOT NULL,
    phone VARCHAR(40) NOT NULL,
    reason VARCHAR(255) NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_dnc_phone (dnc_list_id, phone),
    KEY idx_dnce_phone (company_id, phone),
    CONSTRAINT fk_dnce_list FOREIGN KEY (dnc_list_id) REFERENCES dnc_lists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- import_jobs -----------
CREATE TABLE IF NOT EXISTS import_jobs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    target_entity ENUM('customers','dnc','campaign_contacts') NOT NULL,
    source ENUM('xlsx','csv','google_sheets','api','mysql_external') NOT NULL,
    file_path VARCHAR(500) NULL,
    connector_id BIGINT NULL,
    column_mapping JSON NOT NULL,
    options JSON NULL,                         -- {dedupe_by:'phone', skip_dnc:true}
    status ENUM('pending','validating','running','completed','failed','partially_completed') NOT NULL DEFAULT 'pending',
    total_rows INT NULL,
    processed_rows INT NOT NULL DEFAULT 0,
    success_rows INT NOT NULL DEFAULT 0,
    error_rows INT NOT NULL DEFAULT 0,
    skipped_rows INT NOT NULL DEFAULT 0,
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ij_company (company_id, created_at),
    CONSTRAINT fk_ij_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS import_job_rows (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    import_job_id BIGINT NOT NULL,
    row_index INT NOT NULL,
    raw_data JSON NULL,
    status ENUM('ok','error','skipped','duplicate') NOT NULL,
    error_message TEXT NULL,
    target_id BIGINT NULL,
    KEY idx_ijr_job (import_job_id, status),
    CONSTRAINT fk_ijr_job FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
