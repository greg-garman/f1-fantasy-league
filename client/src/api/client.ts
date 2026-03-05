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

/* ------------------------------------------------------------------ */
/*  Fetch wrapper                                                      */
/* ------------------------------------------------------------------ */

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

export function login(username: string, password: string) {
  return post<{ user: User }>('/auth/login', { username, password });
}

export function register(username: string, password: string, displayName: string, inviteCode: string) {
  return post<{ user: User }>('/auth/register', {
    username,
    password,
    displayName,
    inviteCode,
  });
}

export function logout() {
  return post<void>('/auth/logout');
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
  return get<{ races: F1Race[] }>('/races').then(r => r.races);
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
  return post<{ picks: WeeklyPick[] }>('/picks', { race_id: raceId, picks: picksList }).then(r => r.picks);
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
  syncRace,
  scoreRace,
  adjustScore,
  setMatchups,
  updateSettings,
  generateInvite,
};
export default api;
