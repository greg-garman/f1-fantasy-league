import type {
  User,
  F1Driver,
  F1Race,
  F1RaceResult,
  UserTeamEntry,
  Transfer,
  WeeklyPick,
  RaceScore,
  H2HMatchup,
  StandingsEntry,
} from '../types';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const TOKEN_KEY = 'f1_session_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/* ------------------------------------------------------------------ */
/*  Fetch wrapper                                                      */
/* ------------------------------------------------------------------ */

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.message || `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as unknown as T;

  return res.json();
}

function get<T>(path: string) {
  return request<T>(path);
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

function put<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

export async function login(username: string, password: string) {
  const data = await post<{ token: string; user: User }>('/auth/login', { username, password });
  setStoredToken(data.token);
  return data;
}

export async function register(username: string, password: string, displayName: string, inviteCode: string) {
  const data = await post<{ token: string; user: User }>('/auth/register', {
    username,
    password,
    displayName,
    inviteCode,
  });
  setStoredToken(data.token);
  return data;
}

export async function logout() {
  await post<void>('/auth/logout').catch(() => {});
  clearStoredToken();
}

export function getMe() {
  return get<{ user: User }>('/auth/me');
}

/* ------------------------------------------------------------------ */
/*  Drivers                                                            */
/* ------------------------------------------------------------------ */

export function getDrivers() {
  return get<{ drivers: F1Driver[] }>('/drivers').then(r => r.drivers);
}

export function getDriver(id: number) {
  return get<{ driver: F1Driver; priceHistory: unknown[] }>(`/drivers/${id}`).then(r => r.driver);
}

/* ------------------------------------------------------------------ */
/*  Races                                                              */
/* ------------------------------------------------------------------ */

export function getRaces() {
  return get<{ races: F1Race[] }>('/races').then(r => r.races ?? []);
}

export function getNextRace() {
  return get<{ race: F1Race | null }>('/races/next').then(r => r.race);
}

export function getRace(id: number) {
  return get<{ race: F1Race; results: F1RaceResult[] }>(`/races/${id}`).then(r => ({ ...r.race, results: r.results }));
}

export function getRaceScores(raceId: number) {
  return get<{ scores: RaceScore[] }>(`/races/${raceId}/scores`).then(r => r.scores);
}

/* ------------------------------------------------------------------ */
/*  Teams                                                              */
/* ------------------------------------------------------------------ */

export function getMyTeam() {
  return get<{ team: UserTeamEntry[]; budget: number }>('/teams/my');
}

export function updateTeam(slot: number, driverInId: string) {
  return put<{ team: UserTeamEntry[]; budget: number }>('/teams/my', {
    transfers: [{ slot, driverInId }],
  });
}

export function removeDriver(slot: number) {
  return del<{ team: UserTeamEntry[]; budget: number }>(`/teams/my/${slot}`);
}

export function getPlayerTeam(userId: number) {
  return get<{ team: UserTeamEntry[]; budget: number }>(`/teams/${userId}`);
}

export function getTransferLog() {
  return get<{ transfers: Transfer[] }>('/teams/transfers/log').then(r => r.transfers);
}

export function getRemainingTransfers() {
  return get<{ remaining: number }>('/teams/transfers/remaining');
}

/* ------------------------------------------------------------------ */
/*  Picks                                                              */
/* ------------------------------------------------------------------ */

export function submitPicks(
  raceId: number,
  picksList: Array<{ pick_type: string; pick_value: string }>,
) {
  // Transform array format into the named fields the server expects
  const body: Record<string, any> = {};
  const podiumValues: string[] = [];
  const constructorPodiumValues: string[] = [];

  for (const p of picksList) {
    switch (p.pick_type) {
      case 'pole': body.pole = p.pick_value; break;
      case 'winner': body.winner = p.pick_value; break;
      case 'fastest_lap': body.fastestLap = p.pick_value; break;
      case 'dnf': body.dnf = p.pick_value; break;
      case 'podium': podiumValues.push(p.pick_value); break;
      case 'constructor_podium': constructorPodiumValues.push(p.pick_value); break;
      case 'h2h': body.h2h = p.pick_value; break;
    }
  }
  if (podiumValues.length > 0) body.podium = podiumValues;
  if (constructorPodiumValues.length > 0) body.constructorPodium = constructorPodiumValues;

  return post<{ picks: WeeklyPick[] }>(`/picks/${raceId}`, body).then(r => r.picks);
}

export function getMyPicks(raceId: number) {
  return get<{ picks: Record<string, any>; raw: WeeklyPick[] }>(`/picks/${raceId}`).then(r => r.raw);
}

export function getAllPicks(raceId: number) {
  return get<{ picks: Record<string, any> }>(`/picks/${raceId}/all`).then(r => r.picks);
}

export function getMatchups(raceId: number) {
  return get<{ matchups: H2HMatchup[] }>(`/picks/${raceId}/matchups`).then(r => r.matchups);
}

/* ------------------------------------------------------------------ */
/*  Standings                                                          */
/* ------------------------------------------------------------------ */

export function getStandings() {
  return get<{ standings: StandingsEntry[] }>('/league/standings').then(r => r.standings);
}

export function getStandingsByRace(raceId: number) {
  return get<{ standings: RaceScore[] }>(`/league/standings/${raceId}`).then(r => r.standings);
}

export function getSettings() {
  return get<{ settings: Record<string, string> }>('/league/settings').then(r => r.settings);
}

/* ------------------------------------------------------------------ */
/*  Admin                                                              */
/* ------------------------------------------------------------------ */

export function syncSeason() {
  return post<{ message: string }>('/admin/sync-season');
}

export function seedDrivers() {
  return post<{ message: string }>('/admin/seed-drivers');
}

export function unlockRace(raceId: number) {
  return post<{ message: string }>(`/admin/unlock-race/${raceId}`);
}

export function syncRace(raceId: number) {
  return post<{ message: string }>(`/admin/sync-race/${raceId}`);
}

export function scoreRace(raceId: number) {
  return post<{ message: string }>(`/admin/score-race/${raceId}`);
}

export function adjustScore(
  userId: number,
  raceId: number,
  adjustment: number,
) {
  return put<{ message: string }>(`/admin/scores/${raceId}/${userId}`, {
    adjustment,
  });
}

export function setMatchups(
  raceId: number,
  matchups: Array<{ driverA: string; driverB: string }>,
) {
  return post<{ message: string }>(`/admin/matchups/${raceId}`, { matchups });
}

export async function updateSettings(settings: Record<string, string>) {
  for (const [key, value] of Object.entries(settings)) {
    await put<{ key: string; value: string }>('/admin/league-settings', { key, value });
  }
  // Return the full settings after updating
  return getSettings();
}

export function generateInvite() {
  return post<{ inviteCode: string }>('/admin/invite').then(r => ({ invite_code: r.inviteCode }));
}

export function resetPassword(userId: number, newPassword: string) {
  return post<{ message: string }>('/admin/reset-password', { userId, newPassword });
}

/* default namespace export */
const api = {
  login,
  register,
  logout,
  getMe,
  getDrivers,
  getDriver,
  getRaces,
  getNextRace,
  getRace,
  getRaceScores,
  getMyTeam,
  updateTeam,
  removeDriver,
  getPlayerTeam,
  getTransferLog,
  getRemainingTransfers,
  submitPicks,
  getMyPicks,
  getAllPicks,
  getMatchups,
  getStandings,
  getStandingsByRace,
  getSettings,
  syncSeason,
  seedDrivers,
  unlockRace,
  syncRace,
  scoreRace,
  adjustScore,
  setMatchups,
  updateSettings,
  generateInvite,
};
export default api;
