# CRM Freelance Chile — Especificación oficial

Este archivo define la especificación oficial del CRM Freelance Chile.
Toda la estructura de base de datos, workflow, enums, flags y lógica debe seguir este documento.
Este documento es la fuente de verdad del sistema.
No cambiar estructura sin revisar este archivo.

---

## Objetivo del sistema

CRM personal para desarrollador freelance en Chile.

Incluye:
- clientes
- proyectos
- evaluación pre-proyecto
- cotizaciones
- tareas simples
- time tracking
- boletas
- gastos por proyecto
- cálculo de rentabilidad
- evaluación emocional
- dashboard mensual

No incluye:
- leads
- multiusuario
- CRM corporativo
- automatizaciones complejas
- ORM nuevos
- cambio de stack

---

## Workflow oficial único

```
Draft
Evaluating
Quoted
Approved
Executing
Boleta
Closed
```

Reglas:
- `create_quote` requiere `has_project_eval`
- `finalize_close` requiere `emotional_eval_completed` + `profit_calculated`
- `calculate_profit` NO cambia status
- Solo `finalize_close` pasa a `Closed`

---

## Flags obligatorios en projects

- `has_project_eval`
- `emotional_eval_completed`
- `profit_calculated`

---

## settings debe ser key-value

Tabla: `settings`

Columnas:
- `key`
- `value`

**NO usar columnas individuales.**

Seeds oficiales:

| key | value |
|-----|-------|
| monthly_overhead | 800000 |
| effective_hourly_cost | 25000 |
| monthly_capacity_hours | 120 |
| min_profit_margin_pct | 25 |
| retention_rate_2026 | 15.25 |

---

## ENUM oficial time_logs.type

```
billable_dev
meeting
non_billable_fix
admin
```

---

## ENUM oficial project.status (status_v2)

```
Draft
Evaluating
Quoted
Approved
Executing
Boleta
Closed
```

---

## Campos obligatorios en projects

- `real_hours` DECIMAL(6,2) DEFAULT 0
- `eval_score` INT DEFAULT 0
- `net_profit` DECIMAL(12,2) DEFAULT NULL
- `stress_score` DECIMAL(3,1) DEFAULT NULL
- `cost_hour` DECIMAL(10,2) DEFAULT 25000
- `overhead_snapshot` DECIMAL(12,2) DEFAULT 0
- `closed_at` TIMESTAMP NULL

---

## clients estructura obligatoria

- `rut` VARCHAR(12)
- `billing_address` TEXT
- `total_projects` INT
- `total_profit` DECIMAL(12,2)
- `avg_stress` DECIMAL(3,1)

**NO usar nombres alternativos.**
Ejemplos de nombres prohibidos: `total_proyectos`, `total_invertido`, `proyectos_activos`.

---

## settings estructura obligatoria

```sql
CREATE TABLE settings (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    `key`      VARCHAR(50) UNIQUE NOT NULL,
    value      DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Trigger obligatorio

`time_logs` AFTER INSERT / DELETE / UPDATE debe actualizar `real_hours` en `projects`.

```sql
-- INSERT: real_hours = real_hours + NEW.hours
-- DELETE: real_hours = real_hours - OLD.hours
-- UPDATE: real_hours = real_hours - OLD.hours + NEW.hours
```

---

## Dashboard rule

Las vistas base son históricas.
Filtros mensuales **solo** en `dashboard_metrics`.

Vistas requeridas:
- `v_boletas_monthly`
- `v_time_monthly`
- `v_expenses_monthly`
- `v_emotional_project`
- `dashboard_metrics`
- `monthly_control`

---

## Fórmula de rentabilidad oficial

```
net_profit =
  total_liquido_cobrado
  - (real_hours × cost_hour)
  - total_expenses
  - overhead_snapshot
```

Variables:
- `total_liquido_cobrado`: suma de boletas con `paid_date NOT NULL`
- `real_hours`: horas reales acumuladas por trigger
- `cost_hour`: snapshot congelado al crear el proyecto
- `total_expenses`: suma de `project_expenses.amount`
- `overhead_snapshot`: overhead congelado al crear el proyecto

---

## Regla para Claude Code

Siempre seguir en este orden:
1. `/docs/crm_spec.md` — reglas funcionales y de esquema
2. `/docs/project_rules.md` — reglas de stack técnico

| Archivo | Cubre |
|---------|-------|
| `project_rules.md` | Stack fijo (React, PHP, MySQL, Express) |
| `crm_spec.md` | Esquema funcional, enums, workflow, DB |

**Si cualquier migración o cambio propuesto entra en conflicto con `crm_spec.md`, detener y consultar antes de modificar el esquema.**
