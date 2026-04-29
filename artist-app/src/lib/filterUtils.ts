import { Artist, Era, Genre, Region } from "@/data/artists";

export interface FilterState {
  regions: Region[];
  countries: string[]; // artist.country (日本語名)
  genres: Genre[];
  eras: Era[];
}

export function filterArtists(artists: Artist[], filters: FilterState): Artist[] {
  return artists.filter((artist) => {
    if (!artist) return false; // マージ時の undefined ガード
    const regionMatch =
      filters.regions.length === 0 || filters.regions.includes(artist.region);

    const countryMatch =
      filters.countries.length === 0 || filters.countries.includes(artist.country);

    const genreMatch =
      filters.genres.length === 0 ||
      artist.genres.some((g) => filters.genres.includes(g));

    const eraMatch =
      filters.eras.length === 0 ||
      artist.eras.some((e) => filters.eras.includes(e));

    return regionMatch && countryMatch && genreMatch && eraMatch;
  });
}

/** 選択中の地域に含まれる国一覧を返す（地域未選択時は全国） */
export function getCountriesForRegions(
  artists: Artist[],
  regions: Region[]
): string[] {
  const set = new Set<string>();
  for (const a of artists) {
    if (!a) continue; // undefined ガード
    if (regions.length === 0 || regions.includes(a.region)) {
      set.add(a.country);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

export function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function toggleFilter<T>(current: T[], value: T): T[] {
  return current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
}
