/**
 * Servidor local (solo para desarrollo) que replica /api/gemini fuera de
 * Vercel. Se ejecuta con `npm run dev:api` en paralelo a `npm run dev`
 * (Vite hace proxy de /api hacia este servidor, ver vite.config.ts).
 *
 * En producción (Vercel) esta ruta la maneja api/gemini.ts directamente,
 * este archivo no se despliega.
 */
import 'dotenv/config';
import express from 'express';
import { handleGeminiAction, GeminiRequestError } from '../api/_lib/geminiCore';

const app = express();
const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 8787;

app.use(express.json());

app.post('/api/gemini', async (req, res) => {
  const { action, ...payload } = req.body || {};

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
});

app.listen(PORT, () => {
  console.log(`API local de Gemini escuchando en http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY no está definida en .env.local — el asistente de IA no funcionará.');
  }
});
