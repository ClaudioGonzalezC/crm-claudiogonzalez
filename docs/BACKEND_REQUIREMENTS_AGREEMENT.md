# Backend Requirements: Project Agreement & Budget Acceptance System

## Overview
The frontend has been prepared to handle a project agreement and budget acceptance system. This document outlines ALL the backend modifications required to make this feature fully functional.

---

## 1. DATABASE MODIFICATIONS

### Table: `proyectos`

Add the following fields to the `proyectos` table:

```sql
ALTER TABLE proyectos ADD COLUMN terminos_condiciones LONGTEXT AFTER hosting_vencimiento;
ALTER TABLE proyectos ADD COLUMN terminos_aceptados TINYINT DEFAULT 0 AFTER terminos_condiciones;
ALTER TABLE proyectos ADD COLUMN fecha_aceptacion DATETIME NULL AFTER terminos_aceptados;
ALTER TABLE proyectos ADD COLUMN ip_aceptacion VARCHAR(45) NULL AFTER fecha_aceptacion;
```

**Field Specifications:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `terminos_condiciones` | LONGTEXT | NULL | Stores the full terms and conditions text for the project |
| `terminos_aceptados` | TINYINT | 0 | Boolean (0=not accepted, 1=accepted) |
| `fecha_aceptacion` | DATETIME | NULL | Timestamp when client accepted the agreement |
| `ip_aceptacion` | VARCHAR(45) | NULL | Client's IP address at time of acceptance |

---

## 2. API ENDPOINTS REQUIRED

### Endpoint 1: Update Project with Terms (Admin)
**Path:** `/api/guardar_terminos.php`  
**Method:** POST  
**Authentication:** Admin token (via session/header)

**Request Body:**
```json
{
  "proyecto_id": 15,
  "terminos_condiciones": "Full terms text here..."
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Términos guardados correctamente"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Error message here"
}
```

**Logic:**
- Update the `terminos_condiciones` field in the `proyectos` table
- No change to `terminos_aceptados` (stays 0)
- Validate that `proyecto_id` exists
- Validate that user is authenticated as admin

---

### Endpoint 2: Accept Agreement (Client)
**Path:** `/api/aceptar_acuerdo.php`  
**Method:** POST  
**Authentication:** Via share_token (public access)

**Request Body:**
```json
{
  "proyecto_id": 15
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Acuerdo aceptado correctamente"
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Error message here"
}
```

**Logic:**
- Find project by `id` AND verify it has a valid `share_token` (from GET param or session)
- Update: `terminos_aceptados = 1`
- Update: `fecha_aceptacion = NOW()`
- Update: `ip_aceptacion = $_SERVER['REMOTE_ADDR']`
- Return success response

**Important:** The share_token must be passed in the URL or verified somehow. The frontend will send only `proyecto_id` in the JSON body, so you may need to:
  - Option A: Pass share_token as URL parameter: `/api/aceptar_acuerdo.php?token=xyz`
  - Option B: Store share_token in session when client opens portal
  - Option C: Look up the token from the ProjectDetail fetch and validate it

---

### Endpoint 3: Get Project Data (Update Existing)
**Path:** `/api/get_proyecto_publico.php`  
**Method:** GET (already exists)

**Required Changes:**
Ensure the response includes the new fields:

```json
{
  "proyecto": {
    "id": 15,
    "nombre_proyecto": "Rediseño Carpe Diem",
    ...
    "terminos_condiciones": "Full terms text",
    "terminos_aceptados": 0,
    "fecha_aceptacion": null,
    ...
  },
  "pagos": [...],
  "bitacora": [...],
  "extras": [...]
}
```

---

### Endpoint 4: Get Project Detail (Admin)
**Path:** `/api/get_proyecto_detalle.php`  
**Method:** GET (already exists)

**Required Changes:**
Ensure the response includes the new fields:

```json
{
  "id": 15,
  "nombre_proyecto": "Rediseño Carpe Diem",
  ...
  "terminos_condiciones": "Full terms text",
  "terminos_aceptados": 0,
  "fecha_aceptacion": null,
  ...
}
```

---

### Endpoint 5: Create Project (Admin)
**Path:** `/api/crear_proyecto.php`  
**Method:** POST (already exists)

**Required Changes:**
Accept and store the new field in the request:

```json
{
  "cliente_id": 5,
  "nombre_proyecto": "New Project",
  "horas_estimadas": 40,
  "valor_hora_acordado": 50000,
  "share_token": "abc123xyz",
  "dominio_nombre": null,
  "dominio_provider": null,
  "dominio_vencimiento": null,
  "hosting_provider": null,
  "hosting_plan": null,
  "hosting_vencimiento": null,
  "terminos_condiciones": "Default terms text..."
}
```

**Logic:**
- Store `terminos_condiciones` in the DB
- Initialize `terminos_aceptados = 0`
- Leave `fecha_aceptacion` and `ip_aceptacion` as NULL

---

## 3. FRONTEND-BACKEND DATA FLOW

### Project Creation Flow
```
ProjectForm.tsx (Admin)
├─ Fills form with terms (or uses default)
└─ POST /api/crear_proyecto.php
   └─ Backend stores terminos_condiciones with terminos_aceptados = 0
```

