import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleGeminiAction, GeminiRequestError } from './_lib/geminiCore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const { action, ...payload } = (req.body || {}) as { action?: string; [key: string]: unknown };

  if (!action) {
    res.status(400).json({ error: 'Falta el parámetro "action".' });
    return;
  }

  try {
    const result = await handleGeminiAction(action, payload, process.env.GEMINI_API_KEY || '');
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof GeminiRequestError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Error inesperado en /api/gemini:', error);
    res.status(500).json({ error: 'Error inesperado al procesar la solicitud de IA.' });
  }
}
