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
  return get<F1Driver[]>('/drivers');
}

export function getDriver(id: number) {
  return get<F1Driver>(`/drivers/${id}`);
}

/* ------------------------------------------------------------------ */
/*  Races                                                              */
/* ------------------------------------------------------------------ */

export function getRaces() {
  return get<F1Race[]>('/races');
}

export function getNextRace() {
  return get<F1Race>('/races/next');
}

export function getRace(id: number) {
  return get<F1Race & { results?: F1RaceResult[] }>(`/races/${id}`);
}

export function getRaceScores(raceId: number) {
  return get<RaceScore[]>(`/races/${raceId}/scores`);
}

/* ------------------------------------------------------------------ */
/*  Teams                                                              */
/* ------------------------------------------------------------------ */

export function getMyTeam() {
  return get<{ team: UserTeamEntry[]; budget: number }>('/teams/me');
}

export function updateTeam(driverInId: string, driverOutId: string | null) {
  return post<{ team: UserTeamEntry[]; budget: number }>('/teams/transfer', {
    driver_in_id: driverInId,
    driver_out_id: driverOutId,
  });
}

export function getPlayerTeam(userId: number) {
  return get<{ team: UserTeamEntry[]; budget: number }>(`/teams/${userId}`);
}

export function getTransferLog() {
  return get<Transfer[]>('/teams/transfers');
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
  return post<WeeklyPick[]>('/picks', { race_id: raceId, picks: picksList });
}

export function getMyPicks(raceId: number) {
  return get<WeeklyPick[]>(`/picks/me?race_id=${raceId}`);
}

export function getAllPicks(raceId: number) {
  return get<Record<string, WeeklyPick[]>>(`/picks/all?race_id=${raceId}`);
}

export function getMatchups(raceId: number) {
  return get<H2HMatchup[]>(`/picks/matchups?race_id=${raceId}`);
}

/* ------------------------------------------------------------------ */
/*  Standings                                                          */
/* ------------------------------------------------------------------ */

export function getStandings() {
  return get<StandingsEntry[]>('/standings');
}

export function getStandingsByRace(raceId: number) {
  return get<RaceScore[]>(`/standings/race/${raceId}`);
}

export function getSettings() {
  return get<Record<string, string>>('/settings');
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
  return post<{ message: string }>('/admin/adjust-score', {
    user_id: userId,
    race_id: raceId,
    adjustment,
  });
}

export function setMatchups(
  raceId: number,
  matchups: Array<{ driver_a_id: string; driver_b_id: string }>,
) {
  return post<{ message: string }>('/admin/matchups', { race_id: raceId, matchups });
}

export function updateSettings(settings: Record<string, string>) {
  return put<Record<string, string>>('/admin/settings', settings);
}

export function generateInvite() {
  return post<{ invite_code: string }>('/admin/generate-invite');
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
