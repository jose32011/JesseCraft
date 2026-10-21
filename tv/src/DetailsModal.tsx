import { useEffect, useState } from "react";
import { fetchTitleDetails, type TitleDetails, type UpcomingItem } from "./api";

interface Props {
  item: UpcomingItem;
  onClose: () => void;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DetailsModal({ item, onClose }: Props) {
  const [details, setDetails] = useState<TitleDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTitleDetails(item.type, item.id)
      .then((d) => {
        if (!cancelled) setDetails(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load details.");
      });
    return () => {
      cancelled = true;
    };
  }, [item.type, item.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="modal-header">
          {item.posterUrl && <img src={item.posterUrl} alt="" />}
          <div>
            <span className={`badge ${item.type}`}>{item.type === "movie" ? "Movie" : "Series"}</span>
            <h2 id="modal-title">{item.title}</h2>
            <p className="date">Releases {formatDate(item.date)}</p>
            {details?.tagline && <p className="tagline">“{details.tagline}”</p>}
            <p className="meta">
              {[details?.runtimeText, details?.genres.join(", ")].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        {item.overview && <p className="modal-overview">{item.overview}</p>}

        {error && <p className="status error">{error}</p>}
        {!details && !error && <p className="status">Loading details…</p>}

        {details?.trailerUrl && (
          <div className="trailer">
            <h3>Trailer</h3>
            <iframe
              src={details.trailerUrl}
              title={`${item.title} trailer`}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {details && !details.trailerUrl && <p className="status">No trailer available yet.</p>}

        {details && details.cast.length > 0 && (
          <div className="cast">
            <h3>Cast</h3>
            <ul>
              {details.cast.map((c) => (
                <li key={`${c.name}-${c.character}`}>
                  {c.profileUrl ? <img src={c.profileUrl} alt="" loading="lazy" /> : <div className="avatar-placeholder" />}
                  <span className="cast-name">{c.name}</span>
                  {c.character && <span className="cast-role">{c.character}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
