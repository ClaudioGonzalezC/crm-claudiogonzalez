/**
 * dateFormatter.ts — Utilidades de formato de fecha/hora para el CRM.
 *
 * PROBLEMA RAÍZ:
 *   MySQL devuelve timestamps como "2026-03-20 15:43:10" (sin offset).
 *   `new Date("2026-03-20 15:43:10")` es AMBIGUO por spec:
 *     - Chrome/Safari → lo trata como LOCAL  (correcto si el navegador está en Chile)
 *     - Firefox/Node  → puede tratarlo como UTC → muestra 3 horas más tarde
 *
 * SOLUCIÓN:
 *   1. El backend ahora emite ISO 8601 con offset: "2026-03-20T15:43:10-03:00"
 *      → `new Date()` siempre lo parsea correctamente en todos los browsers.
 *   2. Para strings legacy sin offset, normalizamos reemplazando el espacio por 'T'
 *      y asumimos America/Santiago (UTC-3 / UTC-4 según DST).
 *      La visualización se hace con `timeZone: 'America/Santiago'` para que
 *      independientemente de la TZ del navegador del usuario, siempre se vea
 *      la hora chilena.
 */

const CHILE_TZ = 'America/Santiago';

/**
 * Normaliza un string de fecha de MySQL a algo que Date() parsea sin ambigüedad.
 * "2026-03-20 15:43:10"         → "2026-03-20T15:43:10"   (ISO sin offset)
 * "2026-03-20T15:43:10-03:00"   → sin cambio              (ya es ISO con offset)
 * "2026-03-20"                  → sin cambio              (solo fecha)
 */
function normalizeDateString(dateString: string): string {
  if (!dateString) return dateString;
  // Si ya tiene 'T' o '+' o termina en 'Z', está en formato ISO → no tocar
  if (dateString.includes('T') || dateString.includes('+') || dateString.endsWith('Z')) {
    return dateString;
  }
  // "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SS"
  // El navegador parsea esto como local time — luego Intl.DateTimeFormat
  // con timeZone: 'America/Santiago' mostrará la hora correcta.
  return dateString.replace(' ', 'T');
}

interface FormatDateOptions {
  includeTime?: boolean;
  includeSeconds?: boolean;
}

/**
 * Formatea una fecha/hora en locale es-CL, siempre en America/Santiago.
 *
 * @param dateString  String de fecha (ISO con offset, ISO sin offset, o MySQL "YYYY-MM-DD HH:MM:SS")
 * @param options     { includeTime: true } para mostrar hora y minutos
 */
export function safeFormatDate(
  dateString: string | null | undefined,
  options: FormatDateOptions = { includeTime: true }
): string {
  if (!dateString) return '—';

  try {
    const normalized = normalizeDateString(String(dateString));
    const date = new Date(normalized);

    if (isNaN(date.getTime())) return dateString as string;

    const { includeTime = true, includeSeconds = false } = options;

    const dtfOptions: Intl.DateTimeFormatOptions = {
      timeZone: CHILE_TZ,
      year:     'numeric',
      month:    '2-digit',
      day:      '2-digit',
    };

    if (includeTime) {
      dtfOptions.hour   = '2-digit';
      dtfOptions.minute = '2-digit';
      if (includeSeconds) {
        dtfOptions.second = '2-digit';
      }
    }

    return new Intl.DateTimeFormat('es-CL', dtfOptions).format(date);
  } catch {
    return String(dateString);
  }
}

/**
 * Formatea un valor numérico como moneda CLP.
 */
export function safeFormatCurrency(
  value: number | null | undefined,
  locale = 'es-CL'
): string {
  const num = Number(value);
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat(locale, {
    style:                 'currency',
    currency:              'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}
