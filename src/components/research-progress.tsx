import type { ProgressEvent } from "@/contract/events";
import type { ResearchMode } from "@/contract/research";

type ResearchProgressProps = {
  events: ProgressEvent[];
  error?: string | null;
  mode: ResearchMode;
  onCancel: () => void;
};

function eventTone(event: ProgressEvent) {
  if (event.type === "warning") return "warning";
  if (event.type === "phase_started") return "phase";
  if (event.type === "run_failed") return "failed";
  if (event.type === "run_completed") return "complete";
  return "normal";
}

export function ResearchProgress({ events, error, mode, onCancel }: ResearchProgressProps) {
  const latest = events.at(-1);
  const progress = Math.min(94, Math.max(6, events.length * 6));

  return (
    <section className="research-shell" aria-live="polite">
      <div className="research-stage">
        <div className="orbit" aria-hidden="true"><span /><i /></div>
        <p className="eyebrow">Evidence research · {mode === "live" ? "live web" : "fixture replay"}</p>
        <h2>{latest?.label ?? "Preparing the research run…"}</h2>
        <p className="research-explainer">
          Offers are standardized first. Only the strongest candidates go deeper into
          seller policies, delivery, payment and review evidence.
        </p>
        <div className="progress-track" aria-label={`Research progress ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        {error ? <p className="research-error" role="alert">{error}</p> : null}
        <button className="text-button" type="button" onClick={onCancel}>Stop and return to brief</button>
      </div>

      <div className="event-feed">
        <div className="event-feed-heading">
          <span>Live research log</span>
          <strong>{events.length} events</strong>
        </div>
        <ol>
          {events.length === 0 ? (
            <li className="event-row event-pending"><b /><span>Opening research stream…</span></li>
          ) : events.map((event, index) => event.type === "phase_started" ? (
            <li className="event-row event-phase" key={`${event.type}-${event.at}-${index}`}>
              <b />
              <div>
                <small>Round {event.round} · {event.phase}</small>
                <strong>{event.label}</strong>
              </div>
            </li>
          ) : (
            <li className={`event-row event-${eventTone(event)}`} key={`${event.type}-${event.at}-${index}`}>
              <b />
              <div>
                <span>{event.label}</span>
                <small>{new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
