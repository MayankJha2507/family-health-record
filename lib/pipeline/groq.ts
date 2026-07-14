/**
 * Groq text-structuring lane. Text-only, high rate limits — the default lane for
 * digital PDFs. Uses JSON mode. Page-chunked: large reports are structured a few
 * pages at a time and merged, so a single page's noise can't derail the whole
 * document and we stay within context comfortably.
 */
import Groq from 'groq-sdk';
import type { RawExtraction, TextStructurer } from './types';
import { EXTRACTION_SYSTEM_PROMPT, buildTextUserPrompt } from './prompt';
import { mergeExtractions, coerceExtraction } from './merge';

const MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
const PAGES_PER_CHUNK = 3;

export function createGroqStructurer(apiKey = process.env.GROQ_API_KEY): TextStructurer {
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');
  const groq = new Groq({ apiKey });

  return {
    async structure({ pageTexts }): Promise<RawExtraction> {
      const chunks: string[][] = [];
      for (let i = 0; i < pageTexts.length; i += PAGES_PER_CHUNK) {
        chunks.push(pageTexts.slice(i, i + PAGES_PER_CHUNK));
      }

      const partials: RawExtraction[] = [];
      for (const chunk of chunks) {
        const completion = await groq.chat.completions.create({
          model: MODEL,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
            { role: 'user', content: buildTextUserPrompt(chunk) },
          ],
        });
        const content = completion.choices[0]?.message?.content ?? '{}';
        partials.push(coerceExtraction(JSON.parse(content)));
      }
      return mergeExtractions(partials);
    },
  };
}
