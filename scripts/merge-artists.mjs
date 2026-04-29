/**
 * scripts/output/new-artists.ts → artist-app/src/data/artists.ts マージスクリプト
 *
 * 使い方:
 *   node scripts/merge-artists.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTISTS_PATH = path.join(__dirname, '../artist-app/src/data/artists.ts');
const NEW_PATH = path.join(__dirname, 'output/new-artists.json');

function main() {
  if (!fs.existsSync(NEW_PATH)) {
    console.error('❌ scripts/output/new-artists.json が見つかりません。先に fetch-wikidata.mjs を実行してください。');
    process.exit(1);
  }

  const newArtists = JSON.parse(fs.readFileSync(NEW_PATH, 'utf-8'));
  const existing = fs.readFileSync(ARTISTS_PATH, 'utf-8');

  // 既存IDセット
  const existingIds = new Set([...existing.matchAll(/id:\s*["']([^"']+)["']/g)].map(m => m[1]));
  const existingNames = new Set([...existing.matchAll(/name:\s*["']([^"']+)["']/g)].map(m => m[1].toLowerCase()));

  const toAdd = newArtists.filter(a =>
    !existingIds.has(a.id) && !existingNames.has(a.name.toLowerCase())
  );

  if (toAdd.length === 0) {
    console.log('✅ 追加する新規アーティストはいません（すべて既存と重複）');
    return;
  }

  // 追加するTypeScript文字列
  const additions = toAdd.map(a => {
    const genres = JSON.stringify(a.genres);
    const eras = JSON.stringify(a.eras);
    return `  {
    id: "${a.id}",
    name: "${a.name.replace(/"/g, '\\"')}",
    nameJa: "${a.nameJa.replace(/"/g, '\\"')}",
    country: "${a.country}",
    countryFlag: "${a.countryFlag}",
    region: "${a.region}",
    genres: ${genres},
    eras: ${eras},
    description: "",
    color: "${a.color}",
  }`;
  }).join(',\n');

  // artists 配列の最後の ]; の直前に挿入
  const insertMarker = '];';
  const lastIdx = existing.lastIndexOf(insertMarker);

  if (lastIdx === -1) {
    console.error('❌ artists.ts の末尾 ]; が見つかりません。');
    process.exit(1);
  }

  const updated =
    existing.slice(0, lastIdx) +
    ',\n' +
    additions +
    '\n' +
    existing.slice(lastIdx);

  // バックアップ
  fs.writeFileSync(ARTISTS_PATH + '.bak', existing, 'utf-8');
  fs.writeFileSync(ARTISTS_PATH, updated, 'utf-8');

  console.log(`✅ ${toAdd.length} 件のアーティストを追加しました。`);
  console.log(`   バックアップ: artists.ts.bak`);

  // 地域別の内訳
  const byRegion = {};
  for (const a of toAdd) {
    byRegion[a.region] = (byRegion[a.region] ?? 0) + 1;
  }
  console.log('\n── 地域別 ──');
  for (const [r, n] of Object.entries(byRegion).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${r}: ${n} 件`);
  }
}

main();
