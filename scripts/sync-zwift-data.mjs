/**
 * sync-zwift-data.mjs
 *
 * zwift-data npm パッケージからデータを取得し、
 * D1 に投入する SQL ファイルを生成します。
 *
 * 出力: sync-output.sql
 *
 * 生成後の実行方法:
 *   npx wrangler d1 execute ttt-db --remote --file=scripts/sync-output.sql
 *
 * データソース: https://github.com/andipaetzold/zwift-data
 * - routes   : 距離・高度・ワールド完備
 * - frames   : 名前・タイプのみ（aero_score 等は ZwiftInsider 由来のため NULL）
 * - wheels   : 名前のみ（前輪と後輪を結合して 1件として扱う）
 */

import { bikeFrames, bikeFrontWheels, bikeRearWheels, routes } from 'zwift-data';
import { writeFileSync } from 'fs';

// ---- ユーティリティ ----

/** SQL インジェクション対策: シングルクォートをエスケープ */
function esc(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

/** NULL または数値を SQL 値として返す */
function num(v) {
  return v == null ? 'NULL' : v;
}

/** NULL または文字列を SQL 値として返す */
function str(v) {
  return v == null ? 'NULL' : `'${esc(String(v))}'`;
}

// ---- ルートのプロフィール近似 ----

/**
 * 距離・総獲得標高からシンプルな高度プロファイルを生成する。
 * 実際の Zwift コースプロファイルではなく概算値。
 * route_type に応じてプロフィール形状を変える:
 *   flat     : ほぼ平坦（±10m 程度）
 *   hilly    : 中央に山（elevation の 60% 程度）
 *   climbing : 後半に向かってじわじわ上る
 */
function generateProfile(distance_km, elevation_m, route_type) {
  const points = 10; // サンプル点数
  const profile = [];

  for (let i = 0; i <= points; i++) {
    const t = i / points; // 0.0 〜 1.0
    const d = Math.round(distance_km * t * 10) / 10;
    let alt = 0;

    if (route_type === 'flat') {
      // ほぼ平坦、微細なアップダウン
      alt = Math.round(elevation_m * 0.1 * Math.sin(t * Math.PI));
    } else if (route_type === 'hilly') {
      // 中央が高い山型
      alt = Math.round(elevation_m * 0.8 * Math.sin(t * Math.PI));
    } else {
      // climbing: 後半に向かって登る（ベル型を右にシフト）
      alt = Math.round(elevation_m * Math.pow(t, 0.6) * (1 - Math.pow(t - 1, 4)));
    }

    profile.push({ distance_km: d, altitude_m: Math.max(0, alt) });
  }

  return JSON.stringify(profile);
}

/** 獲得標高からルートタイプを推定 */
function inferRouteType(elevation_m, distance_km) {
  const grade = elevation_m / (distance_km * 10); // 平均勾配 %
  if (grade < 1.5) return 'flat';
  if (grade < 4.0) return 'hilly';
  return 'climbing';
}

/** ワールド名を表示用にフォーマット */
function formatWorld(world) {
  const map = {
    'watopia':        'Watopia',
    'london':         'London',
    'new-york':       'New York',
    'innsbruck':      'Innsbruck',
    'richmond':       'Richmond',
    'yorkshire':      'Yorkshire',
    'critcity':       'Crit City',
    'makuriislands':  'Makuri Islands',
    'france':         'France',
    'paris':          'Paris',
    'scotland':       'Scotland',
  };
  return map[world] ?? world;
}

// ---- SQL 生成 ----

const lines = [];

lines.push('-- =============================================');
lines.push('-- TTT Calculator - zwift-data 自動同期');
lines.push(`-- 生成日時: ${new Date().toISOString()}`);
lines.push('-- =============================================');
lines.push('');
lines.push('-- 既存の zwift-data 由来データを削除（再インポート）');
lines.push("DELETE FROM routes WHERE source_name = 'zwift-data';");
lines.push("DELETE FROM frames WHERE source_name = 'zwift-data';");
lines.push("DELETE FROM wheels WHERE source_name = 'zwift-data';");
lines.push('');

// ---- Routes ----
lines.push('-- ============ Routes ============');
const cyclingRoutes = routes.filter(r =>
  r.sports?.includes('cycling') && !r.eventOnly
);
console.log(`Routes: ${cyclingRoutes.length} 件（サイクリング・非イベント限定）`);

for (const r of cyclingRoutes) {
  const distance_km = Math.round(r.distance * 10) / 10;
  const elevation_m = Math.round(r.elevation ?? 0);
  const route_type  = inferRouteType(elevation_m, distance_km);
  const profile_json = generateProfile(distance_km, elevation_m, route_type);
  const world = formatWorld(r.world);
  const source_url = r.zwiftInsiderUrl ?? r.whatsOnZwiftUrl ?? null;

  lines.push(
    `INSERT INTO routes (name, world, distance_km, elevation_m, profile_points_json, route_type, source_name, source_url) VALUES ` +
    `(${str(r.name)}, ${str(world)}, ${num(distance_km)}, ${num(elevation_m)}, '${esc(profile_json)}', ${str(route_type)}, 'zwift-data', ${str(source_url)});`
  );
}

lines.push('');

// ---- Frames ----
lines.push('-- ============ Frames ============');
console.log(`Frames: ${bikeFrames.length} 件`);

for (const f of bikeFrames) {
  const bike_type = f.isTT ? 'tt' : 'road';
  lines.push(
    `INSERT INTO frames (name, bike_type, source_name, source_url) VALUES ` +
    `(${str(f.name)}, ${str(bike_type)}, 'zwift-data', 'https://github.com/andipaetzold/zwift-data');`
  );
}

lines.push('');

// ---- Wheels ----
// 前輪と後輪を name で紐付け（"Front Wheel" → "Rear Wheel" などの命名規則を利用）
// シンプル化のため前輪リストをベースに登録（後輪は同名のものがあれば統合）
lines.push('-- ============ Wheels ============');

// 前輪・後輪の名前マップ
const rearByName = new Map(bikeRearWheels.map(w => [w.name, w]));

// フロントホイール名から "Front" を除いてペアを特定
const processedWheels = new Set();
const wheelRows = [];

for (const fw of bikeFrontWheels) {
  const baseName = fw.name
    .replace(/ Front Wheel$/i, '')
    .replace(/ Front$/i, '')
    .trim();

  if (processedWheels.has(baseName)) continue;
  processedWheels.add(baseName);

  // 対応する後輪を探す（完全一致 or ベース名一致）
  const rearName = fw.name.replace(/Front/i, 'Rear');
  const hasRear  = rearByName.has(fw.name) || rearByName.has(rearName);

  wheelRows.push({
    name: baseName || fw.name,
    hasRear,
  });
}

// 後輪のみのものも追加
for (const rw of bikeRearWheels) {
  const baseName = rw.name
    .replace(/ Rear Wheel$/i, '')
    .replace(/ Rear$/i, '')
    .trim();
  if (processedWheels.has(baseName)) continue;
  processedWheels.add(baseName);
  wheelRows.push({ name: baseName || rw.name, hasRear: true });
}

console.log(`Wheels: ${wheelRows.length} 件（前後統合）`);

for (const w of wheelRows) {
  lines.push(
    `INSERT INTO wheels (name, source_name, source_url) VALUES ` +
    `(${str(w.name)}, 'zwift-data', 'https://github.com/andipaetzold/zwift-data');`
  );
}

lines.push('');
lines.push('-- 完了');

// ---- ファイル書き出し ----
const outputPath = 'scripts/sync-output.sql';
writeFileSync(outputPath, lines.join('\n'), 'utf8');

console.log(`\n✅ SQL 生成完了: ${outputPath}`);
console.log(`   Routes: ${cyclingRoutes.length} 件`);
console.log(`   Frames: ${bikeFrames.length} 件`);
console.log(`   Wheels: ${wheelRows.length} 件`);
console.log('\n次のコマンドで D1 に適用:');
console.log('  npx wrangler d1 execute ttt-db --remote --file=scripts/sync-output.sql');
