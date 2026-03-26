-- =============================================================================
-- FASE 1 — BLOQUE 3: Triggers + Views V2
-- Archivo: fase1_bloque3_triggers_views.sql
-- Fuente de verdad: /docs/crm_spec.md
-- Fecha: 2026-03-22
--
-- SCHEMA REAL CONFIRMADO:
--   proyectos.id, proyectos.nombre_proyecto, proyectos.real_hours
--   bitacora_horas.proyecto_id, bitacora_horas.horas, bitacora_horas.fecha_trabajo
--   boletas.project_id, project_expenses.project_id, emotional_evals.project_id
--
-- ORDEN DE EJECUCIÓN:
--   1. Triggers (requieren proyectos + bitacora_horas ya alterados ✅)
--   2. Views base históricas (v_boletas_monthly, v_time_monthly, v_expenses_monthly, v_emotional_project)
--   3. Views compuestas (monthly_control, dashboard_metrics)
-- =============================================================================


-- =============================================================================
-- PARTE 1 — TRIGGERS en bitacora_horas
-- Actualizan proyectos.real_hours automáticamente.
-- Fuente: crm_spec.md — Trigger obligatorio
-- =============================================================================

DELIMITER $$

-- -----------------------------------------------------------------------------
-- INSERT: sumar horas nuevas al proyecto
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_bitacora_horas_insert$$

CREATE TRIGGER trg_bitacora_horas_insert
AFTER INSERT ON bitacora_horas
FOR EACH ROW
BEGIN
  UPDATE proyectos
  SET real_hours = real_hours + NEW.horas
  WHERE id = NEW.proyecto_id;
END$$


-- -----------------------------------------------------------------------------
-- DELETE: restar horas eliminadas al proyecto
--   GREATEST(0, ...) previene valores negativos por inconsistencias legacy.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_bitacora_horas_delete$$

CREATE TRIGGER trg_bitacora_horas_delete
AFTER DELETE ON bitacora_horas
FOR EACH ROW
BEGIN
  UPDATE proyectos
  SET real_hours = GREATEST(0, real_hours - OLD.horas)
  WHERE id = OLD.proyecto_id;
END$$


-- -----------------------------------------------------------------------------
-- UPDATE: ajustar diferencia de horas (old → new)
--   Maneja cambio de proyecto_id si el registro se mueve entre proyectos.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_bitacora_horas_update$$

CREATE TRIGGER trg_bitacora_horas_update
AFTER UPDATE ON bitacora_horas
FOR EACH ROW
BEGIN
  IF OLD.proyecto_id = NEW.proyecto_id THEN
    -- Mismo proyecto: ajustar diferencia
    UPDATE proyectos
    SET real_hours = GREATEST(0, real_hours - OLD.horas + NEW.horas)
    WHERE id = NEW.proyecto_id;
  ELSE
    -- Cambio de proyecto: restar al anterior, sumar al nuevo
    UPDATE proyectos
    SET real_hours = GREATEST(0, real_hours - OLD.horas)
    WHERE id = OLD.proyecto_id;

    UPDATE proyectos
    SET real_hours = real_hours + NEW.horas
    WHERE id = NEW.proyecto_id;
  END IF;
END$$

DELIMITER ;


-- =============================================================================
-- PARTE 2 — VISTAS BASE (históricas, sin filtro temporal fijo)
-- Fuente: crm_spec.md — "Las vistas base son históricas."
-- =============================================================================

-- -----------------------------------------------------------------------------
-- v_boletas_monthly
-- Resumen mensual de boletas: bruto, retención, líquido, cobrado, F29 pendiente.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_boletas_monthly AS
SELECT
  YEAR(fecha_emision)                                                        AS year,
  MONTH(fecha_emision)                                                       AS month,
  COUNT(*)                                                                   AS total_boletas,
  SUM(monto_bruto)                                                           AS total_bruto,
  SUM(monto_retencion)                                                       AS total_retencion,
  SUM(monto_liquido)                                                         AS total_liquido,
  SUM(CASE WHEN paid_date IS NOT NULL THEN monto_liquido ELSE 0 END)        AS liquido_cobrado,
  SUM(CASE WHEN f29_paid = 0 AND paid_date IS NOT NULL THEN 1 ELSE 0 END)   AS f29_pendientes
FROM boletas
GROUP BY YEAR(fecha_emision), MONTH(fecha_emision)
ORDER BY year DESC, month DESC;


-- -----------------------------------------------------------------------------
-- v_time_monthly
-- Resumen mensual de horas por tipo. Usa bitacora_horas (real schema).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_time_monthly AS
SELECT
  YEAR(fecha_trabajo)   AS year,
  MONTH(fecha_trabajo)  AS month,
  type,
  COUNT(*)              AS registros,
  SUM(horas)            AS total_horas
FROM bitacora_horas
GROUP BY YEAR(fecha_trabajo), MONTH(fecha_trabajo), type
ORDER BY year DESC, month DESC, type;


-- -----------------------------------------------------------------------------
-- v_expenses_monthly
-- Resumen mensual de gastos por categoría.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_expenses_monthly AS
SELECT
  YEAR(expense_date)    AS year,
  MONTH(expense_date)   AS month,
  category,
  COUNT(*)              AS registros,
  SUM(amount)           AS total_gastos
FROM project_expenses
GROUP BY YEAR(expense_date), MONTH(expense_date), category
ORDER BY year DESC, month DESC, category;


-- -----------------------------------------------------------------------------
-- v_emotional_project
-- Evaluación emocional por proyecto. JOIN con proyectos para contexto.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_emotional_project AS
SELECT
  p.id                      AS project_id,
  p.nombre_proyecto         AS project_name,
  p.status_v2,
  p.stress_score            AS stress_en_proyecto,
  e.satisfaction_score,
  e.stress_level,
  e.client_conflicts,
  e.would_repeat,
  e.learning_outcome,
  e.final_notes,
  e.created_at              AS eval_fecha
