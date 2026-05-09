/**
 * Wikidata SPARQL → artists.ts 変換スクリプト（OFFSETページネーション版）
 *
 * - progress.json で各国の進捗（offset）を管理
 * - ORDER BY で結果を固定し、毎回続きから取得
 * - 結果が PAGE_SIZE 未満になったら「その国は完了」とマーク
 * - 全国完了するまで繰り返せば全件網羅できる
 * - アメリカ等の大国ソロは年代別（10年区切り）に分割して大OFFSET回避
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const OUTPUT_DIR     = path.join(__dirname, 'output');
const PROGRESS_FILE  = path.join(OUTPUT_DIR, 'progress.json');
const PAGE_SIZE      = 500;

// ── 年代分割対象国（大OFFSETでタイムアウトする国） ───────────────────────────
const YEAR_SPLIT_COUNTRIES = new Set(['United States']);

// 年代レンジ定義（大きいレンジはさらに5年刻みに細分化）
// ※ pre1940・1960s・1970s は offset=5000 でタイムアウトするため細分化
const YEAR_RANGES = [
  { key: 'pre1900', minYear: null, maxYear: 1900 },
  { key: '1900s',   minYear: 1900, maxYear: 1910 },
  { key: '1910s',   minYear: 1910, maxYear: 1920 },
  { key: '1920s',   minYear: 1920, maxYear: 1930 },
  { key: '1930s',   minYear: 1930, maxYear: 1940 },
  { key: '1940s',   minYear: 1940, maxYear: 1950 },
  { key: '1950s',   minYear: 1950, maxYear: 1960 },
  { key: '1960a',   minYear: 1960, maxYear: 1965 },
  { key: '1960b',   minYear: 1965, maxYear: 1970 },
  { key: '1970a',   minYear: 1970, maxYear: 1975 },
  { key: '1970b',   minYear: 1975, maxYear: 1980 },
  { key: '1980s',   minYear: 1980, maxYear: 1990 },
  { key: '1990s',   minYear: 1990, maxYear: 2000 },
  { key: '2000s',   minYear: 2000, maxYear: 2010 },
  { key: '2010s',   minYear: 2010, maxYear: 2020 },
  { key: '2020s',   minYear: 2020, maxYear: null },
  { key: 'noBirth', minYear: null, maxYear: null, noBirth: true },
];

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
  'United States':        { region: '北米',          flag: '🇺🇸', ja: 'アメリカ' },
  'Canada':               { region: '北米',          flag: '🇨🇦', ja: 'カナダ' },
  'Mexico':               { region: '中南米',        flag: '🇲🇽', ja: 'メキシコ' },
  'Brazil':               { region: '中南米',        flag: '🇧🇷', ja: 'ブラジル' },
  'Argentina':            { region: '中南米',        flag: '🇦🇷', ja: 'アルゼンチン' },
  'Colombia':             { region: '中南米',        flag: '🇨🇴', ja: 'コロンビア' },
  'Chile':                { region: '中南米',        flag: '🇨🇱', ja: 'チリ' },
  'Peru':                 { region: '中南米',        flag: '🇵🇪', ja: 'ペルー' },
  'Venezuela':            { region: '中南米',        flag: '🇻🇪', ja: 'ベネズエラ' },
  'Cuba':                 { region: '中南米',        flag: '🇨🇺', ja: 'キューバ' },
  'Puerto Rico':          { region: '中南米',        flag: '🇵🇷', ja: 'プエルトリコ' },
  'Jamaica':              { region: '中南米',        flag: '🇯🇲', ja: 'ジャマイカ' },
  'Trinidad and Tobago':  { region: '中南米',        flag: '🇹🇹', ja: 'トリニダード・トバゴ' },
  'Dominican Republic':   { region: '中南米',        flag: '🇩🇴', ja: 'ドミニカ共和国' },
  'Barbados':             { region: '中南米',        flag: '🇧🇧', ja: 'バルバドス' },
  'United Kingdom':       { region: 'ヨーロッパ',    flag: '🇬🇧', ja: 'イギリス' },
  'France':               { region: 'ヨーロッパ',    flag: '🇫🇷', ja: 'フランス' },
  'Germany':              { region: 'ヨーロッパ',    flag: '🇩🇪', ja: 'ドイツ' },
  'Italy':                { region: 'ヨーロッパ',    flag: '🇮🇹', ja: 'イタリア' },
  'Spain':                { region: 'ヨーロッパ',    flag: '🇪🇸', ja: 'スペイン' },
  'Sweden':               { region: 'ヨーロッパ',    flag: '🇸🇪', ja: 'スウェーデン' },
  'Norway':               { region: 'ヨーロッパ',    flag: '🇳🇴', ja: 'ノルウェー' },
  'Denmark':              { region: 'ヨーロッパ',    flag: '🇩🇰', ja: 'デンマーク' },
  'Finland':              { region: 'ヨーロッパ',    flag: '🇫🇮', ja: 'フィンランド' },
  'Netherlands':          { region: 'ヨーロッパ',    flag: '🇳🇱', ja: 'オランダ' },
  'Belgium':              { region: 'ヨーロッパ',    flag: '🇧🇪', ja: 'ベルギー' },
  'Switzerland':          { region: 'ヨーロッパ',    flag: '🇨🇭', ja: 'スイス' },
  'Austria':              { region: 'ヨーロッパ',    flag: '🇦🇹', ja: 'オーストリア' },
  'Poland':               { region: 'ヨーロッパ',    flag: '🇵🇱', ja: 'ポーランド' },
  'Russia':               { region: 'ヨーロッパ',    flag: '🇷🇺', ja: 'ロシア' },
  'Iceland':              { region: 'ヨーロッパ',    flag: '🇮🇸', ja: 'アイスランド' },
  'Ireland':              { region: 'ヨーロッパ',    flag: '🇮🇪', ja: 'アイルランド' },
  'Portugal':             { region: 'ヨーロッパ',    flag: '🇵🇹', ja: 'ポルトガル' },
  'Greece':               { region: 'ヨーロッパ',    flag: '🇬🇷', ja: 'ギリシャ' },
  'Ukraine':              { region: 'ヨーロッパ',    flag: '🇺🇦', ja: 'ウクライナ' },
  'Czechia':              { region: 'ヨーロッパ',    flag: '🇨🇿', ja: 'チェコ' },
  'Hungary':              { region: 'ヨーロッパ',    flag: '🇭🇺', ja: 'ハンガリー' },
  'Romania':              { region: 'ヨーロッパ',    flag: '🇷🇴', ja: 'ルーマニア' },
  'Japan':                { region: '日本',          flag: '🇯🇵', ja: '日本' },
  'South Korea':          { region: 'アジア',        flag: '🇰🇷', ja: '韓国' },
  'China':                { region: 'アジア',        flag: '🇨🇳', ja: '中国' },
  'India':                { region: 'アジア',        flag: '🇮🇳', ja: 'インド' },
  'Pakistan':             { region: 'アジア',        flag: '🇵🇰', ja: 'パキスタン' },
  'Indonesia':            { region: 'アジア',        flag: '🇮🇩', ja: 'インドネシア' },
  'Philippines':          { region: 'アジア',        flag: '🇵🇭', ja: 'フィリピン' },
  'Thailand':             { region: 'アジア',        flag: '🇹🇭', ja: 'タイ' },
  'Vietnam':              { region: 'アジア',        flag: '🇻🇳', ja: 'ベトナム' },
  'Malaysia':             { region: 'アジア',        flag: '🇲🇾', ja: 'マレーシア' },
  'Singapore':            { region: 'アジア',        flag: '🇸🇬', ja: 'シンガポール' },
  'Taiwan':               { region: 'アジア',        flag: '🇹🇼', ja: '台湾' },
  'Nigeria':              { region: 'アフリカ',      flag: '🇳🇬', ja: 'ナイジェリア' },
  'Ghana':                { region: 'アフリカ',      flag: '🇬🇭', ja: 'ガーナ' },
  'South Africa':         { region: 'アフリカ',      flag: '🇿🇦', ja: '南アフリカ' },
  'Senegal':              { region: 'アフリカ',      flag: '🇸🇳', ja: 'セネガル' },
  'Mali':                 { region: 'アフリカ',      flag: '🇲🇱', ja: 'マリ' },
  'Cameroon':             { region: 'アフリカ',      flag: '🇨🇲', ja: 'カメルーン' },
  'Ethiopia':             { region: 'アフリカ',      flag: '🇪🇹', ja: 'エチオピア' },
  'Kenya':                { region: 'アフリカ',      flag: '🇰🇪', ja: 'ケニア' },
  'Egypt':                { region: '中東・北アフリカ', flag: '🇪🇬', ja: 'エジプト' },
  'Algeria':              { region: '中東・北アフリカ', flag: '🇩🇿', ja: 'アルジェリア' },
  'Morocco':              { region: '中東・北アフリカ', flag: '🇲🇦', ja: 'モロッコ' },
  'Tunisia':              { region: '中東・北アフリカ', flag: '🇹🇳', ja: 'チュニジア' },
  'Lebanon':              { region: '中東・北アフリカ', flag: '🇱🇧', ja: 'レバノン' },
  'Israel':               { region: '中東・北アフリカ', flag: '🇮🇱', ja: 'イスラエル' },
  'Turkey':               { region: '中東・北アフリカ', flag: '🇹🇷', ja: 'トルコ' },
  'Iran':                 { region: '中東・北アフリカ', flag: '🇮🇷', ja: 'イラン' },
  'Australia':            { region: 'オセアニア',    flag: '🇦🇺', ja: 'オーストラリア' },
  'New Zealand':          { region: 'オセアニア',    flag: '🇳🇿', ja: 'ニュージーランド' },
  'Papua New Guinea':     { region: 'オセアニア',    flag: '🇵🇬', ja: 'パプアニューギニア' },
  'Fiji':                 { region: 'オセアニア',    flag: '🇫🇯', ja: 'フィジー' },
  // ── ヨーロッパ追加 ──
  'Scotland':             { region: 'ヨーロッパ',    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', ja: 'スコットランド' },
  'Wales':                { region: 'ヨーロッパ',    flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', ja: 'ウェールズ' },
  'England':              { region: 'ヨーロッパ',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', ja: 'イングランド' },
  'Serbia':               { region: 'ヨーロッパ',    flag: '🇷🇸', ja: 'セルビア' },
  'Croatia':              { region: 'ヨーロッパ',    flag: '🇭🇷', ja: 'クロアチア' },
  'Bulgaria':             { region: 'ヨーロッパ',    flag: '🇧🇬', ja: 'ブルガリア' },
  'Slovakia':             { region: 'ヨーロッパ',    flag: '🇸🇰', ja: 'スロバキア' },
  'Slovenia':             { region: 'ヨーロッパ',    flag: '🇸🇮', ja: 'スロベニア' },
  'Lithuania':            { region: 'ヨーロッパ',    flag: '🇱🇹', ja: 'リトアニア' },
  'Latvia':               { region: 'ヨーロッパ',    flag: '🇱🇻', ja: 'ラトビア' },
  'Estonia':              { region: 'ヨーロッパ',    flag: '🇪🇪', ja: 'エストニア' },
  'Belarus':              { region: 'ヨーロッパ',    flag: '🇧🇾', ja: 'ベラルーシ' },
  'Bosnia and Herzegovina': { region: 'ヨーロッパ', flag: '🇧🇦', ja: 'ボスニア・ヘルツェゴビナ' },
  'North Macedonia':      { region: 'ヨーロッパ',    flag: '🇲🇰', ja: '北マケドニア' },
  'Albania':              { region: 'ヨーロッパ',    flag: '🇦🇱', ja: 'アルバニア' },
  'Kosovo':               { region: 'ヨーロッパ',    flag: '🇽🇰', ja: 'コソボ' },
  'Montenegro':           { region: 'ヨーロッパ',    flag: '🇲🇪', ja: 'モンテネグロ' },
  'Georgia':              { region: 'ヨーロッパ',    flag: '🇬🇪', ja: 'ジョージア' },
  'Armenia':              { region: 'ヨーロッパ',    flag: '🇦🇲', ja: 'アルメニア' },
  'Azerbaijan':           { region: 'ヨーロッパ',    flag: '🇦🇿', ja: 'アゼルバイジャン' },
  'Kazakhstan':           { region: 'アジア',        flag: '🇰🇿', ja: 'カザフスタン' },
  'Luxembourg':           { region: 'ヨーロッパ',    flag: '🇱🇺', ja: 'ルクセンブルク' },
  // ── 中南米追加 ──
  'Bolivia':              { region: '中南米',        flag: '🇧🇴', ja: 'ボリビア' },
  'Ecuador':              { region: '中南米',        flag: '🇪🇨', ja: 'エクアドル' },
  'Paraguay':             { region: '中南米',        flag: '🇵🇾', ja: 'パラグアイ' },
  'Uruguay':              { region: '中南米',        flag: '🇺🇾', ja: 'ウルグアイ' },
  'Costa Rica':           { region: '中南米',        flag: '🇨🇷', ja: 'コスタリカ' },
  'Guatemala':            { region: '中南米',        flag: '🇬🇹', ja: 'グアテマラ' },
  'Honduras':             { region: '中南米',        flag: '🇭🇳', ja: 'ホンジュラス' },
  'El Salvador':          { region: '中南米',        flag: '🇸🇻', ja: 'エルサルバドル' },
  'Nicaragua':            { region: '中南米',        flag: '🇳🇮', ja: 'ニカラグア' },
  'Panama':               { region: '中南米',        flag: '🇵🇦', ja: 'パナマ' },
  'Haiti':                { region: '中南米',        flag: '🇭🇹', ja: 'ハイチ' },
  'Guyana':               { region: '中南米',        flag: '🇬🇾', ja: 'ガイアナ' },
  // ── アフリカ追加 ──
  'Tanzania':             { region: 'アフリカ',      flag: '🇹🇿', ja: 'タンザニア' },
  'Uganda':               { region: 'アフリカ',      flag: '🇺🇬', ja: 'ウガンダ' },
  'Zimbabwe':             { region: 'アフリカ',      flag: '🇿🇼', ja: 'ジンバブエ' },
  'Zambia':               { region: 'アフリカ',      flag: '🇿🇲', ja: 'ザンビア' },
  'Mozambique':           { region: 'アフリカ',      flag: '🇲🇿', ja: 'モザンビーク' },
  'Angola':               { region: 'アフリカ',      flag: '🇦🇴', ja: 'アンゴラ' },
  'Democratic Republic of the Congo': { region: 'アフリカ', flag: '🇨🇩', ja: 'コンゴ民主共和国' },
  'Republic of the Congo': { region: 'アフリカ',    flag: '🇨🇬', ja: 'コンゴ共和国' },
  "Ivory Coast":          { region: 'アフリカ',      flag: '🇨🇮', ja: 'コートジボワール' },
  'Rwanda':               { region: 'アフリカ',      flag: '🇷🇼', ja: 'ルワンダ' },
  'Burkina Faso':         { region: 'アフリカ',      flag: '🇧🇫', ja: 'ブルキナファソ' },
  'Guinea':               { region: 'アフリカ',      flag: '🇬🇳', ja: 'ギニア' },
  'Sudan':                { region: 'アフリカ',      flag: '🇸🇩', ja: 'スーダン' },
  'Madagascar':           { region: 'アフリカ',      flag: '🇲🇬', ja: 'マダガスカル' },
  'Mauritius':            { region: 'アフリカ',      flag: '🇲🇺', ja: 'モーリシャス' },
  'Cape Verde':           { region: 'アフリカ',      flag: '🇨🇻', ja: 'カーボベルデ' },
  'Togo':                 { region: 'アフリカ',      flag: '🇹🇬', ja: 'トーゴ' },
  'Benin':                { region: 'アフリカ',      flag: '🇧🇯', ja: 'ベナン' },
  'Sierra Leone':         { region: 'アフリカ',      flag: '🇸🇱', ja: 'シエラレオネ' },
  'Liberia':              { region: 'アフリカ',      flag: '🇱🇷', ja: 'リベリア' },
  // ── 中東追加 ──
  'Saudi Arabia':         { region: '中東・北アフリカ', flag: '🇸🇦', ja: 'サウジアラビア' },
  'United Arab Emirates': { region: '中東・北アフリカ', flag: '🇦🇪', ja: 'アラブ首長国連邦' },
  'Iraq':                 { region: '中東・北アフリカ', flag: '🇮🇶', ja: 'イラク' },
  'Jordan':               { region: '中東・北アフリカ', flag: '🇯🇴', ja: 'ヨルダン' },
  'Libya':                { region: '中東・北アフリカ', flag: '🇱🇾', ja: 'リビア' },
  'Kuwait':               { region: '中東・北アフリカ', flag: '🇰🇼', ja: 'クウェート' },
  'Qatar':                { region: '中東・北アフリカ', flag: '🇶🇦', ja: 'カタール' },
  'Oman':                 { region: '中東・北アフリカ', flag: '🇴🇲', ja: 'オマーン' },
  'Yemen':                { region: '中東・北アフリカ', flag: '🇾🇪', ja: 'イエメン' },
  'Palestine':            { region: '中東・北アフリカ', flag: '🇵🇸', ja: 'パレスチナ' },
  // ── アジア追加 ──
  'Hong Kong':            { region: 'アジア',        flag: '🇭🇰', ja: '香港' },
  'Bangladesh':           { region: 'アジア',        flag: '🇧🇩', ja: 'バングラデシュ' },
  'Sri Lanka':            { region: 'アジア',        flag: '🇱🇰', ja: 'スリランカ' },
  'Nepal':                { region: 'アジア',        flag: '🇳🇵', ja: 'ネパール' },
  'Myanmar':              { region: 'アジア',        flag: '🇲🇲', ja: 'ミャンマー' },
  'Cambodia':             { region: 'アジア',        flag: '🇰🇭', ja: 'カンボジア' },
  'Mongolia':             { region: 'アジア',        flag: '🇲🇳', ja: 'モンゴル' },
  'Uzbekistan':           { region: 'アジア',        flag: '🇺🇿', ja: 'ウズベキスタン' },
  'Laos':                 { region: 'アジア',        flag: '🇱🇦', ja: 'ラオス' },
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

const COUNTRY_CONFIGS = [
  ['アメリカ',             'wd:Q30',   'United States'],
  ['カナダ',               'wd:Q16',   'Canada'],
  ['イギリス',             'wd:Q145',  'United Kingdom'],
  ['フランス',             'wd:Q142',  'France'],
  ['ドイツ',               'wd:Q183',  'Germany'],
  ['スウェーデン',         'wd:Q34',   'Sweden'],
  ['日本',                 'wd:Q17',   'Japan'],
  ['韓国',                 'wd:Q884',  'South Korea'],
  ['ブラジル',             'wd:Q155',  'Brazil'],
  ['オーストラリア',       'wd:Q408',  'Australia'],
  ['アルゼンチン',         'wd:Q414',  'Argentina'],
  ['イタリア',             'wd:Q38',   'Italy'],
  ['スペイン',             'wd:Q29',   'Spain'],
  ['ナイジェリア',         'wd:Q1033', 'Nigeria'],
  ['南アフリカ',           'wd:Q258',  'South Africa'],
  ['コロンビア',           'wd:Q739',  'Colombia'],
  ['メキシコ',             'wd:Q96',   'Mexico'],
  ['ジャマイカ',           'wd:Q766',  'Jamaica'],
  ['インド',               'wd:Q668',  'India'],
  ['キューバ',             'wd:Q241',  'Cuba'],
  ['ノルウェー',           'wd:Q20',   'Norway'],
  ['アイルランド',         'wd:Q27',   'Ireland'],
  ['オランダ',             'wd:Q55',   'Netherlands'],
  ['ポルトガル',           'wd:Q45',   'Portugal'],
  ['ポーランド',           'wd:Q36',   'Poland'],
  ['ニュージーランド',     'wd:Q664',  'New Zealand'],
  ['ガーナ',               'wd:Q117',  'Ghana'],
  ['セネガル',             'wd:Q1041', 'Senegal'],
  ['エジプト',             'wd:Q79',   'Egypt'],
  ['レバノン',             'wd:Q822',  'Lebanon'],
  ['トルコ',               'wd:Q43',   'Turkey'],
  ['プエルトリコ',         'wd:Q1183', 'Puerto Rico'],
  ['フィンランド',         'wd:Q33',   'Finland'],
  ['デンマーク',           'wd:Q35',   'Denmark'],
  ['ベルギー',             'wd:Q31',   'Belgium'],
  ['チリ',                 'wd:Q298',  'Chile'],
  ['中国',                 'wd:Q148',  'China'],
  ['台湾',                 'wd:Q865',  'Taiwan'],
  ['インドネシア',         'wd:Q252',  'Indonesia'],
  ['フィリピン',           'wd:Q928',  'Philippines'],
  ['タイ',                 'wd:Q869',  'Thailand'],
  ['ベトナム',             'wd:Q881',  'Vietnam'],
  ['マレーシア',           'wd:Q833',  'Malaysia'],
  ['シンガポール',         'wd:Q334',  'Singapore'],
  ['パキスタン',           'wd:Q843',  'Pakistan'],
  ['ロシア',               'wd:Q159',  'Russia'],
  ['スイス',               'wd:Q39',   'Switzerland'],
  ['オーストリア',         'wd:Q40',   'Austria'],
  ['アイスランド',         'wd:Q189',  'Iceland'],
  ['ウクライナ',           'wd:Q212',  'Ukraine'],
  ['チェコ',               'wd:Q213',  'Czechia'],
  ['ハンガリー',           'wd:Q28',   'Hungary'],
  ['ルーマニア',           'wd:Q218',  'Romania'],
  ['ギリシャ',             'wd:Q41',   'Greece'],
  ['ペルー',               'wd:Q419',  'Peru'],
  ['ベネズエラ',           'wd:Q717',  'Venezuela'],
  ['トリニダード・トバゴ', 'wd:Q754',  'Trinidad and Tobago'],
  ['ドミニカ共和国',       'wd:Q786',  'Dominican Republic'],
  ['バルバドス',           'wd:Q244',  'Barbados'],
  ['マリ',                 'wd:Q912',  'Mali'],
  ['カメルーン',           'wd:Q1009', 'Cameroon'],
  ['エチオピア',           'wd:Q115',  'Ethiopia'],
  ['ケニア',               'wd:Q114',  'Kenya'],
  ['アルジェリア',         'wd:Q262',  'Algeria'],
  ['モロッコ',             'wd:Q1028', 'Morocco'],
  ['チュニジア',           'wd:Q948',  'Tunisia'],
  ['イスラエル',           'wd:Q801',  'Israel'],
  ['イラン',               'wd:Q794',  'Iran'],
  // ── ヨーロッパ追加 ──
  ['スコットランド',       'wd:Q22',   'Scotland'],
  ['ウェールズ',           'wd:Q25',   'Wales'],
  ['イングランド',         'wd:Q21',   'England'],
  ['セルビア',             'wd:Q403',  'Serbia'],
  ['クロアチア',           'wd:Q224',  'Croatia'],
  ['ブルガリア',           'wd:Q219',  'Bulgaria'],
  ['スロバキア',           'wd:Q214',  'Slovakia'],
  ['スロベニア',           'wd:Q215',  'Slovenia'],
  ['リトアニア',           'wd:Q37',   'Lithuania'],
  ['ラトビア',             'wd:Q211',  'Latvia'],
  ['エストニア',           'wd:Q191',  'Estonia'],
  ['ベラルーシ',           'wd:Q184',  'Belarus'],
  ['ボスニア・ヘルツェゴビナ', 'wd:Q225', 'Bosnia and Herzegovina'],
  ['北マケドニア',         'wd:Q221',  'North Macedonia'],
  ['アルバニア',           'wd:Q222',  'Albania'],
  ['コソボ',               'wd:Q1246', 'Kosovo'],
  ['モンテネグロ',         'wd:Q236',  'Montenegro'],
  ['ジョージア',           'wd:Q230',  'Georgia'],
  ['アルメニア',           'wd:Q399',  'Armenia'],
  ['アゼルバイジャン',     'wd:Q227',  'Azerbaijan'],
  ['カザフスタン',         'wd:Q232',  'Kazakhstan'],
  ['ルクセンブルク',       'wd:Q32',   'Luxembourg'],
  // ── 中南米追加 ──
  ['ボリビア',             'wd:Q750',  'Bolivia'],
  ['エクアドル',           'wd:Q736',  'Ecuador'],
  ['パラグアイ',           'wd:Q733',  'Paraguay'],
  ['ウルグアイ',           'wd:Q77',   'Uruguay'],
  ['コスタリカ',           'wd:Q800',  'Costa Rica'],
  ['グアテマラ',           'wd:Q774',  'Guatemala'],
  ['ホンジュラス',         'wd:Q783',  'Honduras'],
  ['エルサルバドル',       'wd:Q792',  'El Salvador'],
  ['ニカラグア',           'wd:Q811',  'Nicaragua'],
  ['パナマ',               'wd:Q804',  'Panama'],
  ['ハイチ',               'wd:Q790',  'Haiti'],
  ['ガイアナ',             'wd:Q734',  'Guyana'],
  // ── アフリカ追加 ──
  ['タンザニア',           'wd:Q924',  'Tanzania'],
  ['ウガンダ',             'wd:Q1036', 'Uganda'],
  ['ジンバブエ',           'wd:Q954',  'Zimbabwe'],
  ['ザンビア',             'wd:Q953',  'Zambia'],
  ['モザンビーク',         'wd:Q1029', 'Mozambique'],
  ['アンゴラ',             'wd:Q916',  'Angola'],
  ['コンゴ民主共和国',     'wd:Q974',  'Democratic Republic of the Congo'],
  ['コンゴ共和国',         'wd:Q971',  'Republic of the Congo'],
  ['コートジボワール',     'wd:Q1008', "Ivory Coast"],
  ['ルワンダ',             'wd:Q1037', 'Rwanda'],
  ['ブルキナファソ',       'wd:Q965',  'Burkina Faso'],
  ['ギニア',               'wd:Q1006', 'Guinea'],
  ['スーダン',             'wd:Q1049', 'Sudan'],
  ['マダガスカル',         'wd:Q1019', 'Madagascar'],
  ['モーリシャス',         'wd:Q1027', 'Mauritius'],
  ['カーボベルデ',         'wd:Q1011', 'Cape Verde'],
  ['トーゴ',               'wd:Q945',  'Togo'],
  ['ベナン',               'wd:Q962',  'Benin'],
  ['シエラレオネ',         'wd:Q1044', 'Sierra Leone'],
  ['リベリア',             'wd:Q1014', 'Liberia'],
  // ── 中東追加 ──
  ['サウジアラビア',       'wd:Q851',  'Saudi Arabia'],
  ['アラブ首長国連邦',     'wd:Q878',  'United Arab Emirates'],
  ['イラク',               'wd:Q796',  'Iraq'],
  ['ヨルダン',             'wd:Q810',  'Jordan'],
  ['リビア',               'wd:Q1016', 'Libya'],
  ['クウェート',           'wd:Q817',  'Kuwait'],
  ['カタール',             'wd:Q846',  'Qatar'],
  ['オマーン',             'wd:Q842',  'Oman'],
  ['イエメン',             'wd:Q805',  'Yemen'],
  ['パレスチナ',           'wd:Q23792','Palestine'],
  // ── アジア追加 ──
  ['香港',                 'wd:Q8646', 'Hong Kong'],
  ['バングラデシュ',       'wd:Q902',  'Bangladesh'],
  ['スリランカ',           'wd:Q854',  'Sri Lanka'],
  ['ネパール',             'wd:Q837',  'Nepal'],
  ['ミャンマー',           'wd:Q836',  'Myanmar'],
  ['カンボジア',           'wd:Q424',  'Cambodia'],
  ['モンゴル',             'wd:Q711',  'Mongolia'],
  ['ウズベキスタン',       'wd:Q265',  'Uzbekistan'],
  ['ラオス',               'wd:Q819',  'Laos'],
  // ── オセアニア追加 ──
  ['パプアニューギニア',   'wd:Q691',  'Papua New Guinea'],
  ['フィジー',             'wd:Q712',  'Fiji'],
];

// ── 進捗管理 ──────────────────────────────────────────────────────────────────
function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return {};
}

function saveProgress(progress) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function getCountryProgress(progress, enLabel) {
  if (!progress[enLabel]) {
    progress[enLabel] = { soloOffset: 0, bandOffset: 0, soloDone: false, bandDone: false };
  }
  // 年代分割対象国：soloYearOffsets を初期化 or 新キー追加
  if (YEAR_SPLIT_COUNTRIES.has(enLabel)) {
    if (!progress[enLabel].soloYearOffsets) {
      progress[enLabel].soloYearOffsets = {};
    }
    const yo = progress[enLabel].soloYearOffsets;
    for (const { key } of YEAR_RANGES) {
      if (!yo[key]) {
        yo[key] = { offset: 0, done: false };
      }
    }
    // 旧レンジ（細分化前）は done 扱いにして新レンジに切り替え
    const obsoleteKeys = ['pre1940', '1960s', '1970s'];
    for (const k of obsoleteKeys) {
      if (yo[k] && !yo[k].done) {
        yo[k] = { offset: yo[k].offset, done: true }; // 旧レンジを完了扱い
      }
    }
    progress[enLabel].soloDone = false;
  }
  return progress[enLabel];
}

// ── ユーティリティ ────────────────────────────────────────────────────────────
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

// ── SPARQL クエリ ─────────────────────────────────────────────────────────────
async function sparqlQuery(query, retries = 3) {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'ArtistDiscoveryApp/1.0 (educational music app)',
          'Accept': 'application/sparql-results+json',
        },
        signal: AbortSignal.timeout(60000),
      });
      if (res.status === 429) {
        const waitMs = 10000 * (attempt + 1); // 10s, 20s, 30s
        process.stdout.write(`[429 wait ${waitMs/1000}s] `);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      if (!res.ok) return { error: `HTTP ${res.status}`, rows: [] };
      const json = await res.json();
      return { error: null, rows: json.results?.bindings ?? [] };
    } catch (e) {
      if (attempt < retries && e.name === 'TimeoutError') {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      return { error: e.message, rows: [] };
    }
  }
  return { error: 'HTTP 429', rows: [] };
}

// 年代絞り込みソロクエリ（年代分割対象国用）
function buildSoloYearQuery(countryId, minYear, maxYear, offset = 0, minLinks = 1) {
  let yearFilter;
  if (minYear && maxYear) yearFilter = `FILTER(?year >= ${minYear} && ?year < ${maxYear})`;
  else if (minYear)       yearFilter = `FILTER(?year >= ${minYear})`;
  else                    yearFilter = `FILTER(?year < ${maxYear})`;

  return `
SELECT DISTINCT ?artist ?artistLabel ?jaLabel ?genreLabel ?year WHERE {
  ?artist wdt:P31 wd:Q5 ;
          wdt:P27 ${countryId} ;
          wdt:P136 ?genre .
  ?artist wdt:P569 ?birth . BIND(YEAR(?birth) AS ?year)
  ${yearFilter}
  OPTIONAL { ?artist rdfs:label ?jaLabel . FILTER(LANG(?jaLabel) = "ja") }
  ?artist wikibase:sitelinks ?links .
  FILTER(?links >= ${minLinks})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY ?artist
LIMIT ${PAGE_SIZE}
OFFSET ${offset}`.trim();
}

// 誕生日なしソロクエリ（年代分割の "noBirth" レンジ用）
function buildSoloNoBirthQuery(countryId, offset = 0, minLinks = 1) {
  return `
SELECT DISTINCT ?artist ?artistLabel ?jaLabel ?genreLabel WHERE {
  ?artist wdt:P31 wd:Q5 ;
          wdt:P27 ${countryId} ;
          wdt:P136 ?genre .
  FILTER NOT EXISTS { ?artist wdt:P569 [] }
  OPTIONAL { ?artist rdfs:label ?jaLabel . FILTER(LANG(?jaLabel) = "ja") }
  ?artist wikibase:sitelinks ?links .
  FILTER(?links >= ${minLinks})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY ?artist
LIMIT ${PAGE_SIZE}
OFFSET ${offset}`.trim();
}

// ORDER BY ?artist で順序を固定 → OFFSET が確実に機能する
function buildSoloQuery(countryId, offset = 0, minLinks = 1) {
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
ORDER BY ?artist
LIMIT ${PAGE_SIZE}
OFFSET ${offset}`.trim();
}

function buildBandQuery(countryId, offset = 0, minLinks = 1) {
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
ORDER BY ?artist
LIMIT ${PAGE_SIZE}
OFFSET ${offset}`.trim();
}

// ── データ変換 ────────────────────────────────────────────────────────────────
function processRows(rows, countryName) {
  const map = new Map();
  const countryInfo = COUNTRY_MAP[countryName];
  if (!countryInfo) return [];

  for (const row of rows) {
    const name = row.artistLabel?.value;
    const jaLabel = row.jaLabel?.value;
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
        nameJa: jaLabel || name,
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

function loadExisting() {
  const p = path.join(__dirname, '../artist-app/src/data/artists.ts');
  const content = fs.readFileSync(p, 'utf-8');
  const names = new Set([...content.matchAll(/name:\s*"((?:[^"\\]|\\.)*)"/g)].map(m =>
    m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\').toLowerCase()
  ));
  const ids = new Set([...content.matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]));
  return { names, ids };
}

// ── メイン ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎵 Wikidata アーティストデータ取得開始（OFFSETページネーション版）\n');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const existing = loadExisting();
  console.log(`既存: ${existing.names.size} 件`);

  const progress = loadProgress();
  const totalCountries = COUNTRY_CONFIGS.length;
  const doneCountries = COUNTRY_CONFIGS.filter(([,, en]) => {
    const p = progress[en];
    return p && p.soloDone && p.bandDone;
  }).length;
  console.log(`進捗: ${doneCountries}/${totalCountries} 国完了\n`);

  const allNew = [];
  const seenNames = new Set([...existing.names]);
  const seenIds   = new Set([...existing.ids]);

  for (const [jaLabel, wdId, enLabel] of COUNTRY_CONFIGS) {
    const cp = getCountryProgress(progress, enLabel);

    // 両方完了済みの国はスキップ
    if (cp.soloDone && cp.bandDone) {
      process.stdout.write(`  ${jaLabel} ✅ 完了済みスキップ\n`);
      continue;
    }

    process.stdout.write(`  ${jaLabel} (${enLabel}) `);
    if (YEAR_SPLIT_COUNTRIES.has(enLabel) && cp.soloYearOffsets) {
      const doneRanges = YEAR_RANGES.filter(r => cp.soloYearOffsets[r.key]?.done).length;
      process.stdout.write(`[solo:年代別 ${doneRanges}/${YEAR_RANGES.length}レンジ band:${cp.bandDone ? '✅' : `offset=${cp.bandOffset}`}] ... `);
    } else {
      process.stdout.write(`[solo:${cp.soloDone ? '✅' : `offset=${cp.soloOffset}`} band:${cp.bandDone ? '✅' : `offset=${cp.bandOffset}`}] ... `);
    }

    // ソロクエリ
    let soloRows = [];
    if (!cp.soloDone) {
      if (YEAR_SPLIT_COUNTRIES.has(enLabel)) {
        // ── 年代分割クエリ（USAなど大国） ──────────────────────────
        const yearOffsets = cp.soloYearOffsets;
        for (const range of YEAR_RANGES) {
          const rp = yearOffsets[range.key];
          if (rp.done) continue;

          const query = range.noBirth
            ? buildSoloNoBirthQuery(wdId, rp.offset)
            : buildSoloYearQuery(wdId, range.minYear, range.maxYear, rp.offset);

          const res = await sparqlQuery(query);
          if (res.error) {
            process.stdout.write(`[solo:${range.key}:timeout] `);
          } else {
            soloRows.push(...res.rows);
            if (res.rows.length < PAGE_SIZE) {
              rp.done = true;
            } else {
              rp.offset += PAGE_SIZE;
            }
          }
          // レンジ間に少し待機
          await new Promise(r => setTimeout(r, 800));
        }
        // 全レンジ完了チェック
        if (YEAR_RANGES.every(r => yearOffsets[r.key].done)) {
          cp.soloDone = true;
        }
      } else {
        // ── 通常OFFSETクエリ ────────────────────────────────────────
        const soloRes = await sparqlQuery(buildSoloQuery(wdId, cp.soloOffset));
        if (soloRes.error) {
          process.stdout.write(`[solo:${soloRes.error}] `);
        } else {
          soloRows = soloRes.rows;
          if (soloRows.length < PAGE_SIZE) {
            cp.soloDone = true;
          } else {
            cp.soloOffset += PAGE_SIZE;
          }
        }
      }
    }

    // バンドクエリ
    let bandRows = [];
    if (!cp.bandDone) {
      const bandRes = await sparqlQuery(buildBandQuery(wdId, cp.bandOffset));
      if (bandRes.error) {
        process.stdout.write(`[band:${bandRes.error}] `);
      } else {
        bandRows = bandRes.rows;
        if (bandRows.length < PAGE_SIZE) {
          cp.bandDone = true;
        } else {
          cp.bandOffset += PAGE_SIZE;
        }
      }
    }

    const converted = processRows([...soloRows, ...bandRows], enLabel);
    const deduped = converted.filter(a =>
      !seenNames.has(a.name.toLowerCase()) && !seenIds.has(a.id)
    );
    deduped.forEach(a => {
      seenNames.add(a.name.toLowerCase());
      seenIds.add(a.id);
    });
    allNew.push(...deduped);

    let statusSolo;
    if (YEAR_SPLIT_COUNTRIES.has(enLabel) && cp.soloYearOffsets) {
      const doneRanges = YEAR_RANGES.filter(r => cp.soloYearOffsets[r.key]?.done).length;
      statusSolo = cp.soloDone ? '✅完了' : `年代別 ${doneRanges}/${YEAR_RANGES.length}レンジ`;
    } else {
      statusSolo = cp.soloDone ? '✅完了' : `→offset ${cp.soloOffset}`;
    }
    const statusBand = cp.bandDone ? '✅完了' : `→offset ${cp.bandOffset}`;
    console.log(`${deduped.length} 件追加 (solo:${soloRows.length}件 ${statusSolo} / band:${bandRows.length}件 ${statusBand})`);

    // 進捗保存（1カ国ごと）
    saveProgress(progress);

    // レート制限対策
    await new Promise(r => setTimeout(r, 1500));
  }

  // ── 出力 ──
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

  // ── サマリー ──
  const byRegion = {};
  for (const a of allNew) byRegion[a.region] = (byRegion[a.region] ?? 0) + 1;

  const newDoneCount = COUNTRY_CONFIGS.filter(([,, en]) => {
    const p = progress[en];
    return p && p.soloDone && p.bandDone;
  }).length;

  console.log('\n── 完了 ──────────────────────────');
  for (const [r, n] of Object.entries(byRegion).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${r}: ${n} 件`);
  }
  console.log(`  合計: ${allNew.length} 件`);
  console.log(`\n国別完了状況: ${newDoneCount}/${totalCountries} 国`);
  if (newDoneCount === totalCountries) {
    console.log('🎉 全国取得完了！');
  } else {
    console.log(`📋 残り ${totalCountries - newDoneCount} 国（次回実行で続きから自動再開）`);
  }
}

main().catch(console.error);
