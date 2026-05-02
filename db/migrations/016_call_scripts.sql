-- =====================================================================
--  016_call_scripts.sql
--  Guiones de llamada (call scripts) — texto/HTML que el agente ve
--  como apoyo durante la llamada en el panel del dialer.
--  Configurables desde /admin/call-scripts (UI futura) o vía API.
--  Cada guion tiene un tipo: 'outbound', 'inbound' o 'both'.
-- =====================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS call_scripts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,                       -- markdown o HTML
    script_type ENUM('outbound','inbound','both') NOT NULL DEFAULT 'both',
    sort_order INT NOT NULL DEFAULT 100,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_call_scripts_company (company_id, is_active, script_type, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Si la tabla ya existe (re-run), agrega script_type si falta (idempotente).
SET @col_check := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'call_scripts'
      AND COLUMN_NAME = 'script_type'
);
SET @sql := IF(@col_check = 0,
    'ALTER TABLE call_scripts ADD COLUMN script_type ENUM(''outbound'',''inbound'',''both'') NOT NULL DEFAULT ''both'' AFTER content',
    'SELECT ''script_type already exists'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Seeds iniciales con script_type asignado (saliente / entrante / ambos).
INSERT INTO call_scripts (company_id, name, content, script_type, sort_order, is_active)
SELECT 1, 'Saludo institucional (saliente)',
'## 🎯 Saludo inicial\n\n**Buenos días/tardes**, le saluda *[tu nombre]* del Hospital San Juan de Dios de Honda. ¿Con quién tengo el gusto?\n\n---\n\n## ✅ Verificar identidad\n\n- Nombre completo del paciente\n- Documento de identidad\n- Fecha de nacimiento\n\n---\n\n## 📞 Motivo de la llamada\n\nLe contacto en relación a:\n- [ ] Confirmación de cita\n- [ ] Reagendamiento\n- [ ] Resultados de exámenes\n- [ ] Encuesta de satisfacción\n\n---\n\n## 🙏 Cierre\n\nGracias por su tiempo. Que tenga un excelente día.',
'outbound', 10, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM call_scripts WHERE company_id = 1 AND name = 'Saludo institucional (saliente)');

INSERT INTO call_scripts (company_id, name, content, script_type, sort_order, is_active)
SELECT 1, 'Atención al paciente (entrante)',
'## 📞 Saludo de entrada\n\n**Hospital San Juan de Dios de Honda**, le saluda *[tu nombre]*. ¿En qué puedo ayudarle?\n\n---\n\n## 👤 Identificar al paciente\n\n- Nombre completo\n- Documento de identidad\n- ¿Es paciente activo?\n\n---\n\n## ❓ Motivo de la llamada\n\n- [ ] Solicitud de cita\n- [ ] Información sobre servicios\n- [ ] Consulta de resultados\n- [ ] Reclamo o sugerencia\n- [ ] Urgencia médica → **transferir a urgencias**\n\n---\n\n## 🙏 Cierre\n\nGracias por contactarnos. ¿Algo más en que pueda ayudarle?',
'inbound', 10, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM call_scripts WHERE company_id = 1 AND name = 'Atención al paciente (entrante)');

INSERT INTO call_scripts (company_id, name, content, script_type, sort_order, is_active)
SELECT 1, 'Manejo de objeciones',
'## ❓ Si dice "no tengo tiempo"\n\n*"Entiendo, será solo un minuto. ¿Prefiere que lo llame en otro momento?"*\n\n## ❌ Si rechaza la cita\n\n*"Comprendo. ¿Puedo ayudarle con algo más?"*\n\n## 🤔 Si tiene dudas médicas\n\n*"Le transfiero con el área correspondiente. Un momento por favor."*',
'both', 20, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM call_scripts WHERE company_id = 1 AND name = 'Manejo de objeciones');