FROM proyectos p
INNER JOIN emotional_evals e ON e.project_id = p.id;


-- =============================================================================
-- PARTE 3 — VISTAS COMPUESTAS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- monthly_control
-- Control mensual completo: boletas + gastos + horas por mes.
-- Combina las tres fuentes en una sola vista.
-- El backend PHP aplica WHERE year = X AND month = Y para filtrar mes específico.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW monthly_control AS
SELECT
  y.year,
  y.month,
  COALESCE(b.total_bruto,      0)  AS bruto_mes,
  COALESCE(b.total_retencion,  0)  AS retencion_mes,
  COALESCE(b.total_liquido,    0)  AS liquido_mes,
  COALESCE(b.liquido_cobrado,  0)  AS liquido_cobrado,
  COALESCE(b.f29_pendientes,   0)  AS f29_pendientes,
  COALESCE(e.total_gastos,     0)  AS gastos_mes,
  COALESCE(t.total_horas,      0)  AS horas_mes,
  COALESCE(b.liquido_cobrado, 0)
    - COALESCE(e.total_gastos, 0)  AS resultado_mes
FROM (
  -- Eje temporal: todos los meses donde haya actividad en cualquier tabla
  SELECT YEAR(fecha_emision)  AS year, MONTH(fecha_emision)  AS month FROM boletas
  UNION
  SELECT YEAR(expense_date),         MONTH(expense_date)          FROM project_expenses
  UNION
  SELECT YEAR(fecha_trabajo),        MONTH(fecha_trabajo)         FROM bitacora_horas
) y
LEFT JOIN (
  SELECT
    YEAR(fecha_emision)  AS year,
    MONTH(fecha_emision) AS month,
    SUM(monto_bruto)     AS total_bruto,
    SUM(monto_retencion) AS total_retencion,
    SUM(monto_liquido)   AS total_liquido,
    SUM(CASE WHEN paid_date IS NOT NULL THEN monto_liquido ELSE 0 END)      AS liquido_cobrado,
    SUM(CASE WHEN f29_paid = 0 AND paid_date IS NOT NULL THEN 1 ELSE 0 END) AS f29_pendientes
  FROM boletas
  GROUP BY YEAR(fecha_emision), MONTH(fecha_emision)
) b ON b.year = y.year AND b.month = y.month
LEFT JOIN (
  SELECT
    YEAR(expense_date)  AS year,
    MONTH(expense_date) AS month,
    SUM(amount)         AS total_gastos
  FROM project_expenses
  GROUP BY YEAR(expense_date), MONTH(expense_date)
) e ON e.year = y.year AND e.month = y.month
LEFT JOIN (
  SELECT
    YEAR(fecha_trabajo)  AS year,
    MONTH(fecha_trabajo) AS month,
    SUM(horas)           AS total_horas
  FROM bitacora_horas
  GROUP BY YEAR(fecha_trabajo), MONTH(fecha_trabajo)
) t ON t.year = y.year AND t.month = y.month
ORDER BY y.year DESC, y.month DESC;


-- -----------------------------------------------------------------------------
-- dashboard_metrics
-- Métricas globales por status_v2. Usa status_v2 (no el campo legado `estado`).
-- Proyectos legacy (status_v2 IS NULL) agrupados como 'Legacy'.
-- El backend aplica WHERE para filtrar mes si necesita vista mensual.
-- Fuente: crm_spec.md — "filtros mensuales solo en dashboard_metrics"
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT
  COALESCE(status_v2, 'Legacy')                                              AS estado_v2,
  COUNT(*)                                                                   AS total_proyectos,
  SUM(real_hours)                                                            AS total_horas,
  ROUND(AVG(stress_score), 1)                                                AS avg_stress,
  SUM(COALESCE(net_profit, 0))                                               AS total_net_profit,
  COUNT(CASE WHEN status_v2  = 'Closed'           THEN 1 END)                AS proyectos_cerrados,
  COUNT(CASE WHEN status_v2  = 'Executing'        THEN 1 END)                AS proyectos_activos,
  COUNT(CASE WHEN has_project_eval       = 1      THEN 1 END)                AS con_eval_previa,
  COUNT(CASE WHEN emotional_eval_completed = 1    THEN 1 END)                AS con_eval_emocional,
  COUNT(CASE WHEN profit_calculated      = 1      THEN 1 END)                AS con_profit_calculado
FROM proyectos
GROUP BY COALESCE(status_v2, 'Legacy')
ORDER BY FIELD(
  COALESCE(status_v2, 'Legacy'),
  'Draft','Evaluating','Quoted','Approved','Executing','Boleta','Closed','Legacy'
);


-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================

-- Triggers creados
SHOW TRIGGERS WHERE `Table` = 'bitacora_horas';

-- Vistas creadas
SHOW FULL TABLES WHERE Table_type = 'VIEW';

-- Test trigger INSERT (usa proyecto real si existe, si no omitir)
-- INSERT INTO bitacora_horas (proyecto_id, horas, fecha_trabajo, type)
-- VALUES (1, 2.5, CURDATE(), 'billable_dev');
-- SELECT id, real_hours FROM proyectos WHERE id = 1;

-- Test views
SELECT * FROM v_boletas_monthly  LIMIT 5;
SELECT * FROM v_time_monthly     LIMIT 5;
SELECT * FROM v_expenses_monthly LIMIT 5;
SELECT * FROM v_emotional_project LIMIT 5;
SELECT * FROM monthly_control    LIMIT 5;
SELECT * FROM dashboard_metrics;
