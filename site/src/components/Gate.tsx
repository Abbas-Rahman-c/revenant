import { useEffect, useRef, useState } from "react";
import { setSoundEnabled } from "../sound";

const TITLE = "Revenant";

/**
 * The title screen. Browsers only allow sound after a click, so entering is also how the lab's
 * ambience starts. The creature's build waits until the visitor is inside.
 */
export function Gate() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("is-gated");
    primary.current?.focus({ preventScroll: true });
    return () => document.documentElement.classList.remove("is-gated");
  }, []);

  function enter(withSound: boolean) {
    setSoundEnabled(withSound);
    window.dispatchEvent(new CustomEvent("lab:enter"));
    document.documentElement.classList.remove("is-gated");
    window.scrollTo(0, 0);
    setLeaving(true);
    window.setTimeout(() => setGone(true), 1100);
  }

  if (gone) return null;

  return (
    <div className={`gate${leaving ? " is-leaving" : ""}`} role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="gate__inner">
        <p className="gate__kicker">Kiroween 2026</p>
        <h1 id="gate-title" className="gate__title" aria-label={TITLE}>
          {TITLE.split(" ").map((word, w, words) => {
            // letters animate one by one, but a word never breaks across lines
            const offset = words.slice(0, w).join(" ").length + (w ? 1 : 0);
            return (
              <span key={w} className="gate__word" aria-hidden="true">
                {word.split("").map((ch, i) => (
                  <span key={i} style={{ animationDelay: `${300 + (offset + i) * 55}ms` }}>
                    {ch}
                  </span>
                ))}
              </span>
            );
          })}
        </h1>
        <p className="gate__quote">
          <span>“His yellow skin scarcely covered the work of muscles and arteries beneath.”</span>
          <span className="gate__cite">Mary Shelley, Frankenstein, 1818</span>
        </p>
        <div className="gate__actions">
          <button ref={primary} type="button" className="gate__enter" onClick={() => enter(true)}>
            Enter the lab
          </button>
          <button type="button" className="gate__silent" onClick={() => enter(false)}>
            Enter in silence
          </button>
        </div>
        <p className="gate__hint">Best with headphones. Everything runs on your device.</p>
      </div>
    </div>
  );
}
