"use client";

import { useState, useCallback, useMemo } from "react";
import { artists, Artist, Region } from "@/data/artists";
import { FilterState, filterArtists, pickRandom, getCountriesForRegions } from "@/lib/filterUtils";
import FilterPanel from "@/components/FilterPanel";
import ArtistCard from "@/components/ArtistCard";

const PICK_COUNT = 4;
const DEFAULT_FILTERS: FilterState = { regions: [], countries: [], genres: [], eras: [] };
const ISSUE_NUM = String(Math.floor(artists.length / 100)).padStart(3, "0");

export default function Home() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [results, setResults] = useState<Artist[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const availableCountries = useMemo(
    () => getCountriesForRegions(artists, filters.regions),
    [filters.regions]
  );

  const filtered = useMemo(
    () => filterArtists(artists, filters),
    [filters]
  );

  const discover = useCallback(() => {
    if (filtered.length === 0) return;
    setIsAnimating(true);
    setResults([]);
    setTimeout(() => {
      setResults(pickRandom(filtered, PICK_COUNT));
      setHasSearched(true);
      setIsAnimating(false);
    }, 150);
  }, [filtered]);

  const activeFilterCount =
    filters.regions.length + filters.countries.length + filters.genres.length + filters.eras.length;
  const hasFilters = activeFilterCount > 0;

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 pb-safe">

        {/* ── マガジン上部ストリップ ── */}
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-black/15">
          <span className="text-[10px] tracking-[0.3em] uppercase text-black/35">World Music</span>
          <span className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase text-black/35">
            <span className="w-1.5 h-1.5 bg-red-600 inline-block" />
            {artists.length.toLocaleString()} Artists
          </span>
          <span className="text-[10px] tracking-[0.3em] uppercase text-black/35">No.{ISSUE_NUM}</span>
        </div>

        {/* ── マストヘッド ── */}
        <header className="text-center mb-10">
          <p className="text-[10px] tracking-[0.4em] uppercase text-black/35 mb-3">The Global</p>
          <h1 className="font-magazine text-6xl sm:text-8xl text-black leading-[0.88] mb-5 uppercase">
            Artist<br />Discovery
          </h1>
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px flex-1 max-w-[100px] bg-black/15" />
            <div className="w-2.5 h-2.5 bg-red-600 rotate-45 shrink-0" />
            <div className="h-px flex-1 max-w-[100px] bg-black/15" />
          </div>
          <p className="text-[11px] tracking-[0.3em] uppercase text-black/35">
            世界中の音楽アーティストをランダムに発見
          </p>
        </header>

        {/* ── フィルタートグル ── */}
        <div className="flex justify-center mb-5">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2.5 px-6 py-2.5 border border-black/20 bg-white/50 hover:bg-white/80 text-[11px] text-black/50 hover:text-black/80 transition-all duration-150 uppercase tracking-[0.2em]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {showFilters ? "Close" : "Filter"}
            {hasFilters && (
              <span className="inline-flex items-center justify-center w-4 h-4 bg-red-600 text-white text-[9px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* ── フィルターパネル ── */}
        {showFilters && (
          <div className="mb-7 p-5 border border-black/12 bg-white/60 animate-fade-in">
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              totalCount={artists.length}
              filteredCount={filtered.length}
              availableCountries={availableCountries}
            />
          </div>
        )}

        {/* ── 発見ボタン ── */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <button
            onClick={discover}
            disabled={filtered.length === 0}
            className="group px-12 py-4 bg-red-600 hover:bg-red-500 active:scale-[0.97] text-white font-black text-xs uppercase tracking-[0.25em] transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-3">
              <svg className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              Discover Artists
            </span>
          </button>

          {filtered.length === 0 && (
            <p className="text-[11px] text-red-600 uppercase tracking-widest">
              条件に一致するアーティストがいません
            </p>
          )}
          {filtered.length > 0 && hasFilters && (
            <p className="text-[10px] text-black/30 uppercase tracking-widest">
              {filtered.length.toLocaleString()} artists — picking {Math.min(PICK_COUNT, filtered.length)}
            </p>
          )}
        </div>

        {/* ── 結果 ── */}
        {!isAnimating && results.length > 0 && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px flex-1 bg-black/12" />
              <p className="text-[9px] text-black/30 font-bold uppercase tracking-[0.3em]">Featured Artists</p>
              <div className="h-px flex-1 bg-black/12" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((artist, i) => (
                <ArtistCard key={`${artist.id}-${Date.now()}`} artist={artist} index={i} />
              ))}
            </div>

            <div className="flex justify-center mt-8">
              <button
                onClick={discover}
                className="inline-flex items-center gap-2 px-6 py-2.5 border border-black/15 hover:border-black/35 text-[10px] text-black/30 hover:text-black/60 transition-all duration-150 uppercase tracking-[0.25em] bg-white/40 hover:bg-white/70"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Shuffle
              </button>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!hasSearched && (
          <div className="text-center py-20">
            <div className="font-magazine text-[80px] text-black/[0.05] leading-none select-none mb-3">♪</div>
            <p className="text-[10px] text-black/25 uppercase tracking-[0.35em]">Press to discover</p>
          </div>
        )}

        {/* ── フッター ── */}
        <footer className="mt-20 pt-5 border-t border-black/12 text-center">
          <p className="text-[10px] text-black/25 uppercase tracking-[0.2em]">
            {artists.length.toLocaleString()} Artists · 143 Countries · All Genres
          </p>
        </footer>

      </div>
    </main>
  );
}
