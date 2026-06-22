/**
 * Fetches exercise GIF URLs from ExerciseDB OSS (no API key required).
 * Results are cached in localStorage for instant subsequent loads.
 */

const CACHE_KEY = "lb_exercise_gifs_v1";
const API_BASE  = "https://oss.exercisedb.dev";

type GifCache = Record<string, string | null>; // exerciseName → gifUrl | null

function getCache(): GifCache {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}"); }
  catch { return {}; }
}
function saveCache(cache: GifCache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

/** Normalizes an exercise name to ExerciseDB format: lowercase, no special chars */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

/**
 * Returns the GIF URL for an exercise name, fetching from ExerciseDB if not cached.
 * Returns null if not found.
 */
export async function fetchExerciseGif(exerciseName: string): Promise<string | null> {
  const cache = getCache();
  if (exerciseName in cache) return cache[exerciseName];

  try {
    const q = encodeURIComponent(normalize(exerciseName));
    const res = await fetch(`${API_BASE}/exercises/name/${q}?limit=1`);
    if (!res.ok) { cache[exerciseName] = null; saveCache(cache); return null; }

    const data = await res.json() as Array<{ gifUrl?: string }>;
    const url = data[0]?.gifUrl ?? null;
    cache[exerciseName] = url;
    saveCache(cache);
    return url;
  } catch {
    cache[exerciseName] = null;
    saveCache(cache);
    return null;
  }
}

/** Preloads GIFs for a list of exercise names in parallel (background). */
export function preloadExerciseGifs(names: string[]): void {
  const cache = getCache();
  const missing = names.filter(n => !(n in cache));
  if (!missing.length) return;
  // Batch with small delays to avoid rate limiting
  missing.forEach((name, i) => {
    setTimeout(() => fetchExerciseGif(name), i * 120);
  });
}
