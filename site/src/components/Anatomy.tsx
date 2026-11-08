import { Creature } from "./Creature";
import { ORGANS, type OrganId } from "../organs";

const ALL = new Set<OrganId>(ORGANS.map((o) => o.id));

/** An old medical plate: the full creature with numbered figure marks, and notes keyed to them. */
export function Anatomy() {
  return (
    <section className="anatomy" aria-labelledby="anatomy-h">
      <div className="section-head">
        <h2 id="anatomy-h">Five technologies that were never meant to share a body</h2>
        <p>
          Each part runs on a different piece of the web platform. On their own they are parts on a shelf. Stitched
          together, they become something that can see you, hear you and answer back.
        </p>
      </div>
      <div className="plate">
        <p className="plate__title">Plate I. The assembled subject</p>
        <div className="plate__figure">
          <Creature parts={ALL} alive={false} charging={false} />
          <svg className="plate__marks" viewBox="0 0 320 520" aria-hidden="true">
            {ORGANS.map((o, i) => {
              const side = o.socket.x < 160 || (o.socket.x === 160 && i % 2 === 1) ? -1 : 1;
              const end = side < 0 ? 8 : 312;
              const y = o.socket.y + (o.id === "eyes" ? -24 : 0);
              const x = o.socket.x + (o.id === "eyes" ? 0 : side * 30);
              return (
                <g key={o.id}>
                  <path d={`M${x} ${y}H${end}`} className="plate__leader" />
                  <circle cx={end} cy={y} r="9" className="plate__mark" />
                  <text x={end} y={y + 3.5} textAnchor="middle" className="plate__num">
                    {i + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <ol className="plate__notes">
          {ORGANS.map((o, i) => (
            <li key={o.id}>
              <span className="plate__fig">Fig. {i + 1}</span>
              <span className="plate__name">{o.name}</span>
              <span className="plate__does">{o.does}.</span>
              <span className="plate__tech">
                {o.model}, built on {o.tech}.
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
