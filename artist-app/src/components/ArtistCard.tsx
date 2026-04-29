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
      // フォールバック
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
      title="アーティスト名をコピー"
      className="ml-1.5 inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-all duration-150 shrink-0"
    >
      {copied ? (
        // チェックマーク
        <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        // クリップボードアイコン
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

export default function ArtistCard({ artist, index }: Props) {
  // 日本語名と英語名が異なる場合は両方コピーできるようにする
  const isSameName = artist.nameJa === artist.name;

  return (
    <div
      className="relative rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm p-6 animate-slide-up hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
      style={{
        animationDelay: `${index * 80}ms`,
        animationFillMode: "both",
      }}
    >
      {/* Accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{ backgroundColor: artist.color }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xl">{artist.countryFlag}</span>
            <span className="text-xs text-gray-400">{artist.country}</span>
          </div>

          {/* 日本語名 + コピーボタン */}
          <div className="flex items-center gap-0.5">
            <h3 className="text-base font-bold text-gray-900 leading-tight">{artist.nameJa}</h3>
            <CopyButton text={artist.nameJa} />
          </div>

          {/* 英語名（日本語名と異なる場合のみ）+ コピーボタン */}
          {!isSameName && (
            <div className="flex items-center gap-0.5 mt-0.5">
              <p className="text-xs text-gray-400">{artist.name}</p>
              <CopyButton text={artist.name} />
            </div>
          )}
          {isSameName && (
            <p className="text-xs text-gray-400 mt-0.5">{artist.name}</p>
          )}
        </div>

        <div
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ backgroundColor: artist.color + "18", color: artist.color }}
        >
          {index + 1}
        </div>
      </div>

      {/* Description */}
      {artist.description && (
        <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-4">
          {artist.description}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {artist.genres.map((g) => (
          <span
            key={g}
            className="text-xs px-2 py-0.5 rounded-full border font-medium"
            style={{
              borderColor: artist.color + "55",
              color: artist.color,
              backgroundColor: artist.color + "10",
            }}
          >
            {g}
          </span>
        ))}
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
          {artist.region}
        </span>
        {artist.eras.slice(-1).map((e) => (
          <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}
