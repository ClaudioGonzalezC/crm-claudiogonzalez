-- EMERGENCY SQL SCRIPT: Populate missing terminos_condiciones fields
-- Run this on your database to fill empty agreement fields with the default template
-- This ensures that all projects have valid agreement text to display in the client portal

-- First, check how many projects have empty or NULL terminos_condiciones
SELECT COUNT(*) as empty_terms_count 
FROM proyectos 
WHERE terminos_condiciones IS NULL OR terminos_condiciones = '';

-- Then run the UPDATE to populate them with the default template
UPDATE proyectos 
SET terminos_condiciones = 'ACUERDO DE PROYECTO Y PRESUPUESTO

1. DESCRIPCIÓN DEL PROYECTO
El presente acuerdo regula el desarrollo del proyecto especificado en este documento entre el Proveedor de Servicios Freelance y el Cliente.

2. PROPIEDAD INTELECTUAL
Todos los trabajos, diseños, códigos y materiales generados durante este proyecto son propiedad intelectual del Cliente una vez se realice el pago completo del proyecto. El Proveedor retiene los derechos de utilizar el trabajo como referencia en su portafolio, salvo indicación contraria.

3. TÉRMINOS DE PAGO
- Abono inicial (50%): Requerido antes del inicio del proyecto
- Abono final (50%): Debido a la entrega del proyecto
- Se aceptan transferencias bancarias y medios de pago digitales
- Sin excepción, el proyecto no avanzará sin el abono inicial confirmado

4. PLAZOS DE ENTREGA
Los plazos acordados comienzan después de confirmarse el abono inicial. Retrasos causados por cambios de scope o falta de información del cliente no responsabilizan al proveedor de incumplir plazos.

5. REVISIONES Y CAMBIOS
- El número de revisiones incluidas se especifica en el presupuesto
- Cambios significativos en el alcance pueden requerir presupuesto adicional
- Las revisiones fuera del alcance se cobran a tarifa por hora

6. RESPONSABILIDADES
El Cliente es responsable de proporcionar:
- Especificaciones claras del proyecto
- Recursos necesarios (contenido, accesos, etc.)
- Feedback oportuno en las fases de revisión

El Proveedor es responsable de:
- Entregar trabajo de calidad profesional
- Cumplir con los plazos acordados
- Mantener confidencialidad de la información

7. CONFIDENCIALIDAD
Ambas partes acuerdan mantener confidencial cualquier información sensible del proyecto compartida durante su ejecución.

8. LIMITACIÓN DE RESPONSABILIDAD
El Proveedor no es responsable por pérdidas indirectas, lucro cesante o daños especiales derivados del proyecto.

9. ACUERDO COMPLETO
Este acuerdo constituye el entendimiento completo entre las partes y reemplaza todos los acuerdos previos.'
WHERE terminos_condiciones IS NULL OR terminos_condiciones = '';

-- Verify the update
SELECT COUNT(*) as populated_terms_count 
FROM proyectos 
WHERE terminos_condiciones IS NOT NULL AND terminos_condiciones != '';

-- Show projects that were updated (with specific project "Rediseño Carpe Diem")
SELECT 
  id,
  nombre_proyecto,
  LENGTH(terminos_condiciones) as terms_length,
  terminos_aceptados,
  fecha_aceptacion
FROM proyectos
WHERE nombre_proyecto = 'Rediseño Carpe Diem'
  OR nombre_proyecto LIKE '%Carpe%'
ORDER BY id DESC
LIMIT 10;
