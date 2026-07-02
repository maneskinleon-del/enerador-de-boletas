/**
 * Wrappers seguros para localStorage: nunca lanzan (modo incógnito,
 * cuota llena, storage deshabilitado, etc. quedan contenidos).
 */

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`No se pudo leer "${key}" de localStorage`, e);
    return null;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`No se pudo guardar "${key}" en localStorage`, e);
    return false;
  }
}

export function safeGetJSON<T>(key: string, fallback: T): T {
  const raw = safeGetItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`No se pudo parsear "${key}" de localStorage`, e);
    return fallback;
  }
}
