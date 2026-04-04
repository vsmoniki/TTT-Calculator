// =============================================
// TTT Calculator - Cloudflare Workers メインルーター
// =============================================
import { Env } from './types';
import { error, preflight, notFound } from './response';
import { listRoutes, getRoute } from './routes/routes';
import { listFrames } from './routes/frames';
import { listWheels } from './routes/wheels';
import { listRiders, createRider, updateRider, deleteRider } from './routes/riders';
import { listTeams, getTeam, createTeam, addTeamMember, removeTeamMember } from './routes/teams';
import {
  listLineups, createLineup, getLineup, updateLineup,
  addLineupMember, updateLineupMember, removeLineupMember, swapLineupMemberOrder,
} from './routes/lineups';
import { simulate } from './routes/simulate';
import { authLogin } from './routes/auth';
import { getWtrlSchedule } from './routes/schedule';

function isAuthorized(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  const expected = `Bearer ${env.SECRET_PASSWORD}`;
  return authHeader === expected;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORSプリフライト
    if (request.method === 'OPTIONS') return preflight();

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 認証エンドポイントは認証チェック不要
    if (path === '/auth' && method === 'POST') return authLogin(request, env);

    if (!isAuthorized(request, env)) {
      return error('UNAUTHORIZED', 'Unauthorized', 401);
    }

    // パスをセグメントに分割（先頭の / を除去）
    const segments = path.replace(/^\//, '').split('/');

    // ---- /routes ----
    if (segments[0] === 'routes') {
      if (segments.length === 1 && method === 'GET') return listRoutes(request, env);
      if (segments.length === 2 && method === 'GET') return getRoute(request, env, Number(segments[1]));
    }

    // ---- /frames ----
    if (segments[0] === 'frames' && segments.length === 1 && method === 'GET') {
      return listFrames(request, env);
    }

    // ---- /wheels ----
    if (segments[0] === 'wheels' && segments.length === 1 && method === 'GET') {
      return listWheels(request, env);
    }

    // ---- /riders ----
    if (segments[0] === 'riders') {
      if (segments.length === 1 && method === 'GET') return listRiders(request, env);
      if (segments.length === 1 && method === 'POST') return createRider(request, env);
      if (segments.length === 2 && method === 'PUT') return updateRider(request, env, Number(segments[1]));
      if (segments.length === 2 && method === 'DELETE') return deleteRider(request, env, Number(segments[1]));
    }

    // ---- /teams ----
    if (segments[0] === 'teams') {
      // GET /teams
      if (segments.length === 1 && method === 'GET') return listTeams(request, env);
      // POST /teams
      if (segments.length === 1 && method === 'POST') return createTeam(request, env);
      // GET /teams/:id
      if (segments.length === 2 && method === 'GET') return getTeam(request, env, Number(segments[1]));
      // POST /teams/:id/members
      if (segments.length === 3 && segments[2] === 'members' && method === 'POST') {
        return addTeamMember(request, env, Number(segments[1]));
      }
      // DELETE /teams/:id/members/:riderId
      if (segments.length === 4 && segments[2] === 'members' && method === 'DELETE') {
        return removeTeamMember(request, env, Number(segments[1]), Number(segments[3]));
      }
    }

    // ---- /lineups ----
    if (segments[0] === 'lineups') {
      // GET /lineups
      if (segments.length === 1 && method === 'GET') return listLineups(request, env);
      // POST /lineups
      if (segments.length === 1 && method === 'POST') return createLineup(request, env);
      // GET /lineups/:id
      if (segments.length === 2 && method === 'GET') return getLineup(request, env, Number(segments[1]));
      // PUT /lineups/:id
      if (segments.length === 2 && method === 'PUT') return updateLineup(request, env, Number(segments[1]));
      // POST /lineups/:id/members
      if (segments.length === 3 && segments[2] === 'members' && method === 'POST') {
        return addLineupMember(request, env, Number(segments[1]));
      }
      // PUT /lineups/:id/members/:memberId
      if (segments.length === 4 && segments[2] === 'members' && method === 'PUT') {
        return updateLineupMember(request, env, Number(segments[1]), Number(segments[3]));
      }
      // POST /lineups/:id/members/swap
      if (segments.length === 4 && segments[2] === 'members' && segments[3] === 'swap' && method === 'POST') {
        return swapLineupMemberOrder(request, env, Number(segments[1]));
      }
      // DELETE /lineups/:id/members/:memberId
      if (segments.length === 4 && segments[2] === 'members' && method === 'DELETE') {
        return removeLineupMember(request, env, Number(segments[1]), Number(segments[3]));
      }
    }


    // ---- /schedule ----
    if (segments[0] === 'schedule') {
      if (segments.length === 2 && segments[1] === 'wtrl-ttt' && method === 'GET') return getWtrlSchedule(request, env);
    }
    // ---- /simulate ----
    if (segments[0] === 'simulate' && segments.length === 1 && method === 'POST') {
      return simulate(request, env);
    }

    return notFound('Endpoint');
  },
};
