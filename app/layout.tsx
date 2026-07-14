import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Family Longitudinal Health Record',
  description: 'Track family blood-test biomarkers over time. Not a diagnostic tool.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="disclaimer">
          This app does not diagnose. It organizes lab results and flags values outside
          your lab&apos;s printed range so you can <strong>discuss them with your doctor</strong>.
        </footer>
      </body>
    </html>
  );
}
