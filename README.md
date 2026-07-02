# Generador de Boletas

PWA para generar boletas, facturas, recibos y boletas de honorarios chilenas, con exportación a PDF y un asistente de IA (Gemini) para autocompletar datos desde texto libre.

## Arquitectura

```
src/
  App.tsx              Componente principal (formulario + vista previa)
  components/
    EditableText.tsx    Texto/textarea inline editable (usado en el "papel")
    EditableNumber.tsx  Input numérico inline editable
    RutField.tsx        Input de RUT con validación mod-11 en vivo
  utils/
    rut.ts               Validación y formateo de RUT chileno (SII)
    calculations.ts       Motor de cálculo de IVA / retención / totales
    currency.ts            Formateo de moneda (CLP/USD/EUR/UF)
    storage.ts              Wrappers seguros de localStorage
    geminiClient.ts         Cliente que habla con /api/gemini (sin API key en el navegador)
  constants/
    tax.ts                Tasas tributarias (IVA, retención honorarios)

api/
  gemini.ts             Función serverless de Vercel: único lugar que usa GEMINI_API_KEY
  _lib/geminiCore.ts     Lógica compartida de los 3 modos de IA (fill / polish / email)

server/
  dev-server.ts          Servidor Express local que replica /api/gemini (solo para `npm run dev`)
```

La API key de Gemini **vive solo en el servidor**. El navegador nunca la ve: solo llama a `/api/gemini`, que en producción resuelve Vercel (`api/gemini.ts`) y en desarrollo local resuelve `server/dev-server.ts` (Vite hace proxy de `/api` hacia él, ver `vite.config.ts`).

## Correr en local

**Requisitos:** Node.js 18+

1. Instala dependencias:
   ```
   npm install
   ```
2. Copia `.env.example` a `.env.local` y define tu `GEMINI_API_KEY` (consíguela gratis en [Google AI Studio](https://aistudio.google.com/)).
3. Levanta el backend local de IA (en una terminal):
   ```
   npm run dev:api
   ```
4. Levanta el front (en otra terminal):
   ```
   npm run dev
   ```
5. Abre `http://localhost:3000`.

Si no configuras `GEMINI_API_KEY`, la app funciona igual (formulario, cálculos, PDF), solo el autocompletado con IA mostrará un error explicando que falta la key.

## Desplegar en Vercel

1. Importa el repo en Vercel.
2. En **Settings → Environment Variables**, agrega `GEMINI_API_KEY` con tu key (marca "server-side only", nunca uses el prefijo `VITE_`).
3. Vercel detecta automáticamente `api/gemini.ts` como función serverless; no necesitas configuración extra.

## Notas de mantenimiento

- **Tasa de retención de honorarios** (`src/constants/tax.ts`): sube cada año por la reforma tributaria (Art. 74 N°2 LIR). Revísala en enero según la tabla vigente del SII.
- **Validación de RUT**: usa el algoritmo módulo 11 estándar del SII (`src/utils/rut.ts`). Un campo vacío se considera válido (no es obligatorio), pero si hay contenido debe calzar el dígito verificador.
