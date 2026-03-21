# ARQUITECTURA TÉCNICA - SISTEMA DE PROYECTOS Y PAGOS

## 1. COMPONENTES DE DATOS

### 1.1 Dashboard (`client/pages/Dashboard.tsx`)

**Interfaces TypeScript:**
```typescript
interface ProjectStats {
  total_ganado: number;           // Ingresos totales (bruto) del mes
  ganado_liquido: number;         // Ingresos después de retención (ganado_liquido)
  total_pendiente: number;        // Ingresos proyectados (En Desarrollo + Revisiones)
  total_cotizado: number;         // Presupuestos en cotización
  restante_para_meta: number;     // meta_liquida_mensual - ganado_liquido
  porcentaje_meta: number;        // (ganado_liquido / meta_liquida_mensual) * 100
  meta_liquida_mensual: number;   // Meta del mes en valores líquidos
  proyectos_recientes: RecentProject[];
}

interface RecentProject {
  id: number;
  nombre?: string;                // nombre_proyecto del API
  estado: ProjectStatus;          // Cotización | En Desarrollo | Revisiones | Finalizado | Cobrado
  monto_bruto?: number;           // Directamente de BD - NO CALCULADO
  monto_liquido?: number;         // Directamente de BD - NO CALCULADO (bruto - retencion_sii)
}
```

**API Endpoint:** `https://crm.claudiogonzalez.dev/api/get_proyectos_stats.php?mes={mes}&anio={anio}&t={timestamp}`

**JSON Esperado:**
```json
{
  "total_ganado": 1156271,
  "ganado_liquido": 979940,
  "total_pendiente": 500000,
  "total_cotizado": 200000,
  "meta_liquida_mensual": 2500000,
  "proyectos_recientes": [
    {
      "id": 12,
      "nombre_proyecto": "Entel",
      "estado": "Cobrado",
      "monto_bruto": 1156271,
      "monto_liquido": 979940
    }
  ]
}
```

**Campos Utilizados en Pantalla:**
- **Ingresos Reales**: `total_ganado` (valor bruto, directo del backend)
- **Proyectado (En Curso)**: `total_pendiente`
- **Faltante para Meta**: `restante_para_meta` (calculado como `meta_liquida_mensual - ganado_liquido`)
- **Barra de Progreso**: `ganado_liquido` vs `meta_liquida_mensual`
- **Tarjeta de Proyecto**: `monto_bruto` (naranja) y `monto_liquido` (verde)

---

### 1.2 RecentProjectCard (`client/components/RecentProjectCard.tsx`)

**Props Recibidas:**
```typescript
interface RecentProjectCardProps {
  id: number;
  nombre: string;
  estado: ProjectStatus;
  monto: number;                  // monto_bruto (usado como fallback si no hay montoBruto)
  montoBruto?: number;            // Monto bruto de la BD
  montoLiquido?: number;          // Monto líquido de la BD
  isPlaceholder?: boolean;
}
```

**Datos Mostrados:**
- **Nombre**: `nombre`
- **Estado**: `estado` (badge con color condicional)
- **Monto Bruto**: `montoBruto` (naranja) - DIRECTO DE BD, SIN CÁLCULOS
- **Monto Líquido**: `montoLiquido` (verde) - DIRECTO DE BD, SIN CÁLCULOS

**Flujo de Datos:**
```
Dashboard.fetchStats()
  ↓
ProjectStats.proyectos_recientes[]
  ↓
map() → { id, nombre, estado, monto: p.monto_bruto, montoBruto, montoLiquido }
  ↓
RecentProjectsGrid
  ↓
RecentProjectCard × 4
```

---

### 1.3 ProjectDetail (`client/pages/ProjectDetail.tsx`)

**Interfaces TypeScript:**
```typescript
interface ProjectData {
  id: number;
  nombre_proyecto: string;
  cliente_id: number;
  cliente_nombre?: string;
  horas_estimadas: number;
  valor_hora_acordado: number;
  revisiones_incluidas: number;
  revisiones_usadas?: number;
  estado: ProjectStatusType;
  share_token?: string;
  monto_bruto?: number;           // ← NUEVO: Directo de BD
  monto_liquido?: number;         // ← NUEVO: Directo de BD
}

interface Payment {
  id: number;
  proyecto_id: number;
  monto: number;
  descripcion: string;
  fecha: string;
}

interface ExtraCost {
  id: number;
  proyecto_id: number;
  descripcion: string;
  monto: number;
  fecha: string;
}

interface Note {
  id: number;
  proyecto_id: number;
  nota: string;
  fecha: string;
  creado_por: string;
}

interface TimeEntry {
  id: number;
  proyecto_id: number;
  horas: number;
  descripcion: string;
  fecha: string;
}
```

