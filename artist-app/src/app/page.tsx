"use client";

import { useState, useCallback, useMemo } from "react";
import { artists, Artist, Region } from "@/data/artists";
import { FilterState, filterArtists, pickRandom, getCountriesForRegions } from "@/lib/filterUtils";
import FilterPanel from "@/components/FilterPanel";
import ArtistCard from "@/components/ArtistCard";

const PICK_COUNT = 4;

const DEFAULT_FILTERS: FilterState = { regions: [], countries: [], genres: [], eras: [] };

export default function Home() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [results, setResults] = useState<Artist[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // 選択地域に含まれる国リスト（useMemoで最適化）
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
    filters.regions.length +
    filters.countries.length +
    filters.genres.length +
    filters.eras.length;

  const hasFilters = activeFilterCount > 0;

  return (
    <main className="min-h-screen bg-[#f5f7fa]">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 pb-safe">

        {/* ヘッダー */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-500 mb-5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {artists.length.toLocaleString()} アーティスト収録
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2 tracking-tight">
            Artist Discovery
          </h1>
          <p className="text-gray-500">
            世界中の音楽アーティストをランダムに発見しよう
          </p>
        </div>

        {/* フィルタートグル */}
        <div className="flex justify-center mb-5">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-600 hover:text-gray-900 transition-all duration-150 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {showFilters ? "フィルターを閉じる" : "フィルターで絞り込む"}
            {hasFilters && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-900 text-white text-xs font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* フィルターパネル */}
        {showFilters && (
          <div className="mb-6 p-5 rounded-2xl bg-white border border-gray-200 shadow-sm animate-fade-in">
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              totalCount={artists.length}
              filteredCount={filtered.length}
              availableCountries={availableCountries}
            />
          </div>
        )}

        {/* 発見ボタン */}
        <div className="flex flex-col items-center gap-3 mb-10">
          <button
            onClick={discover}
            disabled={filtered.length === 0}
            className="group px-10 py-4 rounded-2xl bg-gray-900 text-white font-bold text-lg hover:bg-gray-800 active:scale-95 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
          >
            <span className="flex items-center gap-3">
              <svg className="w-5 h-5 group-hover:rotate-12 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              アーティストを発見する
            </span>
          </button>

          {filtered.length === 0 && (
            <p className="text-sm text-red-500">
              条件に一致するアーティストがいません。フィルターを変更してください。
            </p>
          )}
          {filtered.length > 0 && hasFilters && (
            <p className="text-xs text-gray-400">
              {filtered.length.toLocaleString()} 件中 {Math.min(PICK_COUNT, filtered.length)} 名をランダムに紹介
            </p>
          )}
        </div>

        {/* 結果 */}
        {!isAnimating && results.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1 bg-gray-200" />
              <p className="text-sm text-gray-400 font-medium">今日のおすすめ</p>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((artist, i) => (
                <ArtistCard key={`${artist.id}-${Date.now()}`} artist={artist} index={i} />
              ))}
            </div>
            <div className="flex justify-center mt-6">
              <button
                onClick={discover}
                className="text-sm text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                シャッフルして再発見
              </button>
            </div>
          </div>
        )}

        {/* 初回 empty state */}
        {!hasSearched && (
          <div className="text-center py-16 text-gray-300">
            <svg className="w-14 h-14 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-sm text-gray-400">ボタンを押してアーティストを発見しよう</p>
          </div>
        )}

        {/* フッター */}
        <footer className="mt-16 text-center text-xs text-gray-400 space-y-1">
          <p>{artists.length.toLocaleString()} アーティスト収録 · 国 / ジャンル / 年代でフィルタリング可能</p>
          <p>追加: <code className="font-mono text-gray-500">src/data/artists.ts</code></p>
        </footer>
      </div>
    </main>
  );
}
