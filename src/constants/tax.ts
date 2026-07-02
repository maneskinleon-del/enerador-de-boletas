/**
 * Constantes tributarias chilenas.
 *
 * IMPORTANTE: la tasa de retención de Boletas de Honorarios sube cada año
 * por la reforma de la Ley 21.133 (Art. 74 N°2 LIR), hasta estabilizarse
 * en 17%. Revisa y actualiza `RETENCION_HONORARIOS_RATE` en enero de
 * cada año según la tabla vigente publicada por el SII:
 * https://www.sii.cl
 */
export const IVA_RATE = 0.19;

// Vigente para el año tributario 2026/2027. Actualizar anualmente.
export const RETENCION_HONORARIOS_RATE = 0.1375;
export const RETENCION_HONORARIOS_RATE_YEAR = 2026;
