/**
 * Wikidata SPARQL → artists.ts 変換スクリプト (軽量版)
 * - 1カ国ずつソロ・バンドを別クエリで取得
 * - シンプルなクエリでタイムアウト回避
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const OUTPUT_DIR = path.join(__dirname, 'output');

// ── ジャンルマッピング ────────────────────────────────────────────────────────
const GENRE_MAP = [
  { keywords: ['k-pop', 'korean pop'], genre: 'K-Pop' },
  { keywords: ['j-pop', 'j-rock', 'city pop', 'visual kei', 'anime song', 'shibuya-kei'], genre: 'J-Pop・J-Rock' },
  { keywords: ['bossa nova', 'mpb', 'música popular', 'tropicália'], genre: 'ボサノバ' },
  { keywords: ['afrobeat', 'afropop', 'afrobeats', 'highlife', 'jùjú', 'makossa', 'soukous', 'mbalax'], genre: 'アフロビーツ' },
  { keywords: ['reggae', 'ska', 'rocksteady', 'dancehall', 'dub'], genre: 'レゲエ' },
  { keywords: ['blues'], genre: 'ブルース' },
  { keywords: ['punk', 'hardcore punk', 'post-punk', 'new wave'], genre: 'パンク' },
  { keywords: ['heavy metal', 'thrash', 'death metal', 'black metal', 'doom metal', 'power metal', 'speed metal'], genre: 'メタル' },
  { keywords: ['hip hop', 'hip-hop', 'rap', 'trap music', 'drill', 'gangsta rap'], genre: 'ヒップホップ' },
  { keywords: ['classical', 'opera', 'symphony', 'baroque', 'romantic music', 'chamber music'], genre: 'クラシック' },
  { keywords: ['jazz', 'bebop', 'swing music', 'cool jazz'], genre: 'ジャズ' },
  { keywords: ['electronic', 'techno', 'house music', 'ambient', 'synth', 'edm', 'trance', 'drum and bass', 'dubstep', 'electronica', 'electro '], genre: 'エレクトロニック' },
  { keywords: ['rhythm and blues', 'r&b', 'soul music', 'soul ', 'funk', 'motown', 'gospel', 'neo soul'], genre: 'R&B・ソウル' },
  { keywords: ['country music', 'bluegrass', 'americana', 'honky'], genre: 'カントリー' },
  { keywords: ['folk music', 'folk rock', 'singer-songwriter', 'acoustic', 'celtic'], genre: 'フォーク' },
  { keywords: ['latin', 'salsa', 'cumbia', 'reggaeton', 'tango', 'flamenco', 'bolero', 'merengue', 'bachata', 'samba'], genre: 'ラテン' },
  { keywords: ['rock', 'grunge', 'indie rock', 'alternative rock', 'post-rock', 'progressive rock', 'psychedelic rock', 'hard rock', 'glam rock', 'punk rock'], genre: 'ロック' },
  { keywords: ['pop music', 'pop rock', 'dance-pop', 'bubblegum', 'teen pop', 'electropop', 'synthpop'], genre: 'ポップ' },
  { keywords: ['world music', 'traditional', 'ethnic', 'qawwali', 'raï', 'chaabi', 'fado', 'gnawa'], genre: 'ワールドミュージック' },
];

// ── 国マッピング ──────────────────────────────────────────────────────────────
const COUNTRY_MAP = {
  'United States': { region: '北米', flag: '🇺🇸', ja: 'アメリカ' },
  'Canada': { region: '北米', flag: '🇨🇦', ja: 'カナダ' },
  'Mexico': { region: '中南米', flag: '🇲🇽', ja: 'メキシコ' },
  'Brazil': { region: '中南米', flag: '🇧🇷', ja: 'ブラジル' },
  'Argentina': { region: '中南米', flag: '🇦🇷', ja: 'アルゼンチン' },
  'Colombia': { region: '中南米', flag: '🇨🇴', ja: 'コロンビア' },
  'Chile': { region: '中南米', flag: '🇨🇱', ja: 'チリ' },
  'Peru': { region: '中南米', flag: '🇵🇪', ja: 'ペルー' },
  'Venezuela': { region: '中南米', flag: '🇻🇪', ja: 'ベネズエラ' },
  'Cuba': { region: '中南米', flag: '🇨🇺', ja: 'キューバ' },
  'Puerto Rico': { region: '中南米', flag: '🇵🇷', ja: 'プエルトリコ' },
  'Jamaica': { region: '中南米', flag: '🇯🇲', ja: 'ジャマイカ' },
  'Trinidad and Tobago': { region: '中南米', flag: '🇹🇹', ja: 'トリニダード・トバゴ' },
  'Dominican Republic': { region: '中南米', flag: '🇩🇴', ja: 'ドミニカ共和国' },
  'Barbados': { region: '中南米', flag: '🇧🇧', ja: 'バルバドス' },
  'United Kingdom': { region: 'ヨーロッパ', flag: '🇬🇧', ja: 'イギリス' },
  'France': { region: 'ヨーロッパ', flag: '🇫🇷', ja: 'フランス' },
  'Germany': { region: 'ヨーロッパ', flag: '🇩🇪', ja: 'ドイツ' },
  'Italy': { region: 'ヨーロッパ', flag: '🇮🇹', ja: 'イタリア' },
  'Spain': { region: 'ヨーロッパ', flag: '🇪🇸', ja: 'スペイン' },
  'Sweden': { region: 'ヨーロッパ', flag: '🇸🇪', ja: 'スウェーデン' },
  'Norway': { region: 'ヨーロッパ', flag: '🇳🇴', ja: 'ノルウェー' },
  'Denmark': { region: 'ヨーロッパ', flag: '🇩🇰', ja: 'デンマーク' },
  'Finland': { region: 'ヨーロッパ', flag: '🇫🇮', ja: 'フィンランド' },
  'Netherlands': { region: 'ヨーロッパ', flag: '🇳🇱', ja: 'オランダ' },
  'Belgium': { region: 'ヨーロッパ', flag: '🇧🇪', ja: 'ベルギー' },
  'Switzerland': { region: 'ヨーロッパ', flag: '🇨🇭', ja: 'スイス' },
  'Austria': { region: 'ヨーロッパ', flag: '🇦🇹', ja: 'オーストリア' },
  'Poland': { region: 'ヨーロッパ', flag: '🇵🇱', ja: 'ポーランド' },
  'Russia': { region: 'ヨーロッパ', flag: '🇷🇺', ja: 'ロシア' },
  'Iceland': { region: 'ヨーロッパ', flag: '🇮🇸', ja: 'アイスランド' },
  'Ireland': { region: 'ヨーロッパ', flag: '🇮🇪', ja: 'アイルランド' },
  'Portugal': { region: 'ヨーロッパ', flag: '🇵🇹', ja: 'ポルトガル' },
  'Greece': { region: 'ヨーロッパ', flag: '🇬🇷', ja: 'ギリシャ' },
  'Ukraine': { region: 'ヨーロッパ', flag: '🇺🇦', ja: 'ウクライナ' },
  'Czechia': { region: 'ヨーロッパ', flag: '🇨🇿', ja: 'チェコ' },
  'Hungary': { region: 'ヨーロッパ', flag: '🇭🇺', ja: 'ハンガリー' },
  'Romania': { region: 'ヨーロッパ', flag: '🇷🇴', ja: 'ルーマニア' },
  'Japan': { region: '日本', flag: '🇯🇵', ja: '日本' },
  'South Korea': { region: 'アジア', flag: '🇰🇷', ja: '韓国' },
  'China': { region: 'アジア', flag: '🇨🇳', ja: '中国' },
  'India': { region: 'アジア', flag: '🇮🇳', ja: 'インド' },
  'Pakistan': { region: 'アジア', flag: '🇵🇰', ja: 'パキスタン' },
  'Indonesia': { region: 'アジア', flag: '🇮🇩', ja: 'インドネシア' },
  'Philippines': { region: 'アジア', flag: '🇵🇭', ja: 'フィリピン' },
  'Thailand': { region: 'アジア', flag: '🇹🇭', ja: 'タイ' },
  'Vietnam': { region: 'アジア', flag: '🇻🇳', ja: 'ベトナム' },
  'Malaysia': { region: 'アジア', flag: '🇲🇾', ja: 'マレーシア' },
  'Singapore': { region: 'アジア', flag: '🇸🇬', ja: 'シンガポール' },
  'Taiwan': { region: 'アジア', flag: '🇹🇼', ja: '台湾' },
  'Nigeria': { region: 'アフリカ', flag: '🇳🇬', ja: 'ナイジェリア' },
  'Ghana': { region: 'アフリカ', flag: '🇬🇭', ja: 'ガーナ' },
  'South Africa': { region: 'アフリカ', flag: '🇿🇦', ja: '南アフリカ' },
  'Senegal': { region: 'アフリカ', flag: '🇸🇳', ja: 'セネガル' },
  'Mali': { region: 'アフリカ', flag: '🇲🇱', ja: 'マリ' },
  'Cameroon': { region: 'アフリカ', flag: '🇨🇲', ja: 'カメルーン' },
  'Ethiopia': { region: 'アフリカ', flag: '🇪🇹', ja: 'エチオピア' },
  'Kenya': { region: 'アフリカ', flag: '🇰🇪', ja: 'ケニア' },
  'Egypt': { region: '中東・北アフリカ', flag: '🇪🇬', ja: 'エジプト' },
  'Algeria': { region: '中東・北アフリカ', flag: '🇩🇿', ja: 'アルジェリア' },
  'Morocco': { region: '中東・北アフリカ', flag: '🇲🇦', ja: 'モロッコ' },
  'Tunisia': { region: '中東・北アフリカ', flag: '🇹🇳', ja: 'チュニジア' },
  'Lebanon': { region: '中東・北アフリカ', flag: '🇱🇧', ja: 'レバノン' },
  'Israel': { region: '中東・北アフリカ', flag: '🇮🇱', ja: 'イスラエル' },
  'Turkey': { region: '中東・北アフリカ', flag: '🇹🇷', ja: 'トルコ' },
  'Iran': { region: '中東・北アフリカ', flag: '🇮🇷', ja: 'イラン' },
  'Australia': { region: 'オセアニア', flag: '🇦🇺', ja: 'オーストラリア' },
  'New Zealand': { region: 'オセアニア', flag: '🇳🇿', ja: 'ニュージーランド' },
};

const GENRE_COLOR = {
  'ロック': '#ef4444', 'ポップ': '#ec4899', 'ヒップホップ': '#8b5cf6',
  'ジャズ': '#3b82f6', 'クラシック': '#854d0e', 'エレクトロニック': '#06b6d4',
  'R&B・ソウル': '#f97316', 'カントリー': '#a16207', 'フォーク': '#65a30d',
  'メタル': '#374151', 'パンク': '#dc2626', 'ブルース': '#7c2d12',
  'レゲエ': '#16a34a', 'ラテン': '#d97706', 'アフロビーツ': '#15803d',
  'ワールドミュージック': '#0891b2', 'J-Pop・J-Rock': '#e11d48',
  'K-Pop': '#7c3aed', 'ボサノバ': '#0d9488',
};

// 国ID → 国名ラベル（クエリ内で country を省略するため）
const COUNTRY_CONFIGS = [
  // ラベル, WikidataID, solo用途
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
  // アジア追加
  ['中国', 'wd:Q148', 'China'],
  ['台湾', 'wd:Q865', 'Taiwan'],
  ['インドネシア', 'wd:Q252', 'Indonesia'],
  ['フィリピン', 'wd:Q928', 'Philippines'],
  ['タイ', 'wd:Q869', 'Thailand'],
  ['ベトナム', 'wd:Q881', 'Vietnam'],
  ['マレーシア', 'wd:Q833', 'Malaysia'],
  ['シンガポール', 'wd:Q334', 'Singapore'],
];

function yearToEra(year) {
  if (!year) return null;
  const y = parseInt(year);
  if (y < 1960) return '50s以前';
  if (y < 1970) return '60s';
  if (y < 1980) return '70s';
  if (y < 1990) return '80s';
  if (y < 2000) return '90s';
  if (y < 2010) return '00s';
  if (y < 2020) return '10s';
  return '20s';
}

function mapGenre(label) {
  if (!label) return null;
  const lower = label.toLowerCase();
  for (const { keywords, genre } of GENRE_MAP) {
    if (keywords.some(k => lower.includes(k))) return genre;
  }
  return null;
}

function toId(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60);
}

async function sparqlQuery(query) {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'ArtistDiscoveryApp/1.0 (educational music app)',
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

// ソロアーティスト用クエリ（日本語名付き）
function buildSoloQuery(countryId, minLinks = 1) {
  return `
SELECT DISTINCT ?artist ?artistLabel ?jaLabel ?genreLabel ?year WHERE {
  ?artist wdt:P31 wd:Q5 ;
          wdt:P27 ${countryId} ;
          wdt:P136 ?genre .
  OPTIONAL { ?artist wdt:P569 ?birth . BIND(YEAR(?birth) AS ?year) }
  OPTIONAL { ?artist rdfs:label ?jaLabel . FILTER(LANG(?jaLabel) = "ja") }
  ?artist wikibase:sitelinks ?links .
  FILTER(?links >= ${minLinks})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 200`.trim();
}

// バンド用クエリ（日本語名付き）
function buildBandQuery(countryId, minLinks = 1) {
  return `
SELECT DISTINCT ?artist ?artistLabel ?jaLabel ?genreLabel ?year WHERE {
  ?artist wdt:P31 wd:Q215380 ;
          wdt:P495 ${countryId} ;
          wdt:P136 ?genre .
  OPTIONAL { ?artist wdt:P571 ?inc . BIND(YEAR(?inc) AS ?year) }
  OPTIONAL { ?artist rdfs:label ?jaLabel . FILTER(LANG(?jaLabel) = "ja") }
  ?artist wikibase:sitelinks ?links .
  FILTER(?links >= ${minLinks})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 200`.trim();
}

function processRows(rows, countryName) {
  const map = new Map();
  const countryInfo = COUNTRY_MAP[countryName];
  if (!countryInfo) return [];

  for (const row of rows) {
    const name = row.artistLabel?.value;
    const jaLabel = row.jaLabel?.value;   // 日本語名（あれば）
    const genreLabel = row.genreLabel?.value;
    const year = row.year?.value;

    if (!name || /^Q\d+$/.test(name)) continue;
    const genre = mapGenre(genreLabel);
    if (!genre) continue;

    const id = toId(name);
    if (!id) continue;

    if (!map.has(id)) {
      map.set(id, {
        id,
        name,
        nameJa: jaLabel || name,  // 日本語名があれば使用、なければ英語名
        country: countryInfo.ja,
        countryFlag: countryInfo.flag,
        region: countryInfo.region,
        genres: [],
        eras: year ? [yearToEra(year)].filter(Boolean) : [],
        description: '',
        color: '#6366f1',
      });
    }

    const a = map.get(id);
    if (!a.genres.includes(genre)) {
      a.genres.push(genre);
      if (a.genres.length === 1) a.color = GENRE_COLOR[genre] ?? '#6366f1';
    }
  }

  return [...map.values()];
}

function loadExistingNames() {
  const p = path.join(__dirname, '../artist-app/src/data/artists.ts');
  const content = fs.readFileSync(p, 'utf-8');
  return new Set([...content.matchAll(/name:\s*["']([^"']+)["']/g)].map(m => m[1].toLowerCase()));
}

async function main() {
  console.log('🎵 Wikidata アーティストデータ取得開始\n');
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const existingNames = loadExistingNames();
  console.log(`既存: ${existingNames.size} 件\n`);

  const allNew = [];
  const seen = new Set([...existingNames]);

  for (const [jaLabel, wdId, enLabel] of COUNTRY_CONFIGS) {
    process.stdout.write(`  ${jaLabel} (${enLabel}) ... `);

    const [soloRes, bandRes] = await Promise.allSettled([
      sparqlQuery(buildSoloQuery(wdId)),
      sparqlQuery(buildBandQuery(wdId)),
    ]);

    const soloRows = soloRes.status === 'fulfilled' ? soloRes.value.rows : [];
    const bandRows = bandRes.status === 'fulfilled' ? bandRes.value.rows : [];
    const soloErr = soloRes.status === 'fulfilled' ? soloRes.value.error : soloRes.reason;
    const bandErr = bandRes.status === 'fulfilled' ? bandRes.value.error : bandRes.reason;

    if (soloErr) process.stdout.write(`[solo:${soloErr}] `);
    if (bandErr) process.stdout.write(`[band:${bandErr}] `);

    const converted = processRows([...soloRows, ...bandRows], enLabel);
    const deduped = converted.filter(a => !seen.has(a.name.toLowerCase()));
    deduped.forEach(a => seen.add(a.name.toLowerCase()));
    allNew.push(...deduped);

    console.log(`${deduped.length} 件追加 (solo:${soloRows.length} band:${bandRows.length})`);

    // レート制限対策
    await new Promise(r => setTimeout(r, 1500));
  }

  // 出力
  const tsLines = allNew.map(a => `  {
    id: "${a.id}",
    name: "${a.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",
    nameJa: "${a.nameJa.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",
    country: "${a.country}",
    countryFlag: "${a.countryFlag}",
    region: "${a.region}",
    genres: ${JSON.stringify(a.genres)},
    eras: ${JSON.stringify(a.eras)},
    description: "",
    color: "${a.color}",
  }`).join(',\n');

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'new-artists.ts'),
    `// 自動生成 ${new Date().toISOString().slice(0, 10)}\nexport const wikidataArtists = [\n${tsLines}\n];\n`,
  );
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'new-artists.json'),
    JSON.stringify(allNew, null, 2),
  );

  const byRegion = {};
  for (const a of allNew) byRegion[a.region] = (byRegion[a.region] ?? 0) + 1;

  console.log('\n── 完了 ──────────────────────────');
  for (const [r, n] of Object.entries(byRegion).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${r}: ${n} 件`);
  }
  console.log(`  合計: ${allNew.length} 件`);
}

main().catch(console.error);
