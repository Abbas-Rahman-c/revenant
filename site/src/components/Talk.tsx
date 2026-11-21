import { useEffect, useRef, useState, type FormEvent } from "react";
import { startRecording, type Mind } from "../mind";

type Turn = { who: "you" | "it"; text: string };

/** Talk to the creature: hold the mic button (when it has ears) or type. */
export function Talk({
  mind,
  onLine,
  onSpeaking,
}: {
  mind: Mind;
  onLine: (text: string) => void;
  onSpeaking: (on: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"ready" | "listening" | "hearing" | "thinking">("ready");
  const [log, setLog] = useState<Turn[]>([]);
  const [note, setNote] = useState("");
  const stopRef = useRef<(() => Promise<Float32Array>) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [log]);

  async function send(said: string) {
    const t = said.trim();
    if (!t || state === "thinking") return;
    setNote("");
    setLog((l) => [...l, { who: "you", text: t }]);
    setState("thinking");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const reply = await mind.reply(t, { signal: ac.signal, onToken: onLine, onSpeaking });
      setLog((l) => [...l, { who: "it", text: reply || "…" }]);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "ABORTED") setNote("Its thoughts scattered. Try again.");
    } finally {
      setState("ready");
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text;
    setText("");
    void send(t);
  }

  async function micDown() {
    if (state !== "ready" || !mind.canHear) return;
    try {
      stopRef.current = await startRecording();
      setState("listening");
    } catch {
      setNote("No microphone, or permission was denied. Type to it instead.");
    }
  }

  async function micUp() {
    const stop = stopRef.current;
    stopRef.current = null;
    if (!stop) return;
    setState("hearing");
    try {
      const samples = await stop();
      const heard = await mind.handles.ears!.transcribe(samples);
      setState("ready");
      if (heard) void send(heard);
      else setNote("It heard only silence. Hold the button while you speak.");
    } catch {
      setState("ready");
      setNote("It couldn't make out the words. Try again, or type.");
    }
  }

  const busy = state !== "ready" && state !== "listening";
  return (
    <div className="talk">
      {log.length > 0 && (
        <ol className="talk__log" ref={logRef} aria-label="Conversation">
          {log.map((t, i) => (
            <li key={i} className={`talk__turn talk__turn--${t.who}`}>
              <span className="talk__who">{t.who === "you" ? "You" : "It"}</span> {t.text}
            </li>
          ))}
        </ol>
      )}
      <form className="talk__form" onSubmit={submit}>
        {mind.canHear && (
          <button
            type="button"
            className={`talk__mic${state === "listening" ? " is-on" : ""}`}
            aria-label="Hold to talk"
            aria-pressed={state === "listening"}
            disabled={busy}
            onPointerDown={micDown}
            onPointerUp={micUp}
            onPointerLeave={() => state === "listening" && micUp()}
            onKeyDown={(e) => (e.key === " " || e.key === "Enter") && !e.repeat && micDown()}
            onKeyUp={(e) => (e.key === " " || e.key === "Enter") && micUp()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
            </svg>
          </button>
        )}
        <input
          className="talk__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mind.canHear ? "Hold the mic, or type to it…" : "Type to it…"}
          aria-label="Say something to the creature"
          disabled={busy}
          maxLength={300}
        />
        <button type="submit" className="btn-quiet" disabled={busy || !text.trim()}>
          Say
        </button>
      </form>
      <p className="talk__status" aria-live="polite">
        {note ||
          { ready: "", listening: "Listening… let go when you're done.", hearing: "Hearing you…", thinking: "Thinking…" }[state]}
      </p>
    </div>
  );
}
