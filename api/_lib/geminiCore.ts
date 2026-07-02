import { GoogleGenAI } from '@google/genai';

export class GeminiRequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface FillPayload {
  text?: string;
}

interface PolishPayload {
  notes?: string;
}

interface EmailPayload {
  details?: Record<string, string>;
}

/**
 * Ejecuta la acción de Gemini solicitada. La `apiKey` se lee siempre de
 * una variable de entorno del servidor (GEMINI_API_KEY) — nunca llega
 * desde el cliente.
 */
export async function handleGeminiAction(
  action: string,
  body: FillPayload & PolishPayload & EmailPayload,
  apiKey: string
): Promise<Record<string, unknown>> {
  if (!apiKey) {
    throw new GeminiRequestError(
      'El servidor no tiene configurada GEMINI_API_KEY. Revisa las variables de entorno.',
      500
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  switch (action) {
    case 'fill': {
      const text = (body.text || '').trim();
      if (!text) throw new GeminiRequestError('Falta el texto a procesar.');

      const systemPrompt = `Eres un experto administrativo chileno. Analiza el siguiente texto en español y extrae la información para rellenar un documento de cobro (Boleta o Factura).
Debes identificar:
1. El cliente (Nombre/Razón Social, RUT si se menciona, Dirección, Correo/Teléfono).
2. Los productos o servicios cobrados (Nombre/Descripción, Cantidad, Precio Unitario, y si hay descuento).
3. Moneda sugerida (CLP, USD, EUR, etc. según el texto).

Genera un objeto JSON estrictamente en este formato (sin rodeos, sin markdown extra, solo el objeto JSON plano):
{
  "client": {
    "name": "Nombre o Razón social encontrada",
    "rut": "RUT encontrado (formato XX.XXX.XXX-X o vacío)",
    "address": "Dirección encontrada o vacía",
    "contact": "Correo o teléfono encontrado o vacío"
  },
  "items": [
    {
      "description": "Descripción clara del servicio o producto",
      "quantity": número entero,
      "unitPrice": número (precio unitario),
      "discount": número de descuento o 0
    }
  ],
  "currency": "CLP" o "USD" o "EUR"
}

Texto de usuario a analizar:
"${text}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt,
        config: { responseMimeType: 'application/json' },
      });

      const responseText = response.text || '{}';
      return JSON.parse(responseText);
    }

    case 'polish': {
      const notes = (body.notes || '').trim();
      if (!notes) throw new GeminiRequestError('Falta el texto de notas a mejorar.');

      const prompt = `Mejora y formaliza las siguientes notas/condiciones de pago para que suenen extremadamente profesionales, claras y educadas. Conserva los datos importantes como cuentas bancarias, plazos o correos de confirmación.
Notas actuales:
"${notes}"

Devuelve únicamente la versión mejorada del texto.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return { text: (response.text || '').trim() };
    }

    case 'email': {
      const details = body.details || {};
      const prompt = `Genera un borrador de correo electrónico formal para enviar una factura o boleta de cobro.
Detalles del documento:
- Tipo: ${details.documentType || ''}
- Número: ${details.number || ''}
- Emisor: ${details.company || ''}
- Cliente: ${details.client || ''}
- Total: ${details.total || ''}

Devuelve solo el texto del correo, incluyendo el Asunto y el Cuerpo de forma pulida.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return { text: (response.text || '').trim() };
    }

    default:
      throw new GeminiRequestError(`Acción desconocida: ${action}`);
  }
}
