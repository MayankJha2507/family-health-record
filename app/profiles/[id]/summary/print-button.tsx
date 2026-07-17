'use client';

/** Screen-only control to open the browser's print / Save-as-PDF dialog. */
export function PrintButton() {
  return (
    <button type="button" className="btn no-print" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
