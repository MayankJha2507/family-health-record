/**
 * Pipeline orchestrator. Framework-agnostic: the eval harness (local files) and
 * the Next.js upload route (Gate 2) both call runPipeline. It never touches
 * Supabase — callers persist the result.
 *
 * Flow: extract text layer → route by strength → Groq (text) or Gemini (vision)
 *   → if the text lane returns junk, fall back to vision → normalize in code.
 *
 * The LLM lanes are INJECTED (TextStructurer / VisionExtractor) so the harness
 * can supply a replay implementation and run without API keys.
 */
import { extractPdfText } from './extract-text';
import { decideRoute } from './route';
import { normalizeExtraction } from './normalize';
import { isLikelyJunk } from './merge';
import type {
  PipelineResult,
  TextStructurer,
  VisionExtractor,
} from './types';

export interface PipelineDeps {
  text: TextStructurer;
  vision: VisionExtractor;
}

export async function runPipeline(
  input: { pdf: Buffer; filename: string },
  deps: PipelineDeps,
): Promise<PipelineResult> {
  const notes: string[] = [];
  const extracted = await extractPdfText(input.pdf);
  const route = decideRoute(extracted);
  notes.push(`route: ${route.lane} — ${route.reason}`);

  let parserUsed: 'groq' | 'gemini';
  let rawExtraction;

  if (route.lane === 'text') {
    parserUsed = 'groq';
    rawExtraction = await deps.text.structure({
      text: extracted.combined,
      pageTexts: extracted.pageTexts,
    });
    // Fallback: text layer looked fine but Groq produced junk → re-route to vision
    // rather than commit garbage.
    if (isLikelyJunk(rawExtraction, extracted.combined)) {
      notes.push('text lane returned junk — falling back to vision');
      parserUsed = 'gemini';
      rawExtraction = await deps.vision.extract({ pdf: input.pdf, filename: input.filename });
    }
  } else {
    parserUsed = 'gemini';
    rawExtraction = await deps.vision.extract({ pdf: input.pdf, filename: input.filename });
  }

  const results = normalizeExtraction(rawExtraction);
  const unmatched = results.filter((r) => r.biomarker_id === null).length;
  if (unmatched > 0) notes.push(`${unmatched} analyte(s) not in dictionary — stored raw, not trended`);

  return { parserUsed, rawExtraction, results, notes };
}

/** Default production wiring (real APIs). The harness passes its own deps. */
export async function createDefaultDeps(): Promise<PipelineDeps> {
  // Imported lazily (ESM-safe) so replay mode never loads the SDKs or needs keys.
  const [{ createGroqStructurer }, { createGeminiExtractor }] = await Promise.all([
    import('./groq'),
    import('./gemini'),
  ]);
  return { text: createGroqStructurer(), vision: createGeminiExtractor() };
}