**API Endpoints Utilizados:**
```
GET  https://crm.claudiogonzalez.dev/api/get_proyecto_detalle.php?id={id}&t={timestamp}
GET  https://crm.claudiogonzalez.dev/api/gestionar_extras.php?proyecto_id={id}&accion=obtener&t={timestamp}
GET  https://crm.claudiogonzalez.dev/api/gestionar_notas.php?proyecto_id={id}&accion=obtener&t={timestamp}
GET  https://crm.claudiogonzalez.dev/api/obtener_pagos.php?proyecto_id={id}&t={timestamp}
GET  https://crm.claudiogonzalez.dev/api/obtener_bitacora.php?proyecto_id={id}&t={timestamp}
```

---

### 1.4 CustomerView / Portal del Cliente (`client/pages/CustomerView.tsx`)

**Interfaces TypeScript:**
```typescript
interface ProjectData {
  id: number;
  nombre_proyecto: string;
  cliente_nombre?: string;
  horas_estimadas: number;
  valor_hora_acordado: number;
  estado: ProjectStatusType;
  revisiones_incluidas: number;
  revisiones_usadas: number;
}

interface Payment {
  id: number;
  proyecto_id: number;
  monto: number;
  descripcion: string;          // Mapea de p.descripcion || p.nota
  fecha: string;
}
```

**API Endpoint:**
```
GET https://crm.claudiogonzalez.dev/api/get_proyecto_publico.php?token={shareToken}&t={timestamp}
```

**JSON Esperado:**
```json
{
  "proyecto": {
    "id": 12,
    "nombre_proyecto": "Entel",
    "cliente_nombre": "Empresa X",
    "horas_estimadas": 100,
    "valor_hora_acordado": 48735,
    "estado": "Cobrado",
    "revisiones_incluidas": 5,
    "revisiones_usadas": 2
  },
  "bitacora": [...],
  "pagos": [
    {
      "id": 1,
      "proyecto_id": 12,
      "monto": 500000,
      "descripcion": "Pago inicial",
      "fecha_pago": "2024-01-15"
    }
  ],
  "extras": [...],
  "notas": [...]
}
```

---

## 2. LÓGICA DE VISUALIZACIÓN - MANEJO DE ESTADOS

### 2.1 Estados de Proyecto

**Enum:**
```typescript
type ProjectStatus = 
  | "Cotización"      // Presupuesto en revisión
  | "En Desarrollo"   // Trabajo en progreso
  | "Revisiones"      // Cliente revisando
  | "Finalizado"      // Trabajo completado, pendiente pago
  | "Cobrado";        // Completamente pagado
```

### 2.2 Colorización por Estado

**RecentProjectCard (client/components/RecentProjectCard.tsx):**
```typescript
const STATUS_COLORS: Record<ProjectStatus, string> = {
  Cotización: "bg-blue-500/20 text-blue-400",
  "En Desarrollo": "bg-purple-500/20 text-purple-400",
  Revisiones: "bg-orange-500/20 text-orange-400",
  Finalizado: "bg-emerald-500/20 text-emerald-400",
  Cobrado: "bg-green-500/20 text-green-400",
};
```

### 2.3 Visualización Condicional

**Dashboard:**
- ✅ Siempre muestra ingresos reales (total_ganado)
- ✅ Barra progreso usa ganado_liquido (con retención aplicada en BD)
- ✅ Proyectos recientes muestra monto_bruto y monto_liquido

**ProjectDetail:**
- ✅ Muestra monto_bruto directamente de BD para PaymentManagement
- ✅ Estado activa/desactiva ciertos formularios (creación de pagos, edición)
- ✅ Si estado = "Cobrado", muestra botón de confirmación

