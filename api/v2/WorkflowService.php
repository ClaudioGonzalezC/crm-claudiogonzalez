<?php
/**
 * WorkflowService
 * Gestiona las transiciones de status_v2 según /docs/crm_spec.md
 *
 * Workflow oficial:
 *   Draft → Evaluating → Quoted → Approved → Executing → Boleta → Closed
 *
 * Reglas de negocio:
 *   - Evaluating → Quoted  requiere has_project_eval = 1
 *   - Boleta → Closed      requiere emotional_eval_completed = 1 + profit_calculated = 1
 *   - No se pueden saltar estados
 *   - Closed es estado terminal (sin salida)
 *   - calculate_profit NO cambia status (se gestiona por separado)
 */
class WorkflowService
{
    // ─────────────────────────────────────────────────────────────
    // Mapa de transiciones: estado_actual → [destinos válidos]
    // ─────────────────────────────────────────────────────────────
    private const TRANSITIONS = [
        'Draft'      => ['Evaluating'],
        'Evaluating' => ['Quoted'],
        'Quoted'     => ['Approved'],
        'Approved'   => ['Executing'],
        'Executing'  => ['Boleta'],
        'Boleta'     => ['Closed'],
        'Closed'     => [],             // estado terminal
    ];

    // ─────────────────────────────────────────────────────────────
    // Flags requeridos por transición: "from→to" → [flag => valor]
    // ─────────────────────────────────────────────────────────────
    private const FLAG_REQUIREMENTS = [
        'Evaluating→Quoted' => [
            'has_project_eval' => 1,
        ],
        'Boleta→Closed' => [
            'emotional_eval_completed' => 1,
            'profit_calculated'        => 1,
        ],
    ];

    // ─────────────────────────────────────────────────────────────
    // Etiquetas legibles para los flags (usadas en mensajes de error)
    // ─────────────────────────────────────────────────────────────
    private const FLAG_LABELS = [
        'has_project_eval'         => 'Evaluación pre-proyecto (has_project_eval)',
        'emotional_eval_completed' => 'Evaluación emocional (emotional_eval_completed)',
        'profit_calculated'        => 'Cálculo de rentabilidad (profit_calculated)',
    ];

    /**
     * Retorna los estados destino válidos desde $current.
     *
     * @param  string $current  Estado actual de status_v2
     * @return string[]         Lista de estados posibles
     */
    public static function getValidTransitions(string $current): array
    {
        return self::TRANSITIONS[$current] ?? [];
    }

    /**
     * Valida si la transición $from → $to está permitida con los flags dados.
     *
     * @param  string $from   Estado actual (status_v2)
     * @param  string $to     Estado destino
     * @param  array  $flags  ['has_project_eval' => 0|1, ...]
     * @return array  ['valid' => bool, 'reason' => string|null, 'flag' => string|null]
     */
    public static function validateTransition(string $from, string $to, array $flags): array
    {
        // 1. Estado destino debe existir en el workflow
        if (!array_key_exists($to, self::TRANSITIONS)) {
            return [
                'valid'  => false,
                'reason' => "Estado '$to' no existe en el workflow V2.",
                'flag'   => null,
            ];
        }

        // 2. La transición debe estar en el mapa
        $allowed = self::TRANSITIONS[$from] ?? [];

        if (empty($allowed)) {
            return [
                'valid'  => false,
                'reason' => "'$from' es un estado terminal. No permite más transiciones.",
                'flag'   => null,
            ];
        }

        if (!in_array($to, $allowed, true)) {
            return [
                'valid'  => false,
                'reason' => "Transición no permitida: '$from' → '$to'. Desde '$from' solo puedes ir a: " . implode(', ', $allowed) . '.',
                'flag'   => null,
            ];
        }

        // 3. Verificar flags requeridos para esta transición específica
        $key = "$from→$to";
        if (isset(self::FLAG_REQUIREMENTS[$key])) {
            foreach (self::FLAG_REQUIREMENTS[$key] as $flag => $expected) {
                $actual = isset($flags[$flag]) ? (int) $flags[$flag] : 0;
                if ($actual !== $expected) {
                    $label = self::FLAG_LABELS[$flag] ?? $flag;
                    return [
                        'valid'  => false,
                        'reason' => "Requisito no cumplido para avanzar a '$to': $label debe estar completado.",
                        'flag'   => $flag,
                    ];
                }
            }
        }

        return ['valid' => true, 'reason' => null, 'flag' => null];
    }

    /**
     * Retorna todos los estados del workflow en orden canónico.
     *
     * @return string[]
     */
    public static function getWorkflowOrder(): array
    {
        return array_keys(self::TRANSITIONS);
    }

    /**
     * Indica si $status es el estado terminal del workflow.
     */
    public static function isClosed(string $status): bool
    {
        return $status === 'Closed';
    }
}
?>
