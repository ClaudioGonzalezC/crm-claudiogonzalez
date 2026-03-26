-- =============================================================================
-- FASE 1 — BLOQUE 1 (v2): Ampliar tablas base + CREATE settings
-- Archivo: fase1_bloque1_alter_base_tables.sql
-- Fuente de verdad: V2.Especificación CRM Freelance Chile
-- Principio: Solo ALTER ADD y CREATE TABLE IF NOT EXISTS.
-- Nada se elimina. El sistema actual sigue funcionando.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AMPLIAR TABLA proyectos
--    Fuente: spec sección 4.3
--    Regla: NO se toca la columna `estado` existente (dual mode)
--    status_v2 es el campo V2 paralelo al `estado` legacy
-- -----------------------------------------------------------------------------

ALTER TABLE proyectos
  -- Workflow V2: estado paralelo (legacy `estado` se mantiene intacto)
  ADD COLUMN IF NOT EXISTS status_v2 ENUM(
    'Draft','Evaluating','Quoted','Approved','Executing','Boleta','Closed'
  ) DEFAULT NULL
    COMMENT 'Estado V2. NULL = proyecto legacy sin migrar.',

  -- Flags de workflow V2
  ADD COLUMN IF NOT EXISTS has_project_eval TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Flag: evaluación pre-proyecto completada',
  ADD COLUMN IF NOT EXISTS emotional_eval_completed TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Flag: evaluación emocional completada (requerida en Boleta antes de Closed)',
  ADD COLUMN IF NOT EXISTS profit_calculated TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Flag: rentabilidad V2 calculada y congelada',

  -- Snapshots financieros congelados al crear el proyecto
  ADD COLUMN IF NOT EXISTS cost_hour DECIMAL(10,2) NOT NULL DEFAULT 25000
    COMMENT 'Snapshot del costo hora efectivo al crear el proyecto (de settings)',
  ADD COLUMN IF NOT EXISTS overhead_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0
    COMMENT 'Snapshot del overhead mensual proporcional al crear el proyecto',

  -- Campos de rentabilidad y métricas V2
  ADD COLUMN IF NOT EXISTS real_hours DECIMAL(6,2) NOT NULL DEFAULT 0
    COMMENT 'Horas reales acumuladas. Actualizado por trigger trg_time_logs_*',
  ADD COLUMN IF NOT EXISTS eval_score INT NOT NULL DEFAULT 0
    COMMENT 'Score de evaluación pre-proyecto (0-100)',
  ADD COLUMN IF NOT EXISTS net_profit DECIMAL(12,2) DEFAULT NULL
    COMMENT 'Rentabilidad neta final. Calculada por calculateFinalProfit()',
  ADD COLUMN IF NOT EXISTS stress_score DECIMAL(3,1) DEFAULT NULL
    COMMENT 'Nivel de estrés del proyecto. Cargado desde emotional_evals',

  -- Control de fechas V2
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP NULL DEFAULT NULL
    COMMENT 'Fecha y hora del cierre formal (finalize_close). NULL si no está cerrado';


-- -----------------------------------------------------------------------------
-- 2. AMPLIAR TABLA clientes
--    Fuente: spec sección 4.2 (tabla clients en V2)
--    Ajuste: se añaden columnas al nombre de tabla existente `clientes`
-- -----------------------------------------------------------------------------

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS rut VARCHAR(12) DEFAULT NULL
    COMMENT 'RUT del cliente (ej: 12.345.678-9). Requerido para boletas.',
  ADD COLUMN IF NOT EXISTS billing_address TEXT DEFAULT NULL
    COMMENT 'Dirección de facturación para emisión de boletas',
  ADD COLUMN IF NOT EXISTS total_projects INT NOT NULL DEFAULT 0
    COMMENT 'Métrica V2: total de proyectos del cliente',
  ADD COLUMN IF NOT EXISTS total_profit DECIMAL(12,2) NOT NULL DEFAULT 0
    COMMENT 'Métrica V2: suma de net_profit de todos los proyectos cerrados del cliente',
  ADD COLUMN IF NOT EXISTS avg_stress DECIMAL(3,1) NOT NULL DEFAULT 0
    COMMENT 'Métrica V2: promedio de stress_score de los proyectos cerrados del cliente';


-- -----------------------------------------------------------------------------
-- 3. AMPLIAR TABLA horas (time_logs en spec V2)
--    Fuente: spec sección 4.10
--    ENUM correcto: billable_dev | meeting | non_billable_fix | admin
--    DEFAULT 'billable_dev' cubre todos los registros legacy existentes
-- -----------------------------------------------------------------------------

ALTER TABLE horas
  ADD COLUMN IF NOT EXISTS type ENUM(
    'billable_dev',
    'meeting',
    'non_billable_fix',
    'admin'
  ) NOT NULL DEFAULT 'billable_dev'
    COMMENT 'Categoría V2 del registro de horas. Default billable_dev cubre registros legacy.';


-- -----------------------------------------------------------------------------
-- 4. CREAR TABLA settings (key-value)
--    Fuente: spec sección 4.1
--    IMPORTANTE: Esquema key-value, no columnas individuales.
--    La lógica PHP consulta por config('settings.{key}')
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
  id         INT NOT NULL AUTO_INCREMENT,
  `key`      VARCHAR(50) NOT NULL,
  value      DECIMAL(12,2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_key (`key`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Configuración financiera global. Esquema key-value. Spec V2 sección 4.1.';

-- Seed obligatorio (spec sección 5) — solo inserta si la tabla está vacía
INSERT INTO settings (`key`, value)
SELECT k, v FROM (
  SELECT 'monthly_overhead'       AS k, 800000 AS v UNION ALL
  SELECT 'effective_hourly_cost',          25000      UNION ALL
  SELECT 'monthly_capacity_hours',           120      UNION ALL
  SELECT 'min_profit_margin_pct',             25      UNION ALL
  SELECT 'retention_rate_2026',            15.25
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM settings LIMIT 1);


-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- Ejecutar para confirmar que los cambios se aplicaron correctamente
-- =============================================================================

-- Verificar columnas nuevas en proyectos
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'proyectos'
  AND COLUMN_NAME IN (
    'status_v2','has_project_eval','emotional_eval_completed',
    'profit_calculated','cost_hour','overhead_snapshot',
    'real_hours','eval_score','net_profit','stress_score','closed_at'
  )
ORDER BY COLUMN_NAME;

-- Verificar columnas nuevas en clientes
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'clientes'
  AND COLUMN_NAME IN ('rut','billing_address','total_projects','total_profit','avg_stress')
ORDER BY COLUMN_NAME;

-- Verificar columna nueva en horas
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'horas'
  AND COLUMN_NAME = 'type';

-- Verificar tabla settings y seed
SELECT * FROM settings ORDER BY id;
