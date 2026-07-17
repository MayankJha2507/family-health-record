import type { Metadata } from 'next';
import './landing.css';
import { WaitlistForm } from './waitlist-form';
import { Frame, TriageMock, TrendMock, FamilyMock, SummaryMock } from './mockups';

export const metadata: Metadata = {
  title: 'Family Vitals — every blood test, one clear timeline',
  description:
    'Your lab reports are scattered across email, WhatsApp, and lab portals. Family Vitals turns every report, from any lab, into one health timeline — so you can see what changed and what to discuss with your doctor.',
};

export default function Landing() {
  return (
    <div className="landing-root">
      {/* Marketing header */}
      <header className="lp-nav">
        <a href="#top" className="lp-brand"><span className="lp-logo" aria-hidden />Family Vitals</a>
        <nav className="lp-nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#get-access" className="lp-nav-cta">Get early access</a>
        </nav>
      </header>

      {/* 1. Hero */}
      <section className="lp-hero" id="top">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow">Family Vitals</p>
          <h1>See how your health is actually changing — across every blood test.</h1>
          <p className="lp-lede">
            Your reports pile up in email, WhatsApp, and lab portals, each showing only one visit.
            Family Vitals brings them together into one timeline — so you can see what changed, spot
            what’s worth discussing, and walk into your appointment with a clear summary.
          </p>
          <div id="get-access">
            <WaitlistForm id="hero-email" />
          </div>
          <p className="lp-fineprint">Works with reports from any lab. Free while in early access.</p>
        </div>
        <div className="lp-hero-visual">
          <Frame label="your health timeline"><TrendMock seriesKey="vitaminD" /></Frame>
        </div>
      </section>

      {/* 2. The problem */}
      <section className="lp-section lp-problem">
        <h2>Your health history is scattered — and you can’t see the trend</h2>
        <div className="lp-cards">
          <div className="lp-card">
            <h3>Reports live in ten places</h3>
            <p>Email attachments, WhatsApp forwards, three different lab portals, a folder of PDFs, and a stack of paper in a drawer.</p>
          </div>
          <div className="lp-card">
            <h3>Each report shows only one visit</h3>
            <p>There’s no single view of how your cholesterol, sugar, or thyroid has moved over months and years.</p>
          </div>
          <div className="lp-card">
            <h3>The important ones get lost</h3>
            <p>When your doctor asks “how was it last time?”, you’re scrolling through your inbox at the clinic.</p>
          </div>
        </div>
      </section>

      {/* 3. How it works */}
      <section className="lp-section lp-how" id="how">
        <h2>From a pile of PDFs to one clear timeline</h2>
        <ol className="lp-steps">
          <li><span className="lp-step-n">1</span><div><h3>Upload a report</h3><p>Add a PDF from any lab — old or new.</p></div></li>
          <li><span className="lp-step-n">2</span><div><h3>We organize it</h3><p>We read the values and line them up with your past results — same test, same scale.</p></div></li>
          <li><span className="lp-step-n">3</span><div><h3>You review and confirm</h3><p>You check the numbers before anything is saved. Nothing is guessed on your behalf.</p></div></li>
          <li><span className="lp-step-n">4</span><div><h3>See your timeline</h3><p>Trends for every test, what’s changed, and a summary you can take to your doctor.</p></div></li>
        </ol>
      </section>

      {/* 4. Features */}
      <section className="lp-section lp-features" id="features">
        <div className="lp-feature">
          <div className="lp-feature-text">
            <p className="lp-eyebrow">Triage</p>
            <h2>Know what to look at first</h2>
            <p>We surface the values outside your lab’s range that are worth discussing — and stay calm about the rest. A high result that’s actually favourable won’t be dressed up as an alarm.</p>
          </div>
          <div className="lp-feature-visual"><Frame label="worth a closer look"><TriageMock /></Frame></div>
        </div>

        <div className="lp-feature reverse">
          <div className="lp-feature-text">
            <p className="lp-eyebrow">Trends</p>
            <h2>See the trend, not just the number</h2>
            <p>Every test becomes a line over time, drawn against your lab’s own normal range. You can watch something improve — or catch it drifting the wrong way — long before it’s a surprise.</p>
          </div>
          <div className="lp-feature-visual"><Frame label="biomarker trend"><TrendMock seriesKey="hba1c" /></Frame></div>
        </div>

        <div className="lp-feature">
          <div className="lp-feature-text">
            <p className="lp-eyebrow">Family</p>
            <h2>One place for the whole family</h2>
            <p>Keep a separate timeline for your parents, your kids, and yourself. See at a glance who has something worth a closer look — without digging through anyone’s inbox.</p>
          </div>
          <div className="lp-feature-visual"><Frame label="family view"><FamilyMock /></Frame></div>
        </div>

        <div className="lp-feature reverse">
          <div className="lp-feature-text">
            <p className="lp-eyebrow">Doctor summary</p>
            <h2>Walk in prepared</h2>
            <p>One clean, printable page of recent results and trends, grouped the way a doctor reads them. Save it as a PDF or print it for the appointment.</p>
          </div>
          <div className="lp-feature-visual"><Frame label="doctor-ready summary"><SummaryMock /></Frame></div>
        </div>
      </section>

      {/* 5. Trust / safety */}
      <section className="lp-section lp-trust">
        <div className="lp-trust-inner">
          <h2>We organize and flag — we don’t diagnose</h2>
          <p>
            Family Vitals highlights values outside your lab’s printed range so you can discuss them
            with your doctor. It never gives a diagnosis or medical advice — the decisions stay
            between you and your doctor. And it’s built for the whole family, from your kids to your
            parents.
          </p>
        </div>
      </section>

      {/* 6. Final CTA */}
      <section className="lp-section lp-final">
        <h2>Bring your blood tests together</h2>
        <p className="lp-lede center">Be among the first to try Family Vitals.</p>
        <WaitlistForm id="final-email" />
        <p className="lp-fineprint">No spam. Just one email when early access opens.</p>
      </section>

      <footer className="lp-foot">
        <span className="lp-brand"><span className="lp-logo" aria-hidden />Family Vitals</span>
        <span className="lp-foot-note">A personal record-keeping tool. Not a diagnostic service. The mockups on this page use fictional sample data.</span>
      </footer>
    </div>
  );
}
