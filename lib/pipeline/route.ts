/**
 * Route by strength: a genuine digital text layer → Groq (cheap, high limits);
 * a scanned/image PDF with little or no extractable text → Gemini vision
 * (capable but rate-limited). The threshold is deliberately conservative — when
 * in doubt we prefer vision over feeding Groq garbage.
 */
import type { ExtractedText } from './extract-text';

/** Minimum meaningful characters per page to trust the text layer. */
const MIN_CHARS_PER_PAGE = 200;

export interface RouteDecision {
  lane: 'text' | 'vision';
  reason: string;
  charsPerPage: number;
  hasDigits: boolean;
}

export function decideRoute(extracted: ExtractedText): RouteDecision {
  const totalChars = extracted.combined.replace(/\s/g, '').length;
  const pages = Math.max(1, extracted.totalPages);
  const charsPerPage = Math.round(totalChars / pages);
  // A lab report is mostly numbers; a text layer with no digits is suspect.
  const hasDigits = /\d/.test(extracted.combined);

  if (charsPerPage >= MIN_CHARS_PER_PAGE && hasDigits) {
    return { lane: 'text', reason: `text layer present (${charsPerPage} chars/page)`, charsPerPage, hasDigits };
  }
  return {
    lane: 'vision',
    reason: hasDigits
      ? `sparse text layer (${charsPerPage} chars/page < ${MIN_CHARS_PER_PAGE})`
      : 'no digits in text layer — likely scanned',
    charsPerPage,
    hasDigits,
  };
}
