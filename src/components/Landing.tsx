"use client";
/**
 * Sign-in page. The trail from the logo becomes a short, playable walk through the four
 * steps. It plays once, can be paused, and stays still for people who reduce motion.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Flag } from "./CountrySearch";
import { Button, cn } from "./ui";

const QUESTION = "I am a computer science student. Should I take an internship?";
const STEP_MS = 4600;

const STEPS = [
  { title: "Ask", text: "Describe your decision in plain language." },
  { title: "See evidence", text: "Studies and real answers, with the country when it is stated." },
  { title: "Decide", text: "Save your choice, your reasons and a review date." },
  { title: "Review", text: "Record what happened, so the next decision starts smarter." },
];

// The logo's shape: a small start, bigger stops, and an amber goal.
const NODES = [
  [34, 112],
  [146, 86],
  [256, 60],
  [366, 30],
] as const;
const DOTS = NODES.slice(0, -1).flatMap(([x, y], seg) => {
  const [x2, y2] = NODES[seg + 1];
  return [0.28, 0.5, 0.72].map((t) => ({ x: x + (x2 - x) * t, y: y + (y2 - y) * t, seg }));
});

const stillPreferred = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Landing({ logo, toggle, footer, onSignIn }: { logo: ReactNode; toggle: ReactNode; footer: ReactNode; onSignIn: () => void }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        {logo}
        {toggle}
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="space-y-5">
          <h1 className="enter text-3xl font-semibold text-ink sm:text-4xl">
            Before you decide, see what happened to <span className="trail-underline">others</span>
          </h1>
          <p className="enter text-base text-muted" style={{ animationDelay: "90ms" }}>
            DecisionTrail finds published evidence for the choice you face, saves your reasons, and reminds you to check how it turned out. It never decides for you.
          </p>
          <div className="enter" style={{ animationDelay: "180ms" }}>
            <Button className="px-5 py-3 text-base" onClick={onSignIn}>
              Sign in with Google
            </Button>
          </div>
          <dl className="enter space-y-1 border-l-2 border-brand pl-4 text-sm" style={{ animationDelay: "270ms" }}>
            <div>
              <dt className="inline font-semibold text-ink">Real sources: </dt>
              <dd className="inline text-muted">OpenAlex, Stack Exchange, Hacker News and Wikipedia.</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-ink">Your country: </dt>
              <dd className="inline text-muted">search the world, or choose up to three countries.</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-ink">Your privacy: </dt>
              <dd className="inline text-muted">in Private mode, AI runs only on your device.</dd>
            </div>
          </dl>
        </div>
        <Walkthrough />
      </main>
      {footer}
    </div>
  );
}

function Walkthrough() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const last = step === STEPS.length - 1;

  useEffect(() => {
    if (!playing || last) return;
    const t = setTimeout(() => {
      if (stillPreferred()) setPlaying(false);
      else setStep(step + 1);
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [playing, last, step]);

  function choose(i: number) {
    setPlaying(false);
    setStep(i);
  }

  return (
    <section aria-labelledby="how" className="enter overflow-hidden rounded-lg border border-line bg-[#0f2a3d] text-white" style={{ animationDelay: "200ms" }}>
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <h2 id="how" className="text-lg font-semibold">
          How it works
        </h2>
        <button
          type="button"
          onClick={() => {
            if (last) setStep(0);
            setPlaying(last || !playing);
          }}
          className="rounded-lg border border-white/30 px-3 py-1.5 text-sm font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {last ? "Play again" : playing ? "Pause" : "Play"}
        </button>
      </div>

      <svg viewBox="0 0 400 136" className="w-full px-2" aria-hidden>
        {DOTS.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="3.4" className="trail-dot" fill="#fff" opacity={d.seg < step ? 1 : 0.22} style={{ transitionDelay: d.seg === step - 1 ? `${(i % 3) * 140}ms` : "0ms" }} />
        ))}
        {NODES.map(([x, y], i) => {
          const goal = i === NODES.length - 1;
          const on = i <= step;
          return (
            <g key={i}>
              {i === step && <circle key={step} cx={x} cy={y} r="16" className="trail-ping" fill="none" stroke="#f49e0b" strokeWidth="2" />}
              <circle cx={x} cy={y} r={goal ? 16 : 12} fill="#0f2a3d" stroke={goal || i === step ? "#f49e0b" : "#fff"} strokeWidth="3.5" opacity={on ? 1 : 0.4} className="trail-dot" />
              <circle cx={x} cy={y} r={goal ? 9 : 5} fill={goal || i === step ? "#f49e0b" : "#fff"} opacity={on ? 1 : 0.22} className="trail-dot" />
            </g>
          );
        })}
      </svg>

      <div role="tablist" aria-label="Steps" className="grid grid-cols-4 border-y border-white/15">
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            id={`step-${i}`}
            aria-selected={i === step}
            aria-controls="step-panel"
            onClick={() => choose(i)}
            className={cn(
              "border-b-2 px-1 py-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white sm:text-sm",
              i === step ? "border-[#f49e0b] text-white" : "border-transparent text-white/70 hover:text-white",
            )}
          >
            <span className="block text-[#8fd3df]">{i + 1}</span>
            {s.title}
          </button>
        ))}
      </div>

      <div id="step-panel" role="tabpanel" aria-labelledby={`step-${step}`} className="min-h-72 space-y-4 p-5 sm:min-h-64">
        <div key={step} className="step-in space-y-4">
          <p className="text-sm text-white/85">{STEPS[step].text}</p>
          <div className="rounded-lg border border-line bg-subtle p-4 text-sm text-ink">{step === 0 ? <AskDemo /> : step === 1 ? <EvidenceDemo /> : step === 2 ? <DecideDemo /> : <ReviewDemo />}</div>
        </div>
        <p className="text-xs text-white/60">Example only. Your own results will differ.</p>
      </div>
    </section>
  );
}

function AskDemo() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (stillPreferred() ? QUESTION.length : Math.min(QUESTION.length, x + 1))), 38);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="space-y-3">
      <div className="min-h-16 rounded-lg border border-line bg-surface p-3">
        <span className="sr-only">{QUESTION}</span>
        <span aria-hidden>
          {QUESTION.slice(0, n)}
          <span className="caret" />
        </span>
      </div>
      <div className="flex items-center gap-2 text-muted">
        <span className="rounded border border-line px-2 py-1 font-semibold text-ink">World</span> or
        <span className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-1 font-semibold text-ink">
          <Flag code="de" /> Germany
        </span>
      </div>
    </div>
  );
}

function EvidenceDemo() {
  return (
    <div className="space-y-2">
      <p className="step-in font-semibold">Do Internships Pay Off? The Effects of Student Internships on Earnings</p>
      <p className="step-in flex flex-wrap items-center gap-2" style={{ animationDelay: "250ms" }}>
        <Flag code="de" /> <span className="font-semibold">Germany</span> <span className="text-xs text-muted">mentioned in the text, not ensured</span>
      </p>
      <p className="step-in text-muted" style={{ animationDelay: "550ms" }}>
        <strong className="text-ink">Question: </strong>the effect of student internships on earnings later in life.
      </p>
      <p className="step-in text-muted" style={{ animationDelay: "950ms" }}>
        <strong className="text-ink">Answer: </strong>the study reported earnings returns of about 6 percent.
      </p>
    </div>
  );
}

function DecideDemo() {
  return (
    <div className="space-y-2">
      <p className="step-in flex items-center gap-2">
        <span aria-hidden className="pick inline-block h-4 w-4 rounded-full border-2 border-brand" /> <span className="font-semibold">Take the internship</span>
      </p>
      <p className="flex items-center gap-2 text-muted">
        <span aria-hidden className="inline-block h-4 w-4 rounded-full border-2 border-line" /> Not this summer
      </p>
      <p className="step-in border-t border-line pt-2 text-muted" style={{ animationDelay: "600ms" }}>
        <strong className="text-ink">Why: </strong>I want real work experience before I choose a specialisation.
      </p>
      <p className="step-in text-muted" style={{ animationDelay: "1000ms" }}>
        <strong className="text-ink">Review: </strong>in 90 days
      </p>
    </div>
  );
}

function ReviewDemo() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="step-in">
        <p className="font-semibold">You expected</p>
        <p className="text-muted">I will know which field I prefer.</p>
      </div>
      <div className="step-in" style={{ animationDelay: "500ms" }}>
        <p className="font-semibold">What happened</p>
        <p className="text-muted">I finished a project and prefer backend work.</p>
      </div>
      <p className="step-in border-t border-line pt-2 text-muted sm:col-span-2" style={{ animationDelay: "1000ms" }}>
        <strong className="text-ink">Lesson: </strong>ask who will mentor you before you accept.
      </p>
    </div>
  );
}
