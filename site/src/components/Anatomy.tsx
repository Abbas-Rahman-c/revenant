import { ORGANS } from "../organs";

/**
 * The anatomy chapter. The camera turns to a three-quarter view of the creature and each label
 * pins itself to the real organ in 3D (CreatureBody positions them every frame).
 */
export function Anatomy() {
  return (
    <section className="anatomy" aria-labelledby="anatomy-h">
      <div className="panel section-head">
        <h2 id="anatomy-h">Five technologies that were never meant to share a body</h2>
        <p>
          Each part runs on a different piece of the web platform. On their own they are parts on a shelf. Stitched
          together, they become something that can see you, hear you and answer back.
        </p>
        <ol className="anatomy__list">
          {ORGANS.map((o) => (
            <li key={o.id}>
              <span className="anatomy__name">{o.name}</span>
              <span className="anatomy__tech">
                {o.does}. {o.model}, built on {o.tech}.
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="pins" aria-hidden="true">
        {ORGANS.map((o) => (
          <div key={o.id} className="pin" data-anchor={o.id}>
            <span className="pin__dot" />
            <span className="pin__label">
              <span className="pin__name">{o.name}</span>
              <span className="pin__tech">{o.tech}</span>
            </span>
          </div>
        ))}
        <div className="pin" data-anchor="heart">
          <span className="pin__dot" />
          <span className="pin__label">
            <span className="pin__name">Heart</span>
            <span className="pin__tech">Keeps the current moving</span>
          </span>
        </div>
      </div>
    </section>
  );
}
