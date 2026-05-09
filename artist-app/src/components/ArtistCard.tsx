"use client";

import { useState } from "react";
import { Artist } from "@/data/artists";

interface Props {
  artist: Artist;
  index: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="コピー"
      className="ml-1 inline-flex items-center justify-center w-6 h-6 text-black/20 hover:text-black/50 transition-colors duration-150 shrink-0"
    >
      {copied ? (
        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

export default function ArtistCard({ artist, index }: Props) {
  const isSameName = artist.nameJa === artist.name;

  return (
    <div
      className="relative overflow-hidden bg-white/70 border border-black/10 p-5 animate-slide-up hover:bg-white/90 hover:shadow-sm transition-all duration-300"
      style={{
        animationDelay: `${index * 90}ms`,
        animationFillMode: "both",
        borderLeft: `3px solid ${artist.color}`,
      }}
    >
      {/* バックグラウンドナンバー */}
      <div
        className="absolute top-3 right-4 font-magazine text-5xl leading-none select-none pointer-events-none"
        style={{ color: artist.color, opacity: 0.1 }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      {/* 国フラグ + 国名 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl leading-none">{artist.countryFlag}</span>
        <span className="text-[10px] text-black/35 uppercase tracking-[0.2em]">{artist.country}</span>
      </div>

      {/* アーティスト名 */}
      <div className="pr-10 mb-1">
        <div className="flex items-center gap-0.5">
          <h3 className="text-lg font-black text-gray-900 leading-tight">{artist.nameJa}</h3>
          <CopyButton text={artist.nameJa} />
        </div>
        {!isSameName && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <p className="text-xs text-black/40">{artist.name}</p>
            <CopyButton text={artist.name} />
          </div>
        )}
        {isSameName && (
          <p className="text-xs text-black/40 mt-0.5">{artist.name}</p>
        )}
      </div>

      {/* 説明文 */}
      {artist.description && (
        <p className="text-xs text-black/50 leading-relaxed mt-2 mb-3 line-clamp-3">
          {artist.description}
        </p>
      )}

      {/* タグ */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {artist.genres.map((g) => (
          <span
            key={g}
            className="text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider"
            style={{
              color: artist.color,
              backgroundColor: artist.color + "18",
              border: `1px solid ${artist.color}40`,
            }}
          >
            {g}
          </span>
        ))}
        <span className="text-[9px] px-2 py-0.5 text-black/35 bg-black/[0.04] border border-black/10 uppercase tracking-wider">
          {artist.region}
        </span>
        {artist.eras.slice(-1).map((e) => (
          <span key={e} className="text-[9px] px-2 py-0.5 text-black/35 bg-black/[0.04] border border-black/10 uppercase tracking-wider">
            {e}
          </span>
        ))}
      </div>

      {/* ボトムアクセントライン */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ backgroundColor: artist.color + "30" }}
      />
    </div>
  );
}
