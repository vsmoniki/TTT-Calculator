// =============================================
// APIクライアント
// 全エンドポイントへのfetch関数をまとめる
// エラー時は { error: { code, message } } を throw する
// =============================================
import { API_BASE } from './config.js';

let authPassword = null;

export function setAuthPassword(password) {
  authPassword = password;
}

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (authPassword) {
    headers.Authorization = `Bearer ${authPassword}`;
  }
  return headers;
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: getHeaders(),
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    const err = data?.error ?? { code: 'UNKNOWN', message: `HTTP ${res.status}` };
    throw err;
  }
  return data;
}

const get  = (path)        => request('GET',    path);
const post = (path, body)  => request('POST',   path, body);
const put  = (path, body)  => request('PUT',    path, body);
const del  = (path)        => request('DELETE', path);

// ---- Routes ----
export const fetchRoutes    = ()   => get('/routes');
export const fetchRoute     = (id) => get(`/routes/${id}`);

// ---- Gear ----
export const fetchFrames    = ()   => get('/frames');
export const fetchWheels    = ()   => get('/wheels');

// ---- Riders ----
export const fetchRiders    = ()          => get('/riders');
export const createRider    = (body)      => post('/riders', body);
export const updateRider    = (id, body)  => put(`/riders/${id}`, body);
export const deleteRider    = (id)        => del(`/riders/${id}`);

// ---- Teams ----
export const fetchTeams     = ()          => get('/teams');
export const fetchTeam      = (id)        => get(`/teams/${id}`);
export const createTeam     = (body)      => post('/teams', body);
export const addTeamMember  = (teamId, body) => post(`/teams/${teamId}/members`, body);
export const removeTeamMember = (teamId, riderId) => del(`/teams/${teamId}/members/${riderId}`);

// ---- Lineups ----
export const fetchLineups   = ()          => get('/lineups');
export const createLineup   = (body)      => post('/lineups', body);
export const fetchLineup    = (id)        => get(`/lineups/${id}`);
export const updateLineup   = (id, body)  => put(`/lineups/${id}`, body);
export const addLineupMember    = (lineupId, body) => post(`/lineups/${lineupId}/members`, body);
export const updateLineupMember = (lineupId, memberId, body) => put(`/lineups/${lineupId}/members/${memberId}`, body);
export const removeLineupMember = (lineupId, memberId) => del(`/lineups/${lineupId}/members/${memberId}`);
export const swapLineupMembers  = (lineupId, aId, bId) => post(`/lineups/${lineupId}/members/swap`, { a_id: aId, b_id: bId });

// ---- Simulate ----
export const simulate = (body) => post('/simulate', body);

// ---- Auth ----
export const apiLogin = (password) => post('/auth', { password });
