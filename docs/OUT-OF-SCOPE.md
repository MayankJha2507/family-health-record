# Out of Scope — the MVP contract

This list exists to be reread mid-build, at the exact moment a feature feels like
"just one more thing." Each item is deferred deliberately, not forgotten. Adding any
of them to the MVP requires consciously editing this file first — that friction is
the point.

## Not in the MVP

- **Multi-user families, sharing, doctor logins, share links.** One account owns all
  profiles. Sharing roughly doubles auth/RLS complexity. Revisit at friends-beta+.
- **LLM-written narrative summaries.** ("HbA1c trending up over 3 tests…") Medically
  the riskiest feature; the structured data table IS the summary. Needs guardrail
  work that doesn't fit an MVP.
- **Canonical / age-sex reference ranges, "optimal ranges," health scores.** We show
  the lab's own printed range per result. Curating canonical ranges is real
  medical-content work and easy to get dangerously wrong.
- **Non-blood reports.** No imaging, ECG, urine/stool, prescriptions, discharge
  summaries. Blood-test PDFs only.
- **WhatsApp bot, reminders, notifications, wearables, native mobile app.** Web only.
- **Multilingual OCR.** Hindi-only or vernacular reports: store the PDF, skip
  extraction, allow manual entry.
- **Payments, waitlists, marketing site.** Audience is family, then friends.
- **DPDP-Act compliance program.** Deferred while users are family/friends. The
  non-diagnostic disclaimer is NOT deferred — it ships in Phase 0–2 UI.

## Standing product rule (never in scope)

The app **never diagnoses, never recommends treatment, never interprets beyond
"out of the lab's printed range."** The only call to action is
"discuss with your doctor."
