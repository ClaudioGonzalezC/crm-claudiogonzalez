-- =============================================================================
-- FASE 1 — BLOQUE 1: Ampliar tablas base para soporte V2
-- Archivo: fase1_bloque1_alter_base_tables.sql
-- Principio: Solo ALTER y CREATE. Nada se elimina ni modifica en este script.
-- El sistema actual sigue funcionando sin cambios.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AMPLIAR TABLA proyectos
--    Agrega status_v2 + 4 flags + 2 snapshots financieros
--    NO toca la columna `estado` existente (dual mode)
-- -----------------------------------------------------------------------------

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS status_v2 ENUM(
    'Draft',
    'Evaluating',
    'Quoted',
    'Approved',
    'Executing',
    'Boleta',
    'Closed'
  ) DEFAULT NULL COMMENT 'Estado V2 del workflow. NULL = proyecto legacy sin migrar.',

  ADD COLUMN IF NOT EXISTS has_project_eval TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Flag: evaluación pre-proyecto completada (tabla project_evals)',

  ADD COLUMN IF NOT EXISTS emotional_eval_completed TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Flag: evaluación emocional completada. Requerida en estado Boleta antes de Closed.',

  ADD COLUMN IF NOT EXISTS profit_calculated TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Flag: rentabilidad V2 calculada y congelada en este proyecto',

  ADD COLUMN IF NOT EXISTS cost_hour DECIMAL(10,2) DEFAULT NULL
    COMMENT 'Snapshot del costo hora efectivo al momento de crear el proyecto (desde tabla settings)',

  ADD COLUMN IF NOT EXISTS overhead_snapshot DECIMAL(10,2) DEFAULT NULL
    COMMENT 'Snapshot del overhead mensual al momento de crear el proyecto (desde tabla settings)';


-- -----------------------------------------------------------------------------
-- 2. AMPLIAR TABLA clientes
--    Agrega RUT, dirección de facturación y métricas V2
--    NO modifica columnas existentes
-- -----------------------------------------------------------------------------

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS rut VARCHAR(20) DEFAULT NULL
    COMMENT 'RUT del cliente para boletas chilenas (ej: 12.345.678-9)',

  ADD COLUMN IF NOT EXISTS billing_address TEXT DEFAULT NULL
    COMMENT 'Dirección de facturación para emisión de boletas',

  ADD COLUMN IF NOT EXISTS total_proyectos INT NOT NULL DEFAULT 0
    COMMENT 'Métrica V2: total de proyectos asociados al cliente',

  ADD COLUMN IF NOT EXISTS proyectos_activos INT NOT NULL DEFAULT 0
    COMMENT 'Métrica V2: proyectos en estado activo (Executing o Boleta)',

  ADD COLUMN IF NOT EXISTS total_invertido DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'Métrica V2: suma de monto_bruto de todos los proyectos del cliente';


-- -----------------------------------------------------------------------------
-- 3. AMPLIAR TABLA horas (time_logs)
--    Agrega campo type para categorizar el tipo de hora registrada
--    NO modifica registros existentes (DEFAULT 'billable_dev' cubre legacy)
-- -----------------------------------------------------------------------------

ALTER TABLE horas
  ADD COLUMN IF NOT EXISTS type ENUM(
    'billable_dev',
    'meeting',
    'revision',
    'internal',
    'admin'
  ) NOT NULL DEFAULT 'billable_dev'
    COMMENT 'Tipo de hora V2. Default billable_dev cubre todos los registros legacy existentes.';


-- -----------------------------------------------------------------------------
-- 4. CREAR TABLA settings
--    Configuración financiera global del freelancer
--    Solo debe existir 1 fila (la fila activa de configuración)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
  id                      INT NOT NULL AUTO_INCREMENT,
  monthly_overhead        DECIMAL(10,2) NOT NULL DEFAULT 0.00
    COMMENT 'Gastos fijos mensuales totales (arriendo, software, etc.) en CLP',
  effective_hourly_cost   DECIMAL(10,2) NOT NULL DEFAULT 0.00
    COMMENT 'Costo hora efectivo = monthly_overhead / monthly_capacity_hours',
  monthly_capacity_hours  INT NOT NULL DEFAULT 160
    COMMENT 'Horas facturables disponibles por mes',
  min_profit_margin_pct   DECIMAL(5,2) NOT NULL DEFAULT 30.00
    COMMENT 'Margen mínimo de rentabilidad aceptable (%)',
  retention_rate          DECIMAL(5,2) NOT NULL DEFAULT 15.25
    COMMENT 'Tasa de retención de honorarios chilena (% aplicado en boletas)',
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Configuración financiera global del freelancer. Solo 1 fila activa.';

-- Insertar fila inicial solo si la tabla está vacía
INSERT INTO settings (
  monthly_overhead,
  effective_hourly_cost,
  monthly_capacity_hours,
  min_profit_margin_pct,
  retention_rate
)
SELECT 0.00, 0.00, 160, 30.00, 15.25
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
    'profit_calculated','cost_hour','overhead_snapshot'
  )
ORDER BY COLUMN_NAME;

-- Verificar columnas nuevas en clientes
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'clientes'
  AND COLUMN_NAME IN ('rut','billing_address','total_proyectos','proyectos_activos','total_invertido')
ORDER BY COLUMN_NAME;

-- Verificar columna nueva en horas
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'horas'
  AND COLUMN_NAME = 'type';

-- Verificar tabla settings
SELECT * FROM settings;
