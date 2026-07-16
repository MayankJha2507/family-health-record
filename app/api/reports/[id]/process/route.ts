/**
 * POST /api/reports/[id]/process — Gate 2b pipeline trigger.
 *
 * Runs the extraction pipeline on an already-uploaded report and flips it to
 * needs_review. Auth + RLS via the user's session client, so a user can only
 * process their own report. Does not write results — that happens on confirm.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processReport } from '@/lib/reports/process';

// The pipeline calls Groq/Gemini + parses a PDF; give it room (Vercel fluid compute).
export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const outcome = await processReport(id, supabase);
  return NextResponse.json(outcome, { status: outcome.status === 'failed' ? 422 : 200 });
}
