import { useState } from "react";
import { Anatomy } from "./components/Anatomy";
import { Lab } from "./components/Lab";
import { VitalSigns } from "./components/VitalSigns";
import { setSoundEnabled } from "./sound";

const REPO = "https://github.com/Abbas-Rahman-c/summoning-circle";

function SoundToggle() {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      className="sound"
      aria-pressed={on}
      onClick={() => {
        setSoundEnabled(!on);
        setOn(!on);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" />
        <path d="M16.5 8.5c1.6 1.8 1.6 5.2 0 7" className={on ? "" : "is-hidden"} />
        <path d="M16 9l5 6M21 9l-5 6" className={on ? "is-hidden" : ""} />
      </svg>
      {on ? "Sound on" : "Sound off"}
    </button>
  );
}

function HowItWorks() {
  return (
    <section className="how" aria-labelledby="how-h">
      <div className="section-head">
        <h2 id="how-h">How the lab works</h2>
      </div>
      <div className="how__rows">
        <article>
          <h3>The bench</h3>
          <p>
            A small library that does the surgery. One call, <code>summon("brain")</code>, checks what your device can
            handle, downloads a model that fits, keeps it for offline use and runs it in the background so the page
            never freezes. If a part fails, it swaps in a lighter one.
          </p>
        </article>
        <article>
          <h3>The notebook</h3>
          <p>
            Lab notes for Kiro, the coding agent: rules, hooks and a helper server that hold the real model names and
            APIs, so it stops inventing ones that don't exist. Anyone can install them and build their own creature.
          </p>
        </article>
        <article>
          <h3>The creature</h3>
          <p>
            The app you just played with, finished: point your camera at it and it sees you, talk and it listens,
            and it remembers you next time. All of it runs inside this tab.
          </p>
        </article>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to the lab
      </a>
      <header className="top">
        <a className="wordmark" href="#main">
          Summoning Circle
        </a>
        <nav className="top__nav" aria-label="Site">
          <SoundToggle />
          <a href={REPO}>Source on GitHub</a>
        </nav>
      </header>
      <main id="main">
        <Lab />
        <Anatomy />
        <VitalSigns />
        <HowItWorks />
      </main>
      <footer className="end">
        <p className="end__card">The End?</p>
        <p className="end__credits">
          Made for Kiroween 2026 by Abbas Rahman and Sunaina Babar. Open source under the <a href={REPO}>MIT license</a>.
        </p>
      </footer>
    </>
  );
}