**CustomerView (Portal):**
- ✅ Lee solo datos públicos (nombre, estado, progreso de pagos)
- ✅ No muestra formularios de edición
- ✅ Muestra "Ver como Admin" solo si usuario logueado tiene auth_token

---

## 3. CÁLCULOS EN CLIENTE - CONFIRMACIÓN DE ELIMINACIÓN DE IMPUESTOS

### 3.1 Multiplicaciones por 0.8475: ELIMINADAS COMPLETAMENTE

**❌ CÓDIGO ELIMINADO:**
```typescript
// ANTES (INCORRECTO):
const baseBruto = Math.round((project.horas_estimadas * project.valor_hora_acordado) / 0.8475);
const LIQUID_MULTIPLIER = 0.8475;
const totalGanadoLiquido = Math.round(totalGanadoBruto * LIQUID_MULTIPLIER);
```

**✅ CÓDIGO ACTUAL (CORRECTO):**
```typescript
// AHORA (CORRECTO - SIN MULTIPLICACIONES):
const totalBruto = project.monto_bruto || 0;  // Directo de BD
const totalGanado = parseFloat(data.total_ganado) || 0;  // Directo de BD
const ganadoLiquido = parseFloat(data.ganado_liquido) || 0;  // Directo de BD
```

### 3.2 Dependencia 100% en Backend

**Dashboard:**
```typescript
// ANTES: Calculaba liquidez multiplicando bruto
// AHORA: Usa valores directos de BD
const ganadoLiquido = parseFloat(data.ganado_liquido) || 0;  // ← BD calcula retención
const porcentajeMeta = ganadoLiquido / metaLiquidaMensual * 100;  // ← Solo división, sin multiplicación
```

**ProjectDetail:**
```typescript
// ANTES: Dividía por 0.8475
// AHORA: Usa monto_bruto de BD
const totalBruto = project.monto_bruto || 0;  // ← Directo, sin cálculos
```

**CustomerView:**
```typescript
// ANTES: Calculaba con fórmulas complejas
// AHORA: Usa valores de BD
const baseBruto = estimatedHours * hourlyRate / 0.8475;  // ← SÍ EXISTE AÚN (revisar línea 280)
```

⚠️ **NOTA IMPORTANTE:** `CustomerView.tsx` línea ~280 aún contiene:
```typescript
const baseBruto = estimatedHours > 0 && hourlyRate > 0
  ? Math.round((estimatedHours * hourlyRate) / 0.8475)
  : 0;
```

Esto debería ser eliminado o usar monto_bruto del backend cuando esté disponible.

---

## 4. MANEJO DE PAGOS

### 4.1 Cálculos de Saldo y Porcentaje

**PaymentManagement (client/components/PaymentManagement.tsx):**
```typescript
// LÍNEA 55-58: Cálculos simples, sin multiplicaciones
const totalPaid = payments.reduce((sum, payment) => sum + payment.monto, 0);
const pendingBalance = totalContract - totalPaid;
const totalPaidRounded = Math.round(totalPaid);
const pendingBalanceRounded = Math.round(pendingBalance);

// PORCENTAJE SIMPLE
const percentagePaid = totalContract > 0 
  ? Math.round((totalPaidRounded / totalContract) * 100) 
  : 0;
```

**Fórmulas Exactas:**
```
Saldo Pendiente = totalContract (monto_bruto) - totalPaid (suma de pagos)
Porcentaje = (totalPaid / totalContract) * 100
Progreso = 0% → 100% (lineal, sin alineaciones especiales)
```

### 4.2 Detección de Pago Completado

**PaymentManagement (línea 61-73):**
```typescript
useEffect(() => {
  if (success && pendingBalanceRounded === 0 && projectStatus !== "Cobrado" && !showCompletionModal) {
    setShowCompletionModal(true);  // ← Muestra modal de confirmación
    setTimeout(() => setSuccess(false), 100);
  }
}, [success, pendingBalanceRounded, projectStatus, showCompletionModal]);
```

**Flujo:**
1. Usuario registra pago → `success = true`
2. Sistema verifica: `pendingBalance === 0`?
3. Si SÍ → Muestra modal para cambiar estado a "Cobrado"
4. Usuario confirma → API actualiza `actualizar_estado.php`

### 4.3 En CustomerView (Portal Público)

