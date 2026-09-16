import { DOCUMENTARY_READING, DOCUMENTARY_SOURCES } from "./documentaryReels";
import { DOCUMENTARY_PHOTOS } from "./documentaryPhotos";

/** The same source trail in the initial HTML and the interactive page. */
export function DocumentarySources() {
  return (
    <section
      id="documentary-stories"
      className="rule-major py-6 scroll-mt-6"
      aria-label="Australian property documentary sources"
    >
      <p className="text-xs uppercase tracking-widest">The Deal / Property Empires</p>
      <h2 className="font-serif text-3xl mt-2">
        The people and decisions behind Australian property.
      </h2>
      <p className="mt-3 text-sm leading-6">
        Historical stories with sources you can read for free. Company accounts and personal
        recollections are identified; The Desk's interpretation is labelled in the Reel.
      </p>
      {DOCUMENTARY_READING.map((episode) => (
        <article
          key={episode.id}
          id={episode.id}
          className="border-t border-[var(--color-border)] mt-6 pt-5 scroll-mt-6"
        >
          <p className="text-xs uppercase tracking-widest">{episode.series}</p>
          <h3 className="font-serif text-2xl mt-2">{episode.title}</h3>
          <p className="mt-3 text-sm leading-6">{episode.meaning}</p>
          <p className="mt-2 text-sm leading-6">{episode.limitation}</p>
          <ul className="mt-4 space-y-4">
            {episode.sources.map((id) => {
              const source = DOCUMENTARY_SOURCES[id];
              return (
                <li key={id} className="text-sm leading-6">
                  <a
                    href={source.url}
                    className="bs-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.title}
                  </a>
                  <p>
                    {source.publisher} · {source.published}
                  </p>
                  <p>{source.context}</p>
                </li>
              );
            })}
          </ul>
        </article>
      ))}
      <details className="border-t border-[var(--color-border)] mt-6 pt-5">
        <summary className="cursor-pointer font-serif text-xl">
          Archive photographs and credits
        </summary>
        <p className="mt-3 text-sm leading-6">
          These are animated still photographs. Each image shows its stated date, not footage of the
          historical event being narrated.
        </p>
        <ul className="mt-4 space-y-5">
          <li className="text-sm leading-6">
            The adapted photographic sequences in the Grollo family, Frank Lowy and Lang Walker
            films are available under{" "}
            <a className="bs-link" href="https://creativecommons.org/licenses/by-sa/4.0/">
              CC BY-SA 4.0
            </a>
            . Individual photographs retain the licences below. Adaptations include cropping,
            reframing, motion, colour treatment and overlaid titles.
          </li>
          {Object.values(DOCUMENTARY_PHOTOS).map((photo) => (
            <li key={photo.asset} className="text-sm leading-6">
              <a href={photo.source} className="bs-link" target="_blank" rel="noopener noreferrer">
                {photo.credit}
              </a>
              <p>{photo.purpose}</p>
              <p>{photo.changes}</p>
              {"archive" in photo && (
                <p>
                  <a
                    href={photo.archive}
                    className="bs-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Kyoto University Library archive
                  </a>
                </p>
              )}
              <a href={photo.licence} className="bs-link" target="_blank" rel="noopener noreferrer">
                Licence and reuse terms
              </a>
            </li>
          ))}
          <li className="text-sm leading-6">
            The Grollo films also use an{" "}
            <a
              className="bs-link"
              href="https://www.pexels.com/video/australian-money-855198/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Australian-money illustration by Pixabay via Pexels
            </a>
            . This does not depict the family's finances.{" "}
            <a
              className="bs-link"
              href="https://www.pexels.com/license/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Pexels licence
            </a>
            .
          </li>
        </ul>
      </details>
    </section>
  );
}
