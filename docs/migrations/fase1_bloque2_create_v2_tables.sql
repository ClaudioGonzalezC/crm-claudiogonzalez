-- =============================================================================
-- FASE 1 — BLOQUE 2: Crear tablas nuevas V2
-- Archivo: fase1_bloque2_create_v2_tables.sql
-- Fuente de verdad: /docs/crm_spec.md
-- Principio: Solo CREATE TABLE IF NOT EXISTS. Nada se elimina ni modifica.
-- FK adaptadas al esquema real: proyectos (no projects)
-- Orden de ejecución obligatorio (dependencias SQL):
--   questions → project_evals → answers → quotes → quote_items
--   → boletas → project_expenses → emotional_evals
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5. questions
--    Sin dependencias externas. Debe crearse primero.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS questions (
  id        INT          NOT NULL AUTO_INCREMENT,
  module    ENUM('project_eval','emotional') NOT NULL
              COMMENT 'A qué módulo pertenece la pregunta',
  question  TEXT         NOT NULL
              COMMENT 'Texto de la pregunta',
  type      ENUM('yn','scale_1_10','text') NOT NULL
              COMMENT 'Tipo de respuesta esperada',
  weight    INT          NOT NULL DEFAULT 1
              COMMENT 'Peso relativo para cálculo de score',
  order_num INT          NOT NULL DEFAULT 0
              COMMENT 'Orden de visualización dentro del módulo',
  PRIMARY KEY (id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Banco de preguntas para evaluaciones pre-proyecto y emocionales.';


-- -----------------------------------------------------------------------------
-- 6. project_evals
--    FK: proyectos(id)
--    UNIQUE en project_id: un proyecto tiene máximo una evaluación pre-proyecto.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS project_evals (
  id         INT  NOT NULL AUTO_INCREMENT,
  project_id INT  NOT NULL,
  score      INT  NOT NULL DEFAULT 0
               COMMENT 'Score calculado 0-100. Cargado desde answers al completar eval.',
  notes      TEXT DEFAULT NULL
               COMMENT 'Observaciones libres del evaluador',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_eval (project_id),
  CONSTRAINT fk_project_evals_proyecto
    FOREIGN KEY (project_id) REFERENCES proyectos(id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Evaluación pre-proyecto. Requerida para avanzar a estado Quoted.';


-- -----------------------------------------------------------------------------
-- 7. answers
--    FK: proyectos(id) + questions(id)
--    No depende de project_evals.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS answers (
  id            INT          NOT NULL AUTO_INCREMENT,
  project_id    INT          NOT NULL,
  question_id   INT          NOT NULL,
  answer_value  VARCHAR(255) DEFAULT NULL
                  COMMENT 'Valor de la respuesta (yn: si/no, scale: 1-10, text: libre)',
  answer_notes  TEXT         DEFAULT NULL
                  COMMENT 'Notas adicionales opcionales para la respuesta',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_answers_project (project_id),
  CONSTRAINT fk_answers_proyecto
    FOREIGN KEY (project_id)  REFERENCES proyectos(id)  ON DELETE CASCADE,
  CONSTRAINT fk_answers_question
    FOREIGN KEY (question_id) REFERENCES questions(id)  ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Respuestas a preguntas de evaluación (pre-proyecto y emocional).';


-- -----------------------------------------------------------------------------
-- 8. quotes
--    FK: proyectos(id)
--    UNIQUE en project_id: una cotización activa por proyecto.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quotes (
  id                INT           NOT NULL AUTO_INCREMENT,
  project_id        INT           NOT NULL,
  version_num       INT           NOT NULL DEFAULT 1
                      COMMENT 'Versión de la cotización. Incrementar si se rehace.',
  subtotal          DECIMAL(12,2) DEFAULT NULL
                      COMMENT 'Suma bruta de quote_items sin buffer',
  buffer_pct        DECIMAL(5,2)  NOT NULL DEFAULT 15.00
                      COMMENT '% de buffer agregado al subtotal (imprevistos)',
  projected_bruto   DECIMAL(12,2) DEFAULT NULL
                      COMMENT 'subtotal × (1 + buffer_pct/100)',
  projected_liquido DECIMAL(12,2) DEFAULT NULL
                      COMMENT 'projected_bruto × (1 - retention_rate/100)',
  approved          TINYINT(1)    NOT NULL DEFAULT 0
                      COMMENT '1 = cotización aprobada por el cliente',
  approved_date     DATETIME      DEFAULT NULL
                      COMMENT 'Fecha de aprobación formal',
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quote_project (project_id),
  CONSTRAINT fk_quotes_proyecto
    FOREIGN KEY (project_id) REFERENCES proyectos(id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Cotización formal del proyecto. Requerida para avanzar a Approved.';


-- -----------------------------------------------------------------------------
-- 9. quote_items
--    FK: quotes(id)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quote_items (
  id          INT           NOT NULL AUTO_INCREMENT,
  quote_id    INT           NOT NULL,
  task_name   VARCHAR(255)  DEFAULT NULL
                COMMENT 'Nombre del ítem o entregable cotizado',
  est_hours   DECIMAL(6,2)  DEFAULT NULL
                COMMENT 'Horas estimadas para este ítem',
  hourly_rate DECIMAL(10,2) DEFAULT NULL
                COMMENT 'Tarifa hora aplicada a este ítem',
  line_total  DECIMAL(12,2) DEFAULT NULL
                COMMENT 'est_hours × hourly_rate',
  PRIMARY KEY (id),
  CONSTRAINT fk_quote_items_quote
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Ítems de cotización. Cada fila es un entregable con horas y tarifa.';


-- -----------------------------------------------------------------------------
-- 10. boletas
--     FK: proyectos(id)
--     monto_retencion y monto_liquido: columnas GENERATED STORED.
--     retencion_pct default 15.25 (retención honorarios Chile 2026).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS boletas (
  id                INT           NOT NULL AUTO_INCREMENT,
  project_id        INT           NOT NULL,
  numero_boleta     VARCHAR(50)   NOT NULL
                      COMMENT 'Número de folio de la boleta emitida',
  status            ENUM('Draft','Issued','Paid','Overdue') NOT NULL DEFAULT 'Draft',
  fecha_emision     DATE          NOT NULL,
  rut_receptor      VARCHAR(12)   NOT NULL
                      COMMENT 'RUT del cliente receptor (ej: 12.345.678-9)',
  monto_bruto       DECIMAL(12,2) NOT NULL
                      COMMENT 'Monto antes de retención',
  retencion_pct     DECIMAL(5,2)  NOT NULL DEFAULT 15.25
                      COMMENT '% de retención. Default 15.25 (honorarios Chile 2026)',
  monto_retencion   DECIMAL(12,2) GENERATED ALWAYS AS
                      (ROUND(monto_bruto * retencion_pct / 100, 2)) STORED
                      COMMENT 'Retención calculada automáticamente',
  monto_liquido     DECIMAL(12,2) GENERATED ALWAYS AS
                      (ROUND(monto_bruto - (monto_bruto * retencion_pct / 100), 2)) STORED
                      COMMENT 'Monto líquido a recibir calculado automáticamente',
  tipo_cobro        ENUM('Anticipo','Cuota1','Cuota2','Final') DEFAULT NULL
                      COMMENT 'Tipo de cobro dentro del proyecto',
  paid_date         DATE          DEFAULT NULL
                      COMMENT 'Fecha de pago efectivo. NULL = no pagada aún',
  payment_method    ENUM('Transferencia','Webpay','Paypal') DEFAULT NULL,
  payment_reference VARCHAR(255)  DEFAULT NULL
                      COMMENT 'N° de transferencia u otro comprobante',
  f29_paid          TINYINT(1)    NOT NULL DEFAULT 0
                      COMMENT '1 = retención declarada y pagada en F29',
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_numero_boleta (numero_boleta),
  INDEX idx_boletas_status_paid  (status, paid_date),
  INDEX idx_boletas_emision      (fecha_emision),
  CONSTRAINT fk_boletas_proyecto
    FOREIGN KEY (project_id) REFERENCES proyectos(id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Boletas honorarios con retención chilena. Base para monthly_control.';


-- -----------------------------------------------------------------------------
-- 11. project_expenses
--     FK: proyectos(id)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS project_expenses (
  id           INT           NOT NULL AUTO_INCREMENT,
  project_id   INT           NOT NULL,
  expense_name VARCHAR(255)  NOT NULL
                 COMMENT 'Descripción del gasto',
  amount       DECIMAL(12,2) NOT NULL
                 COMMENT 'Monto del gasto en pesos chilenos',
  expense_date DATE          NOT NULL
                 COMMENT 'Fecha en que ocurrió el gasto',
  category     ENUM('Herramientas','Licencias','Subcontratista','Viajes','Otro')
                 DEFAULT NULL,
  notes        TEXT          DEFAULT NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_expenses_project_date (project_id, expense_date),
  CONSTRAINT fk_project_expenses_proyecto
    FOREIGN KEY (project_id) REFERENCES proyectos(id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Gastos reales por proyecto. Usados en fórmula net_profit V2.';


-- -----------------------------------------------------------------------------
-- 12. emotional_evals
--     FK: proyectos(id)
--     UNIQUE en project_id: una evaluación emocional por proyecto.
--     Requerida en estado Boleta antes de pasar a Closed.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS emotional_evals (
  id                 INT           NOT NULL AUTO_INCREMENT,
  project_id         INT           NOT NULL,
  satisfaction_score DECIMAL(3,1)  DEFAULT NULL
                       COMMENT 'Satisfacción general del proyecto (1.0 - 10.0)',
  stress_level       DECIMAL(3,1)  DEFAULT NULL
                       COMMENT 'Nivel de estrés percibido (1.0 - 10.0). Copia a proyectos.stress_score',
  client_conflicts   TINYINT(1)    NOT NULL DEFAULT 0
                       COMMENT '1 = hubo conflictos relevantes con el cliente',
  would_repeat       TINYINT(1)    NOT NULL DEFAULT 0
                       COMMENT '1 = volvería a trabajar con este cliente/proyecto',
  learning_outcome   TEXT          DEFAULT NULL
                       COMMENT 'Aprendizajes clave del proyecto',
  final_notes        TEXT          DEFAULT NULL
                       COMMENT 'Notas de cierre libres',
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_emotional_eval_project (project_id),
  CONSTRAINT fk_emotional_evals_proyecto
    FOREIGN KEY (project_id) REFERENCES proyectos(id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Evaluación emocional de cierre. Requerida en Boleta antes de Closed.';


-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN — Ejecutar después del script
-- =============================================================================

SHOW TABLES LIKE 'questions';
SHOW TABLES LIKE 'project_evals';
SHOW TABLES LIKE 'answers';
SHOW TABLES LIKE 'quotes';
SHOW TABLES LIKE 'quote_items';
SHOW TABLES LIKE 'boletas';
SHOW TABLES LIKE 'project_expenses';
SHOW TABLES LIKE 'emotional_evals';
