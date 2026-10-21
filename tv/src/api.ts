export type MediaType = "movie" | "tv";

export interface UpcomingItem {
  id: number;
  type: MediaType;
  title: string;
  date: string; // YYYY-MM-DD
  overview: string;
  posterUrl: string | null;
}

const API_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

// TMDB watch provider ID for Amazon Prime Video in South Africa (ZA).
// The ID differs by region (it is 9 in the US); look it up with /watch/providers/{type}?watch_region=ZA.
export const PRIME_VIDEO_PROVIDER_ID = 119;
// ISO 3166-1 region code for South Africa.
export const REGION = "ZA";

interface TmdbMovie {
  id: number;
  title: string;
  release_date: string;
  overview: string;
  poster_path: string | null;
}

interface TmdbTv {
  id: number;
  name: string;
  first_air_date: string;
  overview: string;
  poster_path: string | null;
}

interface TmdbPage<T> {
  results: T[];
  total_pages: number;
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getApiKey(): string {
  const key = import.meta.env.VITE_TMDB_API_KEY;
  if (!key) {
    throw new Error("Missing VITE_TMDB_API_KEY. Copy .env.example to .env and add your TMDB key.");
  }
  return key;
}

async function fetchDiscover<T>(
  path: "movie" | "tv",
  dateField: "primary_release_date" | "first_air_date",
  page: number,
): Promise<TmdbPage<T>> {
  const params = new URLSearchParams({
    api_key: getApiKey(),
    with_watch_providers: String(PRIME_VIDEO_PROVIDER_ID),
    watch_region: REGION,
    region: REGION,
    [`${dateField}.gte`]: todayIso(),
    sort_by: `${dateField}.asc`,
    include_adult: "false",
    language: "en-US",
    page: String(page),
  });
  const res = await fetch(`${API_BASE}/discover/${path}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`TMDB request failed (${res.status})`);
  }
  return (await res.json()) as TmdbPage<T>;
}

export interface CastMember {
  name: string;
  character: string;
  profileUrl: string | null;
}

export interface TitleDetails {
  tagline: string;
  runtimeText: string | null;
  genres: string[];
  cast: CastMember[];
  trailerUrl: string | null;
}

interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
}

interface TmdbCredits {
  cast: { name: string; character: string; profile_path: string | null; order: number }[];
}

interface TmdbDetail {
  tagline: string;
  runtime?: number;
  episode_run_time?: number[];
  genres: { name: string }[];
  credits?: TmdbCredits;
  videos?: { results: TmdbVideo[] };
}

const PROFILE_BASE = "https://image.tmdb.org/t/p/w185";

/** Fetches cast, trailer and extra metadata for a single movie or series. */
export async function fetchTitleDetails(type: MediaType, id: number): Promise<TitleDetails> {
  const params = new URLSearchParams({
    api_key: getApiKey(),
    append_to_response: "credits,videos",
    language: "en-US",
  });
  const res = await fetch(`${API_BASE}/${type}/${id}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`TMDB request failed (${res.status})`);
  }
  const data = (await res.json()) as TmdbDetail;

  const cast = (data.credits?.cast ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(0, 12)
    .map((c) => ({
      name: c.name,
      character: c.character,
      profileUrl: c.profile_path ? `${PROFILE_BASE}${c.profile_path}` : null,
    }));

  // Prefer an official YouTube trailer, then any YouTube trailer or teaser.
  const videos = (data.videos?.results ?? []).filter((v) => v.site === "YouTube");
  const trailer =
    videos.find((v) => v.type === "Trailer" && v.official) ??
    videos.find((v) => v.type === "Trailer") ??
    videos.find((v) => v.type === "Teaser");

  const runtime = data.runtime ?? data.episode_run_time?.[0];

  return {
    tagline: data.tagline ?? "",
    runtimeText: runtime ? `${runtime} min` : null,
    genres: data.genres.map((g) => g.name),
    cast,
    trailerUrl: trailer ? `https://www.youtube-nocookie.com/embed/${trailer.key}` : null,
  };
}

/** Fetches upcoming Prime Video movies and series in South Africa, sorted by date. */
export async function fetchUpcomingPrimeVideo(pages = 3): Promise<UpcomingItem[]> {
  const moviePages = Array.from({ length: pages }, (_, i) =>
    fetchDiscover<TmdbMovie>("movie", "primary_release_date", i + 1),
  );
  const tvPages = Array.from({ length: pages }, (_, i) =>
    fetchDiscover<TmdbTv>("tv", "first_air_date", i + 1),
  );

  const [movies, shows] = await Promise.all([Promise.all(moviePages), Promise.all(tvPages)]);

  const items: UpcomingItem[] = [
    ...movies.flatMap((p) =>
      p.results
        .filter((m) => m.release_date)
        .map((m) => ({
          id: m.id,
          type: "movie" as const,
          title: m.title,
          date: m.release_date,
          overview: m.overview,
          posterUrl: m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : null,
        })),
    ),
    ...shows.flatMap((p) =>
      p.results
        .filter((s) => s.first_air_date)
        .map((s) => ({
          id: s.id,
          type: "tv" as const,
          title: s.name,
          date: s.first_air_date,
          overview: s.overview,
          posterUrl: s.poster_path ? `${IMAGE_BASE}${s.poster_path}` : null,
        })),
    ),
  ];

  items.sort((a, b) => a.date.localeCompare(b.date));
  return items;
}
