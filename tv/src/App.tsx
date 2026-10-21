import { useEffect, useMemo, useState } from "react";
import { fetchUpcomingPrimeVideo, type MediaType, type UpcomingItem } from "./api";
import DetailsModal from "./DetailsModal";

type Filter = "all" | MediaType;

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function App() {
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<UpcomingItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUpcomingPrimeVideo()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (filter === "all" || item.type === filter) &&
        (q === "" || item.title.toLowerCase().includes(q)),
    );
  }, [items, filter, query]);

  return (
    <main className="container">
      <header>
        <h1>Coming to Prime Video</h1>
        <p className="subtitle">Upcoming movies and series on Prime Video in South Africa</p>
      </header>

      <div className="controls">
        <input
          type="search"
          placeholder="Search titles…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search titles"
        />
        <div className="filters" role="group" aria-label="Filter by type">
          {(["all", "movie", "tv"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "movie" ? "Movies" : "Series"}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="status">Loading upcoming titles…</p>}
      {error && <p className="status error">{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p className="status">No upcoming titles match your filters.</p>
      )}

      <ul className="grid">
        {visible.map((item) => (
          <li key={`${item.type}-${item.id}`}>
            <button type="button" className="card" onClick={() => setSelected(item)}>
              {item.posterUrl ? (
                <img src={item.posterUrl} alt="" loading="lazy" />
              ) : (
                <div className="poster-placeholder">No poster</div>
              )}
              <div className="card-body">
                <span className={`badge ${item.type}`}>{item.type === "movie" ? "Movie" : "Series"}</span>
                <h2>{item.title}</h2>
                <p className="date">{formatDate(item.date)}</p>
                {item.overview && <p className="overview">{item.overview}</p>}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {selected && <DetailsModal item={selected} onClose={() => setSelected(null)} />}

      <footer>
        <p>
          Release dates come from The Movie Database (TMDB) using Prime Video availability for ZA.
          Amazon does not publish a public schedule, so dates may change.
        </p>
      </footer>
    </main>
  );
}
