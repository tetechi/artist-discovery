/**
 * update-ja-names.mjs
 *
 * Wikidata から日本語名を取得して artists.ts の nameJa を更新するスクリプト。
 * nameJa が英語名と同一のアーティストのみ対象。
 *
 * 使い方:
 *   node scripts/update-ja-names.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const ARTISTS_PATH = path.join(__dirname, '../artist-app/src/data/artists.ts');

// ── 国一覧（fetch-wikidata.mjs と同じ） ──────────────────────────────────────
const COUNTRY_CONFIGS = [
  ['アメリカ', 'wd:Q30', 'United States'],
  ['カナダ', 'wd:Q16', 'Canada'],
  ['イギリス', 'wd:Q145', 'United Kingdom'],
  ['フランス', 'wd:Q142', 'France'],
  ['ドイツ', 'wd:Q183', 'Germany'],
  ['スウェーデン', 'wd:Q34', 'Sweden'],
  ['日本', 'wd:Q17', 'Japan'],
  ['韓国', 'wd:Q884', 'South Korea'],
  ['ブラジル', 'wd:Q155', 'Brazil'],
  ['オーストラリア', 'wd:Q408', 'Australia'],
  ['アルゼンチン', 'wd:Q414', 'Argentina'],
  ['イタリア', 'wd:Q38', 'Italy'],
  ['スペイン', 'wd:Q29', 'Spain'],
  ['ナイジェリア', 'wd:Q1033', 'Nigeria'],
  ['南アフリカ', 'wd:Q258', 'South Africa'],
  ['コロンビア', 'wd:Q739', 'Colombia'],
  ['メキシコ', 'wd:Q96', 'Mexico'],
  ['ジャマイカ', 'wd:Q766', 'Jamaica'],
  ['インド', 'wd:Q668', 'India'],
  ['キューバ', 'wd:Q241', 'Cuba'],
  ['ノルウェー', 'wd:Q20', 'Norway'],
  ['アイルランド', 'wd:Q27', 'Ireland'],
  ['オランダ', 'wd:Q55', 'Netherlands'],
  ['ポルトガル', 'wd:Q45', 'Portugal'],
  ['ポーランド', 'wd:Q36', 'Poland'],
  ['ニュージーランド', 'wd:Q664', 'New Zealand'],
  ['ガーナ', 'wd:Q117', 'Ghana'],
  ['セネガル', 'wd:Q1041', 'Senegal'],
  ['エジプト', 'wd:Q79', 'Egypt'],
  ['レバノン', 'wd:Q822', 'Lebanon'],
  ['トルコ', 'wd:Q43', 'Turkey'],
  ['プエルトリコ', 'wd:Q1183', 'Puerto Rico'],
  ['フィンランド', 'wd:Q33', 'Finland'],
  ['デンマーク', 'wd:Q35', 'Denmark'],
  ['ベルギー', 'wd:Q31', 'Belgium'],
  ['チリ', 'wd:Q298', 'Chile'],
  ['中国', 'wd:Q148', 'China'],
  ['台湾', 'wd:Q865', 'Taiwan'],
  ['インドネシア', 'wd:Q252', 'Indonesia'],
  ['フィリピン', 'wd:Q928', 'Philippines'],
  ['タイ', 'wd:Q869', 'Thailand'],
  ['ベトナム', 'wd:Q881', 'Vietnam'],
  ['マレーシア', 'wd:Q833', 'Malaysia'],
  ['シンガポール', 'wd:Q334', 'Singapore'],
];

// ── SPARQL実行 ────────────────────────────────────────────────────────────────
async function sparqlQuery(query) {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ArtistDiscoveryApp/1.0 (ja-name updater)',
        'Accept': 'application/sparql-results+json',
      },
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, rows: [] };
    const json = await res.json();
    return { error: null, rows: json.results?.bindings ?? [] };
  } catch (e) {
    return { error: e.message, rows: [] };
  }
}

// ── クエリ構築（日本語名のみ取得・軽量版） ────────────────────────────────────
function buildSoloQueryJa(countryId, minLinks = 8) {
  return `
SELECT DISTINCT ?artistLabel ?jaLabel WHERE {
  ?artist wdt:P31 wd:Q5 ;
          wdt:P27 ${countryId} .
  ?artist rdfs:label ?jaLabel .
  FILTER(LANG(?jaLabel) = "ja")
  ?artist wikibase:sitelinks ?links .
  FILTER(?links >= ${minLinks})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 300`.trim();
}

function buildBandQueryJa(countryId, minLinks = 6) {
  return `
SELECT DISTINCT ?artistLabel ?jaLabel WHERE {
  ?artist wdt:P31 wd:Q215380 ;
          wdt:P495 ${countryId} .
  ?artist rdfs:label ?jaLabel .
  FILTER(LANG(?jaLabel) = "ja")
  ?artist wikibase:sitelinks ?links .
  FILTER(?links >= ${minLinks})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 300`.trim();
}

// ── artists.ts から nameJa === name のアーティストを抽出 ──────────────────────
function loadArtistsNeedingUpdate(content) {
  const needs = new Set();
  // nameJa: "XXX", の直後に name: "XXX" が来るパターンを検出
  // またはエントリを個別にパースしてnameJa===nameを判定
  const blocks = content.matchAll(
    /name:\s*"([^"]+)"[^}]*nameJa:\s*"([^"]+)"/gs
  );
  for (const m of blocks) {
    if (m[1] === m[2]) needs.add(m[1]); // name === nameJa → 更新が必要
  }
  return needs;
}

// ── メイン ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌐 Wikidata 日本語名更新スクリプト開始\n');

  const content = fs.readFileSync(ARTISTS_PATH, 'utf-8');

  // nameJa === name のアーティストセット
  const needsUpdate = loadArtistsNeedingUpdate(content);
  console.log(`  日本語名が未設定のアーティスト: ${needsUpdate.size} 件\n`);

  if (needsUpdate.size === 0) {
    console.log('✅ 全アーティストに日本語名があります。作業不要。');
    return;
  }

  // 英語名 → 日本語名 のマッピングを構築
  const jaMap = new Map(); // englishName → japaneseName

  for (const [jaLabel, wdId] of COUNTRY_CONFIGS) {
    process.stdout.write(`  ${jaLabel} ... `);

    const [soloRes, bandRes] = await Promise.allSettled([
      sparqlQuery(buildSoloQueryJa(wdId)),
      sparqlQuery(buildBandQueryJa(wdId)),
    ]);

    const rows = [
      ...(soloRes.status === 'fulfilled' ? soloRes.value.rows : []),
      ...(bandRes.status === 'fulfilled' ? bandRes.value.rows : []),
    ];

    let added = 0;
    for (const row of rows) {
      const enName = row.artistLabel?.value;
      const jaName = row.jaLabel?.value;
      if (!enName || !jaName || /^Q\d+$/.test(enName)) continue;
      if (!jaMap.has(enName) && needsUpdate.has(enName)) {
        jaMap.set(enName, jaName);
        added++;
      }
    }

    console.log(`${added} 件の日本語名を取得`);
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`\n  合計 ${jaMap.size} 件の日本語名を取得\n`);

  if (jaMap.size === 0) {
    console.log('❌ 更新可能な日本語名が見つかりませんでした。');
    return;
  }

  // ── artists.ts を更新 ──
  // nameJa: "EnglishName" を nameJa: "日本語名" に置換
  let updated = content;
  let count = 0;

  for (const [enName, jaName] of jaMap) {
    // nameJa: "EnglishName" を安全に置換（同じ行のみ）
    const escaped = enName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(nameJa:\\s*)"${escaped}"`, 'g');
    const before = updated;
    updated = updated.replace(re, `$1"${jaName.replace(/"/g, '\\"')}"`);
    if (updated !== before) count++;
  }

  // バックアップ保存
  fs.writeFileSync(ARTISTS_PATH + '.bak2', content, 'utf-8');
  fs.writeFileSync(ARTISTS_PATH, updated, 'utf-8');

  console.log(`✅ ${count} 件の nameJa を日本語名に更新しました。`);
  console.log(`   バックアップ: artists.ts.bak2\n`);

  // サンプル表示
  console.log('── 更新サンプル (先頭10件) ──');
  let i = 0;
  for (const [en, ja] of jaMap) {
    if (i++ >= 10) break;
    console.log(`  "${en}" → "${ja}"`);
  }
}

main().catch(console.error);