### Project Access Flow
```
CustomerView.tsx (Client Portal)
├─ Opens with share_token
├─ GET /api/get_proyecto_publico.php?token=xyz
│  └─ Returns proyecto with terminos_condiciones & terminos_aceptados
├─ If terminos_aceptados === 0:
│  ├─ Show AgreementModal (blocks entire screen)
│  └─ Client clicks "Accept" button
│     └─ POST /api/aceptar_acuerdo.php with proyecto_id
│        └─ Backend: terminos_aceptados = 1, fecha_aceptacion = NOW(), ip_aceptacion = IP
│        └─ Returns success
│     └─ Frontend refreshes project data
├─ If terminos_aceptados === 1:
│  ├─ Check if total_pagado < (monto_total_contrato * 0.5)
│  ├─ If true:
│  │  ├─ Show PaymentRequiredBanner
│  │  ├─ Blur AssetStatusCard
│  │  └─ Blur FileManagement
│  └─ If false:
│     └─ Show all content normally
└─ End
```

### Admin Terms Edit Flow
```
ProjectDetail.tsx (Admin)
├─ Displays terminos_condiciones in read mode
├─ Admin clicks "Edit Terms"
├─ Textarea appears with current text
├─ Admin modifies text
├─ Admin clicks "Save Terms"
├─ POST /api/guardar_terminos.php with proyecto_id + terminos_condiciones
│  └─ Backend updates the field
│  └─ Returns success
└─ Frontend updates UI to show saved status
```

---

## 4. SECURITY CONSIDERATIONS

### For `/api/aceptar_acuerdo.php`

**Critical:** Validate the share_token to ensure:
- The token belongs to the requested proyecto_id
- The token has not expired (if you have an expiration mechanism)
- The request is not from a bot/automation (optional: rate limiting)

**Recommended Validation:**
```php
// Pseudocode
$token = $_GET['token'] ?? null;
$proyecto_id = $_POST['proyecto_id'] ?? null;

$proyecto = $db->query("SELECT * FROM proyectos WHERE id = ? AND share_token = ?", [$proyecto_id, $token]);

if (!$proyecto) {
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Acceso denegado']);
  exit;
}

// Continue with update...
```

### For `/api/guardar_terminos.php`

**Critical:** Validate that the request is from an authenticated admin:
- Check session token
- Verify admin role (if role-based)

---

## 5. TESTING CHECKLIST

After implementing all backend changes, verify:

- [ ] New DB fields exist in `proyectos` table
- [ ] `/api/guardar_terminos.php` updates `terminos_condiciones` correctly
- [ ] `/api/aceptar_acuerdo.php` updates all 3 fields (`terminos_aceptados`, `fecha_aceptacion`, `ip_aceptacion`)
- [ ] `/api/get_proyecto_publico.php` returns the new fields
- [ ] `/api/get_proyecto_detalle.php` returns the new fields
- [ ] `/api/crear_proyecto.php` accepts and stores `terminos_condiciones`
- [ ] Date format for `fecha_aceptacion` is consistent (MySQL DATETIME format)
- [ ] IP address is captured correctly
- [ ] Admin can edit terms without affecting acceptance status
- [ ] Client cannot accept same agreement twice (optional: add `ON DUPLICATE KEY UPDATE` check)

---

## 6. OPTIONAL ENHANCEMENTS

### Email Notification (Nice to Have)
When a client accepts an agreement, send an email to the admin:
```
Subject: [Proyecto] Cliente aceptó el Acuerdo - {proyecto_nombre}
Body: El cliente aceptó el acuerdo el {fecha_aceptacion} desde la IP {ip_aceptacion}
```

### Audit Log (Nice to Have)
Create an `acuerdos_log` table to track all agreement actions:
```sql
CREATE TABLE acuerdos_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  proyecto_id INT,
  accion VARCHAR(50), -- 'creado', 'editado', 'aceptado'
  fecha DATETIME DEFAULT NOW(),
  usuario_id INT,
  ip_address VARCHAR(45),
  detalles LONGTEXT
);
```

---

## SUMMARY OF REQUIRED FILES/CHANGES

**PHP Files to Create:**
1. `/api/guardar_terminos.php` (NEW)
2. `/api/aceptar_acuerdo.php` (NEW)

**PHP Files to Modify:**
1. `/api/get_proyecto_publico.php` - Add new fields to response
2. `/api/get_proyecto_detalle.php` - Add new fields to response
3. `/api/crear_proyecto.php` - Accept and store new field

**Database:**
1. Add 4 new columns to `proyectos` table

---

## FRONTEND COMPONENTS READY

The following React components have been created and are ready to use:

1. **AgreementModal.tsx** - Full-screen blocking modal for agreement acceptance
2. **LockedContentWrapper.tsx** - Blurs content with lock icon when payment < 50%
3. **PaymentRequiredBanner.tsx** - Shows payment progress bar and required amount
4. Modified **CustomerView.tsx** - Integrates agreement flow
5. Modified **ProjectDetail.tsx** - Admin terms editor
6. Modified **ProjectForm.tsx** - Terms field in creation form

All components are production-ready and waiting for backend APIs.

---

## BACKEND DEADLINE

Please implement these changes so that:
- The agreement modal appears when client opens a new project portal
- The admin can edit terms before sending the link
- The client's acceptance is recorded with timestamp and IP

Once completed, the entire agreement acceptance system will be fully functional!
