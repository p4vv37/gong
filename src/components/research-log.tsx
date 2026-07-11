import type { ProgressEvent } from "@/contract/events";
import type { RecommendationSet } from "@/contract/http";

type ResearchLogProps = {
  events: ProgressEvent[];
  result: RecommendationSet;
  onBack: () => void;
};

function eventDetails(event: ProgressEvent) {
  return Object.entries(event)
    .filter(([key]) => !["type", "runId", "at", "label", "result"].includes(key))
    .map(([key, value]) => ({ key, value: Array.isArray(value) ? value.join(", ") : String(value) }));
}

export function ResearchLog({ events, result, onBack }: ResearchLogProps) {
  return (
    <section className="research-log-shell">
      <div className="artifact-nav">
        <button className="text-button" type="button" onClick={onBack}>← Back to results</button>
        <span>Run {result.runId}</span>
      </div>
      <div className="research-log-heading">
        <div><p className="eyebrow">Research audit</p><h2>How we got here.</h2></div>
        <p>{events.length} retained progress events · {result.roundsCompleted} rounds · generated {new Date(result.generatedAt).toLocaleString()}</p>
      </div>
      <ol className="research-log-list">
        {events.map((event, index) => {
          const details = eventDetails(event);
          return (
            <li className={`research-log-entry log-${event.type}`} key={`${event.type}-${event.at}-${index}`}>
              <div className="log-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="log-event">
                <div><span>{event.type.replaceAll("_", " ")}</span><time>{new Date(event.at).toLocaleTimeString()}</time></div>
                <h3>{event.label}</h3>
                {details.length ? <dl>{details.map((detail) => <div key={detail.key}><dt>{detail.key}</dt><dd>{detail.value}</dd></div>)}</dl> : null}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="log-audit-note">Raw external-call durations and cache hit/miss details will appear here when the backend audit endpoint lands.</p>
    </section>
  );
}
