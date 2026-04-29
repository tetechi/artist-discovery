"use client";

import { Era, Genre, Region, ERAS, GENRES, REGIONS } from "@/data/artists";
import { FilterState, toggleFilter } from "@/lib/filterUtils";

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalCount: number;
  filteredCount: number;
  /** 選択中の地域に含まれる国リスト */
  availableCountries: string[];
}

const REGION_COLORS: Record<string, string> = {
  "北米": "#3b82f6",
  "中南米": "#22c55e",
  "ヨーロッパ": "#a855f7",
  "日本": "#f43f5e",
  "アジア": "#f97316",
  "中東・北アフリカ": "#eab308",
  "アフリカ": "#14b8a6",
  "オセアニア": "#0ea5e9",
};

const GENRE_COLORS: Record<string, string> = {
  "ロック": "#ef4444", "ポップ": "#ec4899", "ヒップホップ": "#8b5cf6",
  "ジャズ": "#3b82f6", "クラシック": "#92400e", "エレクトロニック": "#0891b2",
  "R&B・ソウル": "#f97316", "カントリー": "#b45309", "フォーク": "#4d7c0f",
  "メタル": "#374151", "パンク": "#dc2626", "ブルース": "#7c2d12",
  "レゲエ": "#15803d", "ラテン": "#b45309", "アフロビーツ": "#065f46",
  "ワールドミュージック": "#0369a1", "J-Pop・J-Rock": "#be123c",
  "K-Pop": "#6d28d9", "ボサノバ": "#0f766e",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
      {children}
    </p>
  );
}

function Chip({
  label,
  active,
  color,
  onClick,
  small,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
  small?: boolean;
}) {
  const base = small
    ? "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-150 select-none border min-h-[34px]"
    : "inline-flex items-center px-3 py-2 rounded-full text-sm font-medium cursor-pointer transition-all duration-150 select-none border min-h-[38px]";

  if (active && color) {
    return (
      <button
        onClick={onClick}
        className={`${base} text-white`}
        style={{ backgroundColor: color, borderColor: color }}
      >
        {label}
      </button>
    );
  }
  if (active) {
    return (
      <button
        onClick={onClick}
        className={`${base} bg-gray-800 text-white border-gray-800`}
      >
        {label}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`${base} bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800`}
    >
      {label}
    </button>
  );
}

export default function FilterPanel({
  filters,
  onChange,
  totalCount,
  filteredCount,
  availableCountries,
}: Props) {
  const hasFilters =
    filters.regions.length > 0 ||
    filters.countries.length > 0 ||
    filters.genres.length > 0 ||
    filters.eras.length > 0;

  function handleRegionToggle(v: Region) {
    const nextRegions = toggleFilter(filters.regions, v);
    // 外れた地域に属する国を countries から除去
    const nextCountries = filters.countries.filter(() => {
      // availableCountries は nextRegions ベースで再計算されるので
      // page側で渡す → ここでは単純に全クリア
      return false; // 地域変更時はいったん国選択をリセット
    });
    onChange({ ...filters, regions: nextRegions, countries: nextCountries });
  }

  function handleCountryToggle(v: string) {
    onChange({ ...filters, countries: toggleFilter(filters.countries, v) });
  }

  function handleGenreToggle(v: Genre) {
    onChange({ ...filters, genres: toggleFilter(filters.genres, v) });
  }

  function handleEraToggle(v: Era) {
    onChange({ ...filters, eras: toggleFilter(filters.eras, v) });
  }

  function clearAll() {
    onChange({ regions: [], countries: [], genres: [], eras: [] });
  }

  const showCountries = filters.regions.length > 0;

  return (
    <div className="space-y-5">
      {/* カウント & クリア */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <span className="text-gray-900 font-semibold">{filteredCount}</span>
          <span> / {totalCount} アーティスト</span>
        </p>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors underline underline-offset-2"
          >
            すべてクリア
          </button>
        )}
      </div>

      {/* 地域 */}
      <div>
        <SectionLabel>地域</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <Chip
              key={r}
              label={r}
              active={filters.regions.includes(r)}
              color={REGION_COLORS[r]}
              onClick={() => handleRegionToggle(r)}
            />
          ))}
        </div>
      </div>

      {/* 国（地域選択時のみ表示） */}
      {showCountries && (
        <div className="pl-3 border-l-2 border-gray-200 animate-fade-in">
          <SectionLabel>国・地域を絞り込む</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {availableCountries.map((c) => (
              <Chip
                key={c}
                label={c}
                active={filters.countries.includes(c)}
                onClick={() => handleCountryToggle(c)}
                small
              />
            ))}
          </div>
        </div>
      )}

      {/* ジャンル */}
      <div>
        <SectionLabel>ジャンル</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <Chip
              key={g}
              label={g}
              active={filters.genres.includes(g)}
              color={GENRE_COLORS[g]}
              onClick={() => handleGenreToggle(g)}
            />
          ))}
        </div>
      </div>

      {/* 年代 */}
      <div>
        <SectionLabel>年代</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {ERAS.map((e) => (
            <Chip
              key={e}
              label={e}
              active={filters.eras.includes(e)}
              onClick={() => handleEraToggle(e)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
