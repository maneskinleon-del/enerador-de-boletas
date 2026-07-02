/**
 * Cliente para el endpoint /api/gemini.
 *
 * A diferencia de la versión anterior, esta capa NUNCA maneja una API key
 * en el navegador: la key de Gemini vive solo en el servidor (función
 * serverless de Vercel en producción, servidor Express en `npm run dev:api`
 * para desarrollo local). El front solo envía la acción y el payload.
 */

export type GeminiAction = 'fill' | 'polish' | 'email';

export interface GeminiFillResult {
  client?: {
    name?: string;
    rut?: string;
    address?: string;
    contact?: string;
  };
  items?: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    discount?: number;
  }>;
  currency?: string;
}

async function callGeminiApi<T = unknown>(action: GeminiAction, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });

  if (!response.ok) {
    let message = `Error del servidor (${response.status})`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error) message = errorBody.error;
    } catch {
      // ignore parse errors, keep default message
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function requestFillFromText(text: string) {
  return callGeminiApi<GeminiFillResult>('fill', { text });
}

export function requestPolishNotes(notes: string) {
  return callGeminiApi<{ text: string }>('polish', { notes });
}

export function requestEmailDraft(details: Record<string, string>) {
  return callGeminiApi<{ text: string }>('email', { details });
}
