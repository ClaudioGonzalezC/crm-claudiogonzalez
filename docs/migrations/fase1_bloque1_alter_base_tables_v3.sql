-- =============================================================================
-- FASE 1 — BLOQUE 1 (v3): Ampliar tablas base + CREATE settings
-- Archivo: fase1_bloque1_alter_base_tables_v3.sql
-- Fuente de verdad: /docs/crm_spec.md
-- Fecha: 2026-03-22
--
-- COMPATIBILIDAD: MySQL 5.7+ (NO usa ADD COLUMN IF NOT EXISTS)
-- PRINCIPIO: Additive only. Cero DROP, cero MODIFY, cero cambios a columnas existentes.
-- TABLAS REALES: proyectos · clientes · bitacora_horas
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. AMPLIAR TABLA proyectos — columnas V2
--    La columna `estado` existente NO se toca (dual mode).
--    Ejecutar completo. Si ya existe alguna columna, MySQL lanzará error —
--    en ese caso comentar esa línea específica y re-ejecutar.
-- -----------------------------------------------------------------------------

ALTER TABLE proyectos
  ADD COLUMN status_v2 ENUM(
    'Draft','Evaluating','Quoted','Approved','Executing','Boleta','Closed'
  ) DEFAULT NULL
    COMMENT 'Estado V2. NULL = proyecto legacy sin migrar.',

  ADD COLUMN has_project_eval TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Flag: evaluación pre-proyecto completada. Requerida para avanzar a Quoted.',

  ADD COLUMN emotional_eval_completed TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Flag: evaluación emocional completada. Requerida en Boleta antes de Closed.',

  ADD COLUMN profit_calculated TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Flag: rentabilidad V2 calculada y congelada. Requerida para finalize_close.',

  ADD COLUMN cost_hour DECIMAL(10,2) NOT NULL DEFAULT 25000
    COMMENT 'Snapshot costo hora al crear proyecto. Fuente: settings.effective_hourly_cost.',

  ADD COLUMN overhead_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0
    COMMENT 'Snapshot overhead proporcional al crear proyecto. Fuente: settings.monthly_overhead.',

  ADD COLUMN real_hours DECIMAL(6,2) NOT NULL DEFAULT 0
    COMMENT 'Horas reales acumuladas. Actualizado por triggers en bitacora_horas.',

  ADD COLUMN eval_score INT NOT NULL DEFAULT 0
    COMMENT 'Score evaluación pre-proyecto (0-100).',

  ADD COLUMN net_profit DECIMAL(12,2) DEFAULT NULL
    COMMENT 'Rentabilidad neta final. NULL hasta que se ejecute calculate-profit.',

  ADD COLUMN stress_score DECIMAL(3,1) DEFAULT NULL
    COMMENT 'Nivel de estrés (1.0-10.0). Copiado desde emotional_evals al cerrar.',

  ADD COLUMN closed_at TIMESTAMP NULL DEFAULT NULL
    COMMENT 'Timestamp del cierre formal (finalize_close).';


-- -----------------------------------------------------------------------------
-- 2. AMPLIAR TABLA clientes — columnas V2
-- -----------------------------------------------------------------------------

ALTER TABLE clientes
  ADD COLUMN rut VARCHAR(12) DEFAULT NULL
    COMMENT 'RUT del cliente (ej: 12.345.678-9). Requerido para emitir boletas.',

  ADD COLUMN billing_address TEXT DEFAULT NULL
    COMMENT 'Dirección de facturación para boletas.',

  ADD COLUMN total_projects INT NOT NULL DEFAULT 0
    COMMENT 'Métrica V2: total de proyectos del cliente.',

  ADD COLUMN total_profit DECIMAL(12,2) NOT NULL DEFAULT 0
    COMMENT 'Métrica V2: suma de net_profit de proyectos cerrados del cliente.',

  ADD COLUMN avg_stress DECIMAL(3,1) NOT NULL DEFAULT 0
    COMMENT 'Métrica V2: promedio de stress_score de proyectos cerrados del cliente.';


-- -----------------------------------------------------------------------------
-- 3. AMPLIAR TABLA bitacora_horas — campo type
--    Columnas actuales confirmadas: id, proyecto_id, horas, descripcion,
--                                    fecha_trabajo, fecha_creacion
--    DEFAULT 'billable_dev' cubre todos los registros legacy existentes.
-- -----------------------------------------------------------------------------

ALTER TABLE bitacora_horas
  ADD COLUMN type ENUM(
    'billable_dev',
    'meeting',
    'non_billable_fix',
    'admin'
  ) NOT NULL DEFAULT 'billable_dev'
    COMMENT 'Categoría V2 del registro. Default billable_dev cubre registros legacy.';


-- -----------------------------------------------------------------------------
-- 4. CREAR TABLA settings (key-value)
--    Esquema key-value obligatorio. NO columnas individuales. Fuente: crm_spec.md
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
  id         INT           NOT NULL AUTO_INCREMENT,
  `key`      VARCHAR(50)   NOT NULL,
  value      DECIMAL(12,2) DEFAULT NULL,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_key (`key`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Configuración financiera global. Esquema key-value. Fuente: crm_spec.md.';

-- Seed oficial (solo inserta si la tabla está vacía)
INSERT INTO settings (`key`, value)
SELECT k, v FROM (
  SELECT 'monthly_overhead'        AS k, 800000 AS v UNION ALL
  SELECT 'effective_hourly_cost',           25000      UNION ALL
  SELECT 'monthly_capacity_hours',            120      UNION ALL
  SELECT 'min_profit_margin_pct',              25      UNION ALL
  SELECT 'retention_rate_2026',             15.25
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM settings LIMIT 1);


-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- Ejecutar después del script para confirmar resultados.
-- =============================================================================

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'proyectos'
  AND COLUMN_NAME IN (
    'status_v2','has_project_eval','emotional_eval_completed',
    'profit_calculated','cost_hour','overhead_snapshot',
    'real_hours','eval_score','net_profit','stress_score','closed_at'
  )
ORDER BY COLUMN_NAME;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'clientes'
  AND COLUMN_NAME IN ('rut','billing_address','total_projects','total_profit','avg_stress')
ORDER BY COLUMN_NAME;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'bitacora_horas'
  AND COLUMN_NAME = 'type';

SELECT * FROM settings ORDER BY id;
