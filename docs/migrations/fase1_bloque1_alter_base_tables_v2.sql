-- =============================================================================
-- FASE 1 — BLOQUE 1 (corregido): Ampliar tablas base + CREATE settings
-- Archivo: fase1_bloque1_alter_base_tables_v2.sql
-- Fuente de verdad: /docs/crm_spec.md
-- Fecha corrección: 2026-03-22
--
-- CORRECCIONES respecto al archivo anterior (fase1_bloque1_alter_base_tables.sql):
--   - Tabla de horas: real name = bitacora_horas (no horas, no time_logs)
--   - bitacora_horas tiene: proyecto_id, horas, fecha_trabajo
--
-- Principio: Solo ALTER ADD COLUMN IF NOT EXISTS y CREATE TABLE IF NOT EXISTS.
-- No se elimina nada. No se modifica ninguna columna existente.
-- El sistema actual sigue funcionando sin cambios.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. AMPLIAR TABLA proyectos
--    Columnas V2 agregadas en paralelo a las columnas legacy existentes.
--    La columna `estado` existente NO se toca (dual mode: estado legacy + status_v2).
-- -----------------------------------------------------------------------------

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS status_v2 ENUM(
    'Draft','Evaluating','Quoted','Approved','Executing','Boleta','Closed'
  ) DEFAULT NULL
    COMMENT 'Estado V2. NULL = proyecto legacy sin migrar al workflow V2.',

  ADD COLUMN IF NOT EXISTS has_project_eval TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Flag V2: 1 = evaluación pre-proyecto completada. Requerida para avanzar a Quoted.',

  ADD COLUMN IF NOT EXISTS emotional_eval_completed TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Flag V2: 1 = evaluación emocional completada. Requerida en Boleta antes de Closed.',

  ADD COLUMN IF NOT EXISTS profit_calculated TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Flag V2: 1 = rentabilidad calculada y congelada. Requerida para finalize_close.',

  ADD COLUMN IF NOT EXISTS cost_hour DECIMAL(10,2) NOT NULL DEFAULT 25000
    COMMENT 'Snapshot del costo hora efectivo al crear el proyecto. Fuente: settings.effective_hourly_cost.',

  ADD COLUMN IF NOT EXISTS overhead_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0
    COMMENT 'Snapshot del overhead mensual proporcional al crear el proyecto. Fuente: settings.monthly_overhead.',

  ADD COLUMN IF NOT EXISTS real_hours DECIMAL(6,2) NOT NULL DEFAULT 0
    COMMENT 'Horas reales acumuladas. Actualizado por triggers en bitacora_horas.',

  ADD COLUMN IF NOT EXISTS eval_score INT NOT NULL DEFAULT 0
    COMMENT 'Score de evaluación pre-proyecto (0-100). Calculado al completar answers.',

  ADD COLUMN IF NOT EXISTS net_profit DECIMAL(12,2) DEFAULT NULL
    COMMENT 'Rentabilidad neta final V2. NULL hasta que se ejecute calculate-profit.',

  ADD COLUMN IF NOT EXISTS stress_score DECIMAL(3,1) DEFAULT NULL
    COMMENT 'Nivel de estrés del proyecto (1.0-10.0). Copiado desde emotional_evals.stress_level.',

  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP NULL DEFAULT NULL
    COMMENT 'Timestamp del cierre formal (finalize_close). NULL si no está cerrado.';


-- -----------------------------------------------------------------------------
-- 2. AMPLIAR TABLA clientes
--    Columnas V2 para RUT, facturación y métricas calculadas.
-- -----------------------------------------------------------------------------

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS rut VARCHAR(12) DEFAULT NULL
    COMMENT 'RUT del cliente (ej: 12.345.678-9). Requerido para emitir boletas.',

  ADD COLUMN IF NOT EXISTS billing_address TEXT DEFAULT NULL
    COMMENT 'Dirección de facturación para emisión de boletas.',

  ADD COLUMN IF NOT EXISTS total_projects INT NOT NULL DEFAULT 0
    COMMENT 'Métrica V2: total de proyectos del cliente (cerrados + activos).',

  ADD COLUMN IF NOT EXISTS total_profit DECIMAL(12,2) NOT NULL DEFAULT 0
    COMMENT 'Métrica V2: suma de net_profit de proyectos cerrados del cliente.',

  ADD COLUMN IF NOT EXISTS avg_stress DECIMAL(3,1) NOT NULL DEFAULT 0
    COMMENT 'Métrica V2: promedio de stress_score de proyectos cerrados del cliente.';


-- -----------------------------------------------------------------------------
-- 3. AMPLIAR TABLA bitacora_horas
--    Tabla real de time tracking en el sistema actual.
--    Columnas existentes confirmadas: proyecto_id, horas, fecha_trabajo
--    Se agrega solo el campo type del ENUM V2.
--    DEFAULT 'billable_dev' cubre todos los registros legacy existentes.
-- -----------------------------------------------------------------------------

ALTER TABLE bitacora_horas
  ADD COLUMN IF NOT EXISTS type ENUM(
    'billable_dev',
    'meeting',
    'non_billable_fix',
    'admin'
  ) NOT NULL DEFAULT 'billable_dev'
    COMMENT 'Categoría V2 del registro. Default billable_dev cubre todos los registros legacy.';


-- -----------------------------------------------------------------------------
-- 4. CREAR TABLA settings (key-value)
--    Esquema key-value. NO usar columnas individuales. Fuente: /docs/crm_spec.md
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
  id         INT          NOT NULL AUTO_INCREMENT,
  `key`      VARCHAR(50)  NOT NULL,
  value      DECIMAL(12,2) DEFAULT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_key (`key`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Configuración financiera global. Esquema key-value. Fuente: crm_spec.md.';

-- Seed obligatorio — solo inserta si la tabla está vacía
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
-- Ejecutar para confirmar que los cambios se aplicaron correctamente.
-- =============================================================================

-- 1. Columnas nuevas en proyectos
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'proyectos'
  AND COLUMN_NAME IN (
    'status_v2','has_project_eval','emotional_eval_completed',
    'profit_calculated','cost_hour','overhead_snapshot',
    'real_hours','eval_score','net_profit','stress_score','closed_at'
  )
ORDER BY COLUMN_NAME;

-- 2. Columnas nuevas en clientes
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'clientes'
  AND COLUMN_NAME IN ('rut','billing_address','total_projects','total_profit','avg_stress')
ORDER BY COLUMN_NAME;

-- 3. Columna nueva en bitacora_horas
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'bitacora_horas'
  AND COLUMN_NAME  = 'type';

-- 4. Tabla settings y seed
SELECT * FROM settings ORDER BY id;
