import type { Metadata } from 'next';
import Link from 'next/link';
import './landing.css';
import { Frame, TriageMock, TrendMock, FamilyMock, SummaryMock } from './mockups';

export const metadata: Metadata = {
  title: 'Family Vitals — every blood test, one clear timeline',
  description:
    'Your lab reports are scattered across email, WhatsApp, and lab portals. Family Vitals turns every report, from any lab, into one health timeline — so you can see what changed and what to discuss with your doctor.',
};

/** Reusable pairing of benefit copy with an anchored product mockup. */
function Feature(props: { eyebrow: string; title: string; body: string; visual: React.ReactNode; frameLabel: string; reverse?: boolean; tint?: boolean }) {
  return (
    <section className={`lp-band${props.tint ? ' tint' : ''}`}>
      <div className={`lp-container lp-feature${props.reverse ? ' reverse' : ''}`}>
        <div className="lp-feature-text">
          <p className="lp-eyebrow">{props.eyebrow}</p>
          <h2 className="lp-h2">{props.title}</h2>
          <p className="lp-feature-body">{props.body}</p>
        </div>
        <div className="lp-feature-visual"><Frame label={props.frameLabel}>{props.visual}</Frame></div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="landing-root">
      {/* Nav */}
      <header className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <a href="#top" className="lp-brand"><span className="lp-logo" aria-hidden />Family Vitals</a>
          <nav className="lp-nav-links">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <Link href="/" className="btn lp-nav-cta">Get started</Link>
          </nav>
        </div>
      </header>

      {/* 1. Hero */}
      <section className="lp-band lp-hero" id="top">
        <div className="lp-container lp-hero-grid">
          <div className="lp-hero-copy">
            <h1>See how your health is actually changing — across every blood test.</h1>
            <p className="lp-lede">
              Your reports pile up in email, WhatsApp, and lab portals, each showing only one visit.
              Family Vitals brings them together into one timeline — so you can see what changed, spot
              what’s worth discussing, and walk into your appointment with a clear summary.
            </p>
            <div className="lp-cta-row">
              <Link href="/" className="btn btn-lg">Get started</Link>
            </div>
            <p className="lp-fineprint">Works with reports from any lab. Free while in early access.</p>
          </div>
          <div className="lp-hero-visual"><Frame label="your health timeline"><TrendMock seriesKey="vitaminD" /></Frame></div>
        </div>
      </section>

      {/* 2. The problem */}
      <section className="lp-band tint">
        <div className="lp-container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Your health history is scattered — and you can’t see the trend</h2>
          </div>
          <div className="lp-cards">
            <div className="lp-card"><h3>Reports live in ten places</h3><p>Email attachments, WhatsApp forwards, three different lab portals, a folder of PDFs, and a stack of paper in a drawer.</p></div>
            <div className="lp-card"><h3>Each report shows only one visit</h3><p>There’s no single view of how your cholesterol, sugar, or thyroid has moved over months and years.</p></div>
            <div className="lp-card"><h3>The important ones get lost</h3><p>When your doctor asks “how was it last time?”, you’re scrolling through your inbox at the clinic.</p></div>
          </div>
        </div>
      </section>

      {/* 3. How it works */}
      <section className="lp-band" id="how">
        <div className="lp-container">
          <div className="lp-section-head"><h2 className="lp-h2">From a pile of PDFs to one clear timeline</h2></div>
          <ol className="lp-steps">
            <li><span className="lp-step-n">1</span><div><h3>Upload a report</h3><p>Add a PDF from any lab — old or new.</p></div></li>
            <li><span className="lp-step-n">2</span><div><h3>We organize it</h3><p>We read the values and line them up with your past results — same test, same scale.</p></div></li>
            <li><span className="lp-step-n">3</span><div><h3>You review and confirm</h3><p>You check the numbers before anything is saved. Nothing is guessed on your behalf.</p></div></li>
            <li><span className="lp-step-n">4</span><div><h3>See your timeline</h3><p>Trends for every test, what’s changed, and a summary you can take to your doctor.</p></div></li>
          </ol>
        </div>
      </section>

      {/* 4. Features — alternating banded rows */}
      <div id="features">
        <Feature tint reverse={false} eyebrow="Triage" title="Know what to look at first"
          body="We surface the values outside your lab’s range that are worth discussing — and stay calm about the rest. A high result that’s actually favourable won’t be dressed up as an alarm."
          frameLabel="worth a closer look" visual={<TriageMock />} />
        <Feature reverse eyebrow="Trends" title="See the trend, not just the number"
          body="Every test becomes a line over time, drawn against your lab’s own normal range. You can watch something improve — or catch it drifting the wrong way — long before it’s a surprise."
          frameLabel="biomarker trend" visual={<TrendMock seriesKey="hba1c" />} />
        <Feature tint eyebrow="Family" title="One place for the whole family"
          body="Keep a separate timeline for your parents, your kids, and yourself. See at a glance who has something worth a closer look — without digging through anyone’s inbox."
          frameLabel="family view" visual={<FamilyMock />} />
        <Feature reverse eyebrow="Doctor summary" title="Walk in prepared"
          body="One clean, printable page of recent results and trends, grouped the way a doctor reads them. Save it as a PDF or print it for the appointment."
          frameLabel="doctor-ready summary" visual={<SummaryMock />} />
      </div>

      {/* 5. Trust / safety / compatibility */}
      <section className="lp-band tint" id="trust">
        <div className="lp-container">
          <div className="lp-trust-grid">
            <div className="lp-trust-main">
              <h2 className="lp-h2">We organize and flag — we don’t diagnose</h2>
              <p>
                Family Vitals highlights values outside your lab’s printed range so you can discuss them
                with your doctor. It never gives a diagnosis or medical advice — the decisions stay
                between you and your doctor. And it’s built for the whole family, from your kids to your
                parents.
              </p>
            </div>
            <div className="lp-trust-cards">
              <div className="lp-card">
                <h3>Will it work with my lab?</h3>
                <p>Yes — if your lab gives you a PDF report, it works. No integrations or logins needed.</p>
                <ul className="lp-lab-chips">
                  <li>Dr Lal PathLabs</li>
                  <li>Thyrocare</li>
                  <li>SRL Diagnostics</li>
                  <li>Metropolis</li>
                  <li>+ any other lab</li>
                </ul>
              </div>
              <div className="lp-card">
                <h3>Is my data safe?</h3>
                <p>Your reports are private to your family — encrypted in transit and at rest, never shared, and you can delete them at any time.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Final CTA */}
      <section className="lp-band lp-final">
        <div className="lp-container">
          <h2 className="lp-h2">Bring your blood tests together</h2>
          <p className="lp-lede center">Start your family’s health timeline today.</p>
          <div className="lp-cta-row center"><Link href="/" className="btn btn-lg">Get started</Link></div>
        </div>
      </section>

      <footer className="lp-band lp-foot">
        <div className="lp-container lp-foot-inner">
          <span className="lp-brand"><span className="lp-logo" aria-hidden />Family Vitals</span>
          <span className="lp-foot-note">A personal record-keeping tool. Not a diagnostic service. The mockups on this page use fictional sample data.</span>
        </div>
      </footer>
    </div>
  );
}
