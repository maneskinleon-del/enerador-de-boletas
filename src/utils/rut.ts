/**
 * Utilidades para validar y formatear RUT chileno usando el algoritmo
 * módulo 11 del Servicio de Impuestos Internos (SII).
 */

/** Deja solo dígitos y la letra verificadora (K/k), en mayúscula. */
export function cleanRut(rut: string): string {
  return (rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

/** Calcula el dígito verificador (0-9 o K) para un cuerpo numérico de RUT. */
export function computeVerifierDigit(body: string): string {
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

/**
 * Valida un RUT chileno (con o sin puntos/guión).
 * Un campo vacío se considera válido (no obligamos a completarlo),
 * pero si el usuario escribió algo, debe calzar el dígito verificador.
 */
export function isValidRut(rut: string): boolean {
  const clean = cleanRut(rut);
  if (!clean) return true;
  if (clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  if (!/^\d+$/.test(body)) return false;

  return computeVerifierDigit(body) === dv;
}

/** Formatea un RUT limpio como "12.345.678-9". */
export function formatRut(rut: string): string {
  const clean = cleanRut(rut);
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${withDots}-${dv}`;
}