**PaymentManagementReadOnly (client/components/PaymentManagementReadOnly.tsx):**
```typescript
const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(String(payment?.monto || 0)) || 0, 0);
const totalPaidRounded = Math.round(totalPaid);
const pendingBalance = Math.max(totalContract - totalPaidRounded, 0);
const percentagePaid = totalContract > 0 
  ? ((totalPaidRounded / totalContract) * 100).toFixed(1) 
  : '0';
```

**Visualización:**
- ✅ Tarjeta 1: "Total del Contrato" = `totalContract` (monto_bruto)
- ✅ Tarjeta 2: "Pagado a la Fecha" = `totalPaidRounded`
- ✅ Tarjeta 3: "Saldo Pendiente" = `pendingBalance`
- ✅ Barra: Progreso visual (0% → 100%)
- ✅ Tabla: Historial de pagos con fecha y descripción

---

## 5. HOOKS Y CONTEXTO - FLUJOS DE DATOS

### 5.1 Dashboard - Sincronización de Datos

**Hooks Utilizados:**

```typescript
// LÍNEA 102-104: Cargar config al montar
useEffect(() => {
  fetchConfig();  // Meta mensual, valor hora
}, []);

// LÍNEA 107-109: Cargar stats cuando mes/año cambian
useEffect(() => {
  fetchStats(selectedMonth, selectedYear);
}, [selectedMonth, selectedYear]);

// LÍNEA 94-99: Actualizar hora cada minuto
useEffect(() => {
  const timer = setInterval(() => {
    setCurrentTime(new Date());
  }, 60000);
  return () => clearInterval(timer);
}, []);
```

**Función fetchStats (línea 136-185):**
```typescript
const fetchStats = async (mes?: number, anio?: number) => {
  setLoading(true);
  try {
    const timestamp = new Date().getTime();  // Cache-buster
    const month = mes ?? selectedMonth;
    const year = anio ?? selectedYear;
    const url = new URL("https://crm.claudiogonzalez.dev/api/get_proyectos_stats.php");
    url.searchParams.append("mes", month.toString());
    url.searchParams.append("anio", year.toString());
    url.searchParams.append("t", timestamp.toString());

    const response = await axios.get(url.toString());
    const data = response.data;

    // ✅ USAR VALORES DEL BACKEND DIRECTAMENTE
    const totalGanado = parseFloat(data.total_ganado) || 0;
    const ganadoLiquido = parseFloat(data.ganado_liquido) || 0;
    const totalPendiente = parseFloat(data.total_pendiente) || 0;
    const metaLiquidaMensual = parseFloat(data.meta_liquida_mensual) || DEFAULT_STATS.meta_liquida_mensual;
    
    // ✅ CÁLCULOS SIMPLES (SOLO ARITMÉTICA, NO MULTIPLICACIONES POR IMPUESTOS)
    const restante = Math.max(metaLiquidaMensual - ganadoLiquido, 0);
    const porcentajeMeta = metaLiquidaMensual > 0
      ? Math.round((ganadoLiquido / metaLiquidaMensual) * 100)
      : 0;

    setStats({
      total_ganado: totalGanado,
      ganado_liquido: ganadoLiquido,
      total_pendiente: totalPendiente,
      total_cotizado: parseFloat(data.total_cotizado) || 0,
      restante_para_meta: restante,
      porcentaje_meta: porcentajeMeta,
      meta_liquida_mensual: metaLiquidaMensual,
      proyectos_recientes: projectsWithPayments as any,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    setStats(DEFAULT_STATS);
  } finally {
    setLoading(false);
  }
};
```

---

### 5.2 ProjectDetail - Carga Múltiple de Datos

**Estructura de Estado:**
```typescript
const [project, setProject] = useState<ProjectData | null>(null);
const [extraCosts, setExtraCosts] = useState<ExtraCost[]>([]);
const [notes, setNotes] = useState<Note[]>([]);
const [payments, setPayments] = useState<Payment[]>([]);
const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const isFetchingRef = useRef(false);  // ← Guard contra requests simultáneos
```

**Hook useParams:**
```typescript
const { projectId } = useParams<{ projectId: string }>();
```

