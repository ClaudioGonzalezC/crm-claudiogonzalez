# Correcciones de AgreementModal - Contenido no visible

## Problema Reportado
El cliente reportó que el `AgreementModal` no muestra el cuerpo del texto del acuerdo para el proyecto "Rediseño Carpe Diem". Solo aparece el título y el botón de aceptar.

## Análisis de Raíz del Problema

### 1. Falta de Fallback de Contenido
- **Problema**: CustomerView asignaba `terminos_condiciones: data.proyecto.terminos_condiciones || ""` 
- **Impacto**: Proyectos existentes sin términos recibían un string vacío
- **Causa**: El campo fue agregado recientemente; proyectos legacy no tenían valores en la DB

### 2. Falta de Validación en el Modal
- **Problema**: AgreementModal no validaba si el `termsText` prop era vacío antes de renderizar
- **Impacto**: Modal recibía string vacío y renderizaba un contenedor vacío
- **Causa**: No había lógica de fallback en el componente

### 3. Problemas de CSS/Overflow
- **Problema**: Contenedor de términos podría tener altura de 0px o overflow: hidden ocultando contenido
- **Impacto**: Contenido existente no sería visible visualmente
- **Causa**: `flex-1` en contexto no-flex y `max-h-96` podría ser insuficiente

### 4. Duplicación de Constantes
- **Problema**: DEFAULT_TERMS estaba definido en 3 archivos diferentes (ProjectDetail, ProjectForm, y debía estar en AgreementModal)
- **Impacto**: Inconsistencia, mantenimiento difícil, riesgo de divergencia
- **Causa**: No había una constante centralizada compartida

## Correcciones Aplicadas

### 1. ✅ Crear Constante Centralizada
**Archivo Nuevo**: `client/constants/terms.ts`
```typescript
export const DEFAULT_TERMS = `ACUERDO DE PROYECTO Y PRESUPUESTO...`;
```
- Ubicación única y compartida
- Importable en AgreementModal, CustomerView, ProjectDetail, ProjectForm

### 2. ✅ Actualizar AgreementModal.tsx
**Cambios**:
- Importar `DEFAULT_TERMS` desde constants
- Importar `useEffect` para debug
- Agregar variable `displayTerms` con validación:
  ```typescript
  const displayTerms = termsText && termsText.trim() ? termsText : DEFAULT_TERMS;
  ```
- Agregar logging en `useEffect`:
  ```javascript
  console.log("🔍 AgreementModal - Validación de Contenido:", {
    termsTextLength: termsText?.length || 0,
    isUsingFallback: !termsText || termsText.trim() === "",
    displayTermsLength: displayTerms.length,
    preview: displayTerms.substring(0, 100) + "...",
  });
  ```
- Usar `displayTerms` en lugar de `termsText` en el renderizado
- Optimizar CSS: cambiar `max-h-96` a `max-h-[500px]` para mayor espacio y quitar `flex-1`

### 3. ✅ Actualizar CustomerView.tsx
**Cambios**:
- Importar `DEFAULT_TERMS` desde constants
- Cambiar asignación de fallback:
  ```typescript
  // ANTES:
  terminos_condiciones: data.proyecto.terminos_condiciones || ""
  
  // DESPUÉS:
  terminos_condiciones: data.proyecto.terminos_condiciones || DEFAULT_TERMS
  ```
- Agregar logging de debug específico para acuerdos:
  ```javascript
  console.log("🔍 DEBUG AGREEMENT - CustomerView:", {
    from_api: data.proyecto.terminos_condiciones || "(empty/null)",
    fallback_used: !data.proyecto.terminos_condiciones,
    display_length: projectData.terminos_condiciones.length,
    preview: projectData.terminos_condiciones.substring(0, 100) + "...",
  });
  ```

### 4. ✅ Actualizar ProjectDetail.tsx
**Cambios**:
- Importar `DEFAULT_TERMS` desde constants
- Eliminar la definición local de `DEFAULT_TERMS` (líneas 95-135)
- Ahora usa la constante centralizada

### 5. ✅ Actualizar ProjectForm.tsx
**Cambios**:
- Importar `DEFAULT_TERMS` desde constants
- Eliminar la definición local de `DEFAULT_TERMS` (líneas 34-74)
- Ahora usa la constante centralizada

### 6. ✅ Crear Script SQL de Emergencia
**Archivo**: `EMERGENCY_SQL_SCRIPT_AGREEMENT_FALLBACK.sql`
- Script para llenar proyectos existentes con terminos_condiciones vacías
- Incluye validación previa y posterior
- Específicamente busca el proyecto "Rediseño Carpe Diem"

