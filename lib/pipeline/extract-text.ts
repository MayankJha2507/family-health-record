/**
 * Server-side PDF text-layer extraction via unpdf (no native bindings, works on
 * Vercel). Returns per-page text so the router can judge whether a real text
 * layer exists and Groq can be page-chunked.
 */
import { extractText, getDocumentProxy } from 'unpdf';

export interface ExtractedText {
  totalPages: number;
  pageTexts: string[];
  combined: string;
}

export async function extractPdfText(pdf: Buffer): Promise<ExtractedText> {
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const { totalPages, text } = await extractText(doc, { mergePages: false });
  const pageTexts = Array.isArray(text) ? text : [text];
  return {
    totalPages: totalPages ?? pageTexts.length,
    pageTexts,
    combined: pageTexts.join('\n\n'),
  };
}