**Hook useCallback con Dependencias:**
```typescript
const fetchProjectData = useCallback(async () => {
  if (isFetchingRef.current) return;  // Guard
  isFetchingRef.current = true;

  try {
    const projectNum = parseInt(projectId);
    const timestamp = new Date().getTime();
    
    // FETCH 1: Datos del proyecto
    const projectResponse = await axios.get(`...get_proyecto_detalle.php?id=${projectNum}&t=${timestamp}`);
    const projectData: ProjectData = {
      id: rawProjectData.id,
      nombre_proyecto: rawProjectData.nombre_proyecto,
      cliente_nombre: rawProjectData.cliente_nombre,
      horas_estimadas: parseFloat(rawProjectData.horas_estimadas) || 0,
      valor_hora_acordado: parseFloat(rawProjectData.valor_hora_acordado) || 0,
      revisiones_incluidas: parseInt(rawProjectData.revisiones_incluidas) || 0,
      revisiones_usadas: parseInt(rawProjectData.revisiones_usadas) || 0,
      estado: rawProjectData.estado as ProjectStatusType,
      share_token: rawProjectData.share_token,
      monto_bruto: parseFloat(rawProjectData.monto_bruto) || 0,  // ← NUEVO
      monto_liquido: parseFloat(rawProjectData.monto_liquido) || 0,  // ← NUEVO
    };
    setProject(projectData);

    // FETCH 2-5: Datos secundarios (costosExtras, notas, pagos, bitacora)
    // ... (código omitido por brevedad)

  } finally {
    isFetchingRef.current = false;
  }
}, [projectId]);

// Hook de montaje
useEffect(() => {
  fetchProjectData();
}, [fetchProjectData]);
```

---

### 5.3 CustomerView - Lectura Pública

**Hook useParams:**
```typescript
const { shareToken } = useParams<{ shareToken: string }>();
```

**Hook useCallback:**
```typescript
const fetchProjectData = useCallback(async () => {
  if (!shareToken) {
    setError("Token inválido");
    setLoading(false);
    return;
  }

  if (isFetchingRef.current) return;
  isFetchingRef.current = true;

  try {
    const timestamp = new Date().getTime();
    const projectUrl = `https://crm.claudiogonzalez.dev/api/get_proyecto_publico.php?token=${shareToken}&t=${timestamp}`;
    
    const projectResponse = await axios.get(projectUrl);
    const data = projectResponse.data;

    // Sanitizar proyecto
    const projectData: ProjectData = {
      id: data.proyecto.id,
      nombre_proyecto: data.proyecto.nombre_proyecto,
      cliente_nombre: data.proyecto.cliente_nombre,
      horas_estimadas: parseFloat(data.proyecto.horas_estimadas) || 0,
      valor_hora_acordado: parseFloat(data.proyecto.valor_hora_acordado) || 0,
      estado: data.proyecto.estado as ProjectStatusType,
      revisiones_incluidas: parseInt(data.proyecto.revisiones_incluidas) || 0,
      revisiones_usadas: parseInt(data.proyecto.revisiones_usadas) || 0,
    };

    // Sanitizar pagos - MAPEAR DESCRIPCION DE AMBOS CAMPOS
    const sanitizedPayments = paymentsData.map((p: any) => ({
      id: p.id,
      proyecto_id: p.proyecto_id,
      monto: parseFloat(p.monto) || 0,
      descripcion: p.descripcion || p.nota || '',  // ← Mapea ambos campos
      fecha: p.fecha_pago || p.fecha || '',
    }));

    // ... (más sanitización)

  } finally {
    isFetchingRef.current = false;
  }
}, [shareToken]);

// Hook de montaje + polling cada 5 minutos
useEffect(() => {
  fetchProjectData();
  const pollingInterval = setInterval(() => {
    fetchProjectData();
  }, 300000);  // 5 minutos
  return () => clearInterval(pollingInterval);
}, [fetchProjectData]);
```

---

### 5.4 Context - AuthContext

**Ubicación:** `client/contexts/AuthContext.tsx`

**Campos Guardados en State:**
```typescript
interface AuthContextType {
  token?: string;
  rol?: string;        // 'admin' | 'colaborador'
  userId?: number;
  login: (newToken: string, newRol?: string, newUserId?: number) => void;
  logout: () => void;
}
```

**Persistencia en localStorage:**
```typescript
localStorage.setItem('auth_token', newToken);
localStorage.setItem('auth_rol', newRol);
localStorage.setItem('auth_user_id', userId);
```

**Uso en Componentes:**
```typescript
const { logout, rol } = useAuth();
// Condicional renderizado basado en rol
{rol === 'admin' && <Link to="/equipo">Mi Equipo</Link>}
```

---

## 6. SINCRONIZACIÓN Y CONSISTENCIA

### 6.1 Cache-Busting

**Todos los endpoints incluyen timestamp:**
```typescript
const timestamp = new Date().getTime();
const url = `...?mes=1&anio=2024&t=${timestamp}`;  // ← Previene caching
```

### 6.2 Guards contra Requests Simultáneos

**Patrón utilizado en ProjectDetail y CustomerView:**
```typescript
const isFetchingRef = useRef(false);

