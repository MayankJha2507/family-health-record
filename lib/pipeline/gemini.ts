/**
 * Gemini vision lane. Capable but rate-limited — used ONLY for scanned/image
 * PDFs (or as the text-lane fallback). Gemini ingests PDF bytes natively and
 * rasterizes internally, so we send the whole PDF in one call rather than
 * rendering pages ourselves (fewer deps, one request = gentler on rate limits).
 * Wrapped in retry/backoff because 429s are the expected failure here.
 *
 * NOTE (flagged for review): the locked plan said "render pages → vision,
 * sequential". Native PDF ingestion is a strict simplification of that within
 * the Gemini lane. If you'd rather rasterize explicitly (e.g. to page-chunk very
 * large scans), that swaps in behind this same VisionExtractor interface.
 */
import { GoogleGenAI } from '@google/genai';
import type { RawExtraction, VisionExtractor } from './types';
import { EXTRACTION_SYSTEM_PROMPT, VISION_USER_PROMPT } from './prompt';
import { coerceExtraction } from './merge';

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
const MAX_ATTEMPTS = 4;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Retry on rate-limit / transient errors with exponential backoff + jitter. */
async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const retryable = status === 429 || status === 503 || status === 500 || status == null;
      if (!retryable || attempt === MAX_ATTEMPTS - 1) throw err;
      const delay = Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500;
      await sleep(delay);
    }
  }
  throw lastErr;
}

export function createGeminiExtractor(apiKey = process.env.GEMINI_API_KEY): VisionExtractor {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const ai = new GoogleGenAI({ apiKey });

  return {
    async extract({ pdf }): Promise<RawExtraction> {
      const response = await withBackoff(() =>
        ai.models.generateContent({
          model: MODEL,
          config: {
            systemInstruction: EXTRACTION_SYSTEM_PROMPT,
            temperature: 0,
            responseMimeType: 'application/json',
          },
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'application/pdf', data: pdf.toString('base64') } },
                { text: VISION_USER_PROMPT },
              ],
            },
          ],
        }),
      );
      const text = response.text ?? '{}';
      return coerceExtraction(JSON.parse(text));
    },
  };
}
