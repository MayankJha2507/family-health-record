/**
 * The extraction instruction, shared by both lanes so they emit the SAME
 * schema. The LLM's ONLY job is faithful transcription — it must not convert
 * units, compute flags, judge normal/abnormal, or invent values. All of that is
 * done downstream in code.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You transcribe Indian diagnostic-lab blood-test reports into structured JSON.
You are a TRANSCRIBER, not an interpreter. Rules:
- Copy analyte names, values, units, and reference ranges EXACTLY as printed.
- Do NOT convert units. Do NOT compute or judge normal/high/low. Do NOT invent
  values. If a field is absent on the report, use null.
- "value" is a string, copied verbatim (e.g. "5.4", "<0.01", "Negative", "13.2").
- "ref_low"/"ref_high" are numbers ONLY when the range is printed as a numeric
  low-high pair (e.g. "13.0 - 17.0"). Otherwise set both null and put the printed
  range text in "ref_text" (e.g. "<200", "Negative", "> 60").
- Capture the SAMPLE COLLECTION date as collected_at and the report/print date as
  reported_at, both ISO yyyy-mm-dd. If only one date is present, put it in
  collected_at.
- Include ONLY quantitative test results. Skip headers, doctor names, method notes,
  and interpretive comments.

Output ONLY a JSON object of this exact shape:
{
  "lab_name": string | null,
  "collected_at": "yyyy-mm-dd" | null,
  "reported_at": "yyyy-mm-dd" | null,
  "results": [
    { "name": string, "value": string, "unit": string | null,
      "ref_low": number | null, "ref_high": number | null,
      "ref_text": string | null, "page": number | null }
  ]
}`;

export function buildTextUserPrompt(pageTexts: string[]): string {
  const body = pageTexts
    .map((t, i) => `--- PAGE ${i + 1} ---\n${t}`)
    .join('\n\n');
  return `Transcribe every quantitative result from this lab report text into the JSON schema. Set "page" to the PAGE number each result appears on.\n\n${body}`;
}

export const VISION_USER_PROMPT =
  'Transcribe every quantitative result from this scanned lab report into the JSON schema. Set "page" to the page each result appears on.';