if (isFetchingRef.current) {
  return;  // ← Ignora si ya hay un request activo
}
isFetchingRef.current = true;
```

### 6.3 Flujo de Actualización de Pagos

```
Usuario registra pago en PaymentManagement
  ↓
POST a registrar_pago.php
  ↓
success = true
  ↓
useEffect detecta: pendingBalanceRounded === 0?
  ↓
SÍ → Modal "¿Cambiar estado a Cobrado?"
  ↓
Usuario confirma
  ↓
POST a actualizar_estado.php
  ↓
onStatusChangeSuccess() → fetchProjectData()
  ↓
Todos los estados se actualizan
```

---

## 7. CAMPOS NO UTILIZADOS EN CLIENTE

✅ **Se utilizan en BD pero NO se calculan en Frontend:**
- `retencion_sii` - Calculado en BD, resultado final es `monto_liquido`
- `horas_reales` - Solo informativo, no afecta cálculos
- `valor_hora_final` - No se multiplica en cliente

❌ **Se eliminaron las multiplicaciones por:**
- `0.8475` (15.25% retention) - COMPLETAMENTE ELIMINADO
- Cálculos derivados de horas × valor_hora - ELIMINADO

---

## 8. PROBLEMAS IDENTIFICADOS Y RESOLUCIONES

### Problema 1: Inconsistencia en CustomerView
**Línea ~280 en CustomerView.tsx aún contiene:**
```typescript
const baseBruto = (estimatedHours * hourlyRate) / 0.8475;
```

**Recomendación:** Obtener monto_bruto del endpoint `get_proyecto_publico.php` en lugar de calcular.

### Problema 2: Descripción de Pagos
**Resuelto:** Ahora mapea `descripcion || nota`

```typescript
descripcion: p.descripcion || p.nota || ''
```

### Problema 3: Porcentajes Duplicados
**Resuelto:** Un solo porcentaje por sección (eliminar redundancias en UI)

---

## 9. RESUMEN DE INTEGRIDAD

| Aspecto | Estado | Observaciones |
|---------|--------|---------------|
| Eliminación 0.8475 | ✅ 95% | CustomerView aún tiene 1 fórmula |
| monto_bruto de BD | ✅ | Dashboard, ProjectDetail, RecentProjectCard |
| monto_liquido de BD | ✅ | Mostrado pero sin cálculos adicionales |
| Cálculo Saldo | ✅ | `totalContract - totalPaid` |
| Porcentaje Progreso | ✅ | `(totalPaid / totalContract) * 100` |
| Cache-busting | ✅ | Todos los endpoints con timestamp |
| Guards Simultáneos | ✅ | isFetchingRef en lugar críticos |
| Sincronización | ✅ | fetchProjectData() en useEffect |

---

## 10. PRÓXIMOS PASOS RECOMENDADOS

1. **Refactorizar CustomerView:**
   - Obtener monto_bruto desde `get_proyecto_publico.php`
   - Eliminar cálculo de `baseBruto = (hrs * rate) / 0.8475`

2. **Validación de Backend:**
   - Confirmar que `ganado_liquido` siempre viene con retención aplicada
   - Validar que `monto_bruto - retencion_sii = monto_liquido`

3. **Testing:**
   - Proyecto Entel (ID 12): Verificar $1.156.271 bruto → $979.940 líquido
   - Pago completado: Verificar transición a 100% y opción de "Cobrado"

4. **Monitoreo:**
   - Revisar logs de API para inconsistencias
   - Auditar campos no utilizados en BD
