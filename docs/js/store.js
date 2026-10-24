// =============================================
// ローカル保存（localStorage）
// - ライダー登録簿: ttt.riders.v1
// - シミュレーターの状態: ttt.simulator.v1
// サーバーは使わない。全てこのブラウザ内に保存される。
// =============================================
import { SAMPLE_RIDERS, DEFAULT_FRAME_ID, DEFAULT_WHEEL_ID } from './data.js';

const RIDERS_KEY = 'ttt.riders.v1';
const SIM_KEY = 'ttt.simulator.v1';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存に失敗しても画面の操作は続行できるようにする
  }
}

let uidSeed = Date.now();
export function nextId() {
  uidSeed += 1;
  return uidSeed;
}

// ---- ライダー登録簿 ----
export function loadRiders() {
  const saved = readJson(RIDERS_KEY);
  if (Array.isArray(saved)) return saved;
  const seed = SAMPLE_RIDERS.map((r) => ({ ...r }));
  writeJson(RIDERS_KEY, seed);
  return seed;
}

export function saveRiders(riders) {
  writeJson(RIDERS_KEY, riders);
}

export function findRider(riders, id) {
  return riders.find((r) => r.id === Number(id)) ?? null;
}

// ---- シミュレーター状態 ----
export function defaultSimState() {
  return {
    courseId: 1, // Tempus Fugit
    frameId: DEFAULT_FRAME_ID,
    wheelId: DEFAULT_WHEEL_ID,
    // lineup の要素: { riderId } = 登録簿への参照 / { guest: {...} } = その場限りのゲスト
    lineup: SAMPLE_RIDERS.map((r) => ({ riderId: r.id })),
    pullSec: 30,
    pullPct: 110,
    dropPct: 95,
    mode: 'predict', // 'predict' | 'target'
    targetMin: 25,
    targetSec: 0,
  };
}

export function loadSimState() {
  const saved = readJson(SIM_KEY);
  if (saved && typeof saved === 'object') return { ...defaultSimState(), ...saved };
  return defaultSimState();
}

export function saveSimState(state) {
  writeJson(SIM_KEY, state);
}
