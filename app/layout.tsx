import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Family Vitals',
  description: "Your family's blood-test results, organized over time. Not a diagnostic tool.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <header className="appbar">
          <a href="/" className="wordmark">
            <span className="logo-dot" aria-hidden />
            Family&nbsp;Vitals
          </a>
        </header>
        {children}
        <footer className="disclaimer">
          Family Vitals does not diagnose. It organizes lab results and flags values outside
          your lab&apos;s printed range so you can <strong>discuss them with your doctor</strong>.
        </footer>
      </body>
    </html>
  );
}