## Stack de Validación - Cómo el Fallback Funciona Ahora

```
BACKEND (MySQL)
    ↓
    proyectos.terminos_condiciones = NULL o ""
    ↓
API RESPONSE (get_proyecto_publico.php)
    ↓
    data.proyecto.terminos_condiciones = null o ""
    ↓
CUSTOMERVIEW (Mapping)
    ↓
    projectData.terminos_condiciones = data.proyecto.terminos_condiciones || DEFAULT_TERMS
                                     = DEFAULT_TERMS (porque es null/empty)
    ↓
AGREEMENT MODAL (Props)
    ↓
    termsText = DEFAULT_TERMS
    ↓
AGREEMENT MODAL (Validation)
    ↓
    displayTerms = termsText && termsText.trim() ? termsText : DEFAULT_TERMS
                = DEFAULT_TERMS (porque termsText ya es DEFAULT_TERMS)
    ↓
RENDER
    ↓
    {displayTerms} → FULL AGREEMENT TEXT VISIBLE
```

## Verificación y Testing

### Para Testing Local:

1. **Abrir consola del navegador (F12)**
   - Ir a tab "Console"
   - Buscar logs "🔍 AgreementModal - Validación de Contenido:"
   - Verificar que `displayTermsLength` sea > 100
   - Verificar que `isUsingFallback` sea `true` si el backend envía vacío

2. **Buscar logs de CustomerView**
   - Logs "🔍 DEBUG AGREEMENT - CustomerView:"
   - Verificar que `display_length` > 100
   - Verificar que `fallback_used: true` si era necesario

3. **Visualmente**
   - Modal debe mostrar todo el texto del acuerdo
   - Contenedor debe ser scrolleable (max-h-[500px])
   - No debe haber contenido cortado o invisible

### Para Ejecutar Script SQL:

1. Conectar a la base de datos MySQL
2. Ejecutar el primer SELECT para ver cuántos proyectos tienen términos vacíos
3. Ejecutar el UPDATE para poblar los campos
4. Ejecutar el segundo SELECT para verificar que fue exitoso
5. Ejecutar el tercero para específicamente verificar "Rediseño Carpe Diem"

## Expected Behavior Después de las Correcciones

**Escenario 1: Backend envía terminos_condiciones vacío o NULL**
- CustomerView: asigna DEFAULT_TERMS
- AgreementModal: recibe DEFAULT_TERMS, valida que no esté vacío
- Resultado: ✅ Usuario ve el texto completo del acuerdo

**Escenario 2: Backend envía terminos_condiciones con valor customizado**
- CustomerView: asigna el valor del backend
- AgreementModal: recibe el valor, valida que no esté vacío (es true)
- Resultado: ✅ Usuario ve el texto customizado del admin

**Escenario 3: Backend aún envía vacío después de ejecutar SQL**
- CustomerView: asigna DEFAULT_TERMS (fallback)
- AgreementModal: recibe DEFAULT_TERMS, no usa segundo fallback (no es necesario)
- Resultado: ✅ Usuario ve el texto del acuerdo

## Archivos Modificados

1. ✅ `client/constants/terms.ts` - NUEVO
2. ✅ `client/components/AgreementModal.tsx` - MODIFICADO
3. ✅ `client/pages/CustomerView.tsx` - MODIFICADO
4. ✅ `client/pages/ProjectDetail.tsx` - MODIFICADO
5. ✅ `client/pages/ProjectForm.tsx` - MODIFICADO
6. ✅ `EMERGENCY_SQL_SCRIPT_AGREEMENT_FALLBACK.sql` - NUEVO

## Próximos Pasos

1. **Ejecutar el script SQL** en la base de datos para llenar proyectos existentes
2. **Verificar en navegador**:
   - Abrir portal del cliente para "Rediseño Carpe Diem"
   - Confirmar que AgreementModal muestra el texto completo
   - Revisar logs en consola
3. **Si sigue sin funcionar**:
   - Verificar que el backend realmente envía `terminos_condiciones`
   - Agregar más logs si es necesario
   - Revisar que la API endpoint devuelve el campo correcto

## Notas Técnicas

- **Validación en múltiples niveles**: CustomerView + AgreementModal ambos tienen fallback
- **Debugging completo**: Console.log en ambos componentes para auditoría
- **CSS mejorado**: max-h-[500px] proporciona más espacio que max-h-96 (384px)
- **Centralización**: Una sola verdad para DEFAULT_TERMS en toda la app
- **Seguridad**: No se cambió ninguna lógica de validación o autenticación
