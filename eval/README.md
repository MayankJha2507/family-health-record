# Golden-set eval harness

Runs lab PDFs through the **same pipeline the app uses** and diffs the output
against hand-checked expected JSON, reporting per-field accuracy. Built to grow:
drop in more PDFs over time and re-run.

## Privacy

Real reports are health data. **`eval/pdfs/`, `eval/expected/`, and `eval/cache/`
are gitignored and never committed.** Only this harness and the synthetic
`eval/fixtures/` (no real data) live in git.

## Layout

```
eval/
  pdfs/<name>.pdf              a real report                (gitignored)
  expected/<name>.json         hand-checked expected output (gitignored)
  cache/<name>.raw.json        cached LLM transcription     (gitignored, auto-written)
  fixtures/<name>.expected.json + <name>.raw.json   synthetic demo (committed)
  run.ts                       the harness
```

## Run it

```bash
npm run eval            # replay from cache where present; else call the LLMs
npm run eval -- --live  # force re-calling the LLMs and refresh the cache
```

With no real PDFs loaded, the committed synthetic fixture still runs and proves
the mechanics (alias matching, unit conversion, flagging, unmatched handling).

## Add a report to the golden set

1. Drop the PDF at `eval/pdfs/my-report.pdf`.
2. Create `eval/expected/my-report.json` by reading the PDF yourself:

   ```json
   {
     "lab_name": "Dr Lal PathLabs",
     "collected_at": "2026-03-12",
     "results": [
       { "code": "hba1c", "value": 5.4, "ref_low": 4.0, "ref_high": 5.6, "flag": "normal" },
       { "code": "ldl",   "value": 165, "ref_high": 100, "flag": "high" },
       { "code": null,    "value": null }
     ]
   }
   ```
   - `code` is the canonical biomarker code (see `lib/biomarkers/dictionary.ts`);
     use `null` for an analyte you expect to be unmatched.
   - `value` is in the biomarker's **canonical unit** (the harness compares against
     the converted value).
   - `ref_low` / `ref_high` / `flag` are optional; include them to grade those fields.
3. `npm run eval -- --live` once (calls the LLMs, caches the transcription), then
   `npm run eval` freely thereafter while you tune normalization.

## The replay cache & the ≥90% gate

The first live run saves each PDF's raw transcription to `eval/cache/`. Re-runs
read it — so you iterate on the **deterministic** code (normalization, flagging,
diff) without re-burning API calls. To re-test the LLM transcription itself
(e.g. after a prompt change), run with `--live`.

The headline metric is **correct biomarker match + correct value**. The ≥90% bar
is **provisional** until the golden set spans multiple labs and at least one
scanned report.
