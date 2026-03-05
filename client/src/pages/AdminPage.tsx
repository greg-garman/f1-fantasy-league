import { useState, useEffect } from 'react';
import {
  syncSeason,
  seedDrivers,
  unlockRace,
  syncRace,
  scoreRace,
  adjustScore,
  setMatchups as apiSetMatchups,
  updateSettings,
  generateInvite,
  resetPassword,
  getRaces,
  getStandings,
  getDrivers,
  getSettings,
} from '../api/client';
import type { F1Race, F1Driver, StandingsEntry } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';

type Tab = 'sync' | 'score' | 'matchups' | 'settings';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('sync');
  const [races, setRaces] = useState<F1Race[]>([]);
  const [driversList, setDriversList] = useState<F1Driver[]>([]);
  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      getRaces().catch(() => []),
      getDrivers().catch(() => []),
      getStandings().catch(() => []),
      getSettings().catch(() => ({})),
    ]).then(([r, d, s, st]) => {
      setRaces(r);
      setDriversList(d);
      setStandings(s);
      setSettings(st);
    }).finally(() => setLoading(false));
  }, []);

  const showMsg = (m: string) => { setMessage(m); setError(''); setTimeout(() => setMessage(''), 4000); };
  const showErr = (e: string) => { setError(e); setMessage(''); };

  /* Sync */
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncRaceId, setSyncRaceId] = useState('');
  const [syncingOne, setSyncingOne] = useState(false);
  const [unlockRaceId, setUnlockRaceId] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const [seeding, setSeeding] = useState(false);

  const handleSyncSeason = async () => {
    setSyncingAll(true);
    try { const r = await syncSeason(); showMsg(r.message); } catch (e: unknown) { showErr(e instanceof Error ? e.message : 'Sync failed'); }
    setSyncingAll(false);
  };

  const handleSeedDrivers = async () => {
    setSeeding(true);
    try { const r = await seedDrivers(); showMsg(r.message); } catch (e: unknown) { showErr(e instanceof Error ? e.message : 'Seed failed'); }
    setSeeding(false);
  };

  const handleSyncRace = async () => {
    if (!syncRaceId) return;
    setSyncingOne(true);
    try { const r = await syncRace(Number(syncRaceId)); showMsg(r.message); } catch (e: unknown) { showErr(e instanceof Error ? e.message : 'Sync failed'); }
    setSyncingOne(false);
  };

  const handleUnlockRace = async () => {
    if (!unlockRaceId) return;
    setUnlocking(true);
    try { const r = await unlockRace(Number(unlockRaceId)); showMsg(r.message); } catch (e: unknown) { showErr(e instanceof Error ? e.message : 'Unlock failed'); }
    setUnlocking(false);
  };

  /* Score */
  const [scoreRaceId, setScoreRaceId] = useState('');
  const [scoring, setScoring] = useState(false);
  const [adjUserId, setAdjUserId] = useState('');
  const [adjRaceId, setAdjRaceId] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const handleScoreRace = async () => {
    if (!scoreRaceId) return;
    setScoring(true);
    try { const r = await scoreRace(Number(scoreRaceId)); showMsg(r.message); } catch (e: unknown) { showErr(e instanceof Error ? e.message : 'Scoring failed'); }
    setScoring(false);
  };

  const handleAdjust = async () => {
    if (!adjUserId || !adjRaceId || !adjAmount) return;
    setAdjusting(true);
    try {
      const r = await adjustScore(Number(adjUserId), Number(adjRaceId), Number(adjAmount));
      showMsg(r.message);
    } catch (e: unknown) { showErr(e instanceof Error ? e.message : 'Adjustment failed'); }
    setAdjusting(false);
  };

  /* Matchups */
  const [matchupRaceId, setMatchupRaceId] = useState('');
  const [driverA, setDriverA] = useState('');
  const [driverB, setDriverB] = useState('');
  const [settingMatchups, setSettingMatchups] = useState(false);

  const handleSetMatchups = async () => {
    if (!matchupRaceId || !driverA || !driverB) return;
    setSettingMatchups(true);
    try {
      const r = await apiSetMatchups(Number(matchupRaceId), [{ driverA, driverB }]);
      showMsg(r.message);
    } catch (e: unknown) { showErr(e instanceof Error ? e.message : 'Failed'); }
    setSettingMatchups(false);
  };

  /* Settings */
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => { setEditSettings(settings); }, [settings]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const updated = await updateSettings(editSettings);
      setSettings(updated);
      showMsg('Settings updated');
    } catch (e: unknown) { showErr(e instanceof Error ? e.message : 'Save failed'); }
    setSavingSettings(false);
  };

  /* Password Reset */
  const [resetUserId, setResetUserId] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleResetPassword = async () => {
    if (!resetUserId || !resetNewPassword) return;
    setResetting(true);
    try {
      const r = await resetPassword(Number(resetUserId), resetNewPassword);
      showMsg(r.message);
      setResetNewPassword('');
    } catch (e: unknown) { showErr(e instanceof Error ? e.message : 'Reset failed'); }
    setResetting(false);
  };

  const handleGenerateInvite = async () => {
    try {
      const r = await generateInvite();
      setInviteCode(r.invite_code);
      showMsg(`New invite code: ${r.invite_code}`);
    } catch (e: unknown) { showErr(e instanceof Error ? e.message : 'Failed'); }
  };

  if (loading) return <Spinner />;

  const raceSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.875rem' }}>
      <option value="">Select race...</option>
      {races.map((r) => (
        <option key={r.id} value={r.id}>R{r.round} - {r.race_name}</option>
      ))}
    </select>
  );

  return (
    <div className="page">
      <h1 className="page__title">Admin Panel</h1>

      {message && <div style={{ background: 'rgba(124,167,133,0.15)', color: '#3E6B47', padding: '0.6rem 0.75rem', borderRadius: '4px', fontSize: '0.875rem', marginBottom: '1rem' }}>{message}</div>}
      {error && <div className="login-card__error mb-1">{error}</div>}

      <div className="admin-tabs">
        {(['sync', 'score', 'matchups', 'settings'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`admin-tabs__tab ${tab === t ? 'admin-tabs__tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'sync' ? 'Sync' : t === 'score' ? 'Scoring' : t === 'matchups' ? 'Matchups' : 'Settings'}
          </button>
        ))}
      </div>

      {/* SYNC TAB */}
      {tab === 'sync' && (
        <>
          <div className="admin-section">
            <div className="admin-section__title">Sync Season Data</div>
            <Button variant="primary" disabled={syncingAll} onClick={handleSyncSeason}>
              {syncingAll ? 'Syncing...' : 'Sync Full Season'}
            </Button>
          </div>
          <div className="admin-section">
            <div className="admin-section__title">Seed 2026 Drivers</div>
            <p className="text-gray mb-1" style={{ fontSize: '0.8125rem' }}>Load the official 2026 F1 Fantasy driver list with correct prices. This will replace all existing driver data.</p>
            <Button variant="danger" disabled={seeding} onClick={handleSeedDrivers}>
              {seeding ? 'Seeding...' : 'Seed 2026 Drivers'}
            </Button>
          </div>
          <div className="admin-section">
            <div className="admin-section__title">Sync Specific Race</div>
            <div className="flex gap-1 items-center">
              {raceSelect(syncRaceId, setSyncRaceId)}
              <Button variant="secondary" size="small" disabled={syncingOne || !syncRaceId} onClick={handleSyncRace}>
                {syncingOne ? 'Syncing...' : 'Sync Race'}
              </Button>
            </div>
          </div>
          <div className="admin-section">
            <div className="admin-section__title">Unlock Race Picks</div>
            <div className="flex gap-1 items-center">
              {raceSelect(unlockRaceId, setUnlockRaceId)}
              <Button variant="danger" size="small" disabled={unlocking || !unlockRaceId} onClick={handleUnlockRace}>
                {unlocking ? 'Unlocking...' : 'Unlock Picks'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* SCORING TAB */}
      {tab === 'score' && (
        <>
          <div className="admin-section">
            <div className="admin-section__title">Score a Race</div>
            <div className="flex gap-1 items-center">
              {raceSelect(scoreRaceId, setScoreRaceId)}
              <Button variant="primary" size="small" disabled={scoring || !scoreRaceId} onClick={handleScoreRace}>
                {scoring ? 'Scoring...' : 'Score Race'}
              </Button>
            </div>
          </div>
          <div className="admin-section">
            <div className="admin-section__title">Manual Score Adjustment</div>
            <div className="flex flex-wrap gap-1">
              <select value={adjUserId} onChange={(e) => setAdjUserId(e.target.value)} style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.875rem' }}>
                <option value="">Select player...</option>
                {standings.map((s) => (
                  <option key={s.user_id} value={s.user_id}>{s.display_name}</option>
                ))}
              </select>
              {raceSelect(adjRaceId, setAdjRaceId)}
              <input
                type="number"
                placeholder="Points +/-"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                style={{ width: '100px', padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.875rem' }}
              />
              <Button variant="danger" size="small" disabled={adjusting} onClick={handleAdjust}>
                {adjusting ? '...' : 'Adjust'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* MATCHUPS TAB */}
      {tab === 'matchups' && (
        <div className="admin-section">
          <div className="admin-section__title">Set H2H Matchups</div>
          <div className="flex flex-wrap gap-1 mb-1">
            {raceSelect(matchupRaceId, setMatchupRaceId)}
          </div>
          <div className="flex flex-wrap gap-1 items-center">
            <select value={driverA} onChange={(e) => setDriverA(e.target.value)} style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.875rem' }}>
              <option value="">Driver A...</option>
              {driversList.map((d) => (
                <option key={d.driver_id} value={d.driver_id}>{d.code} - {d.first_name} {d.last_name}</option>
              ))}
            </select>
            <span className="text-gray font-bold">VS</span>
            <select value={driverB} onChange={(e) => setDriverB(e.target.value)} style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.875rem' }}>
              <option value="">Driver B...</option>
              {driversList.map((d) => (
                <option key={d.driver_id} value={d.driver_id}>{d.code} - {d.first_name} {d.last_name}</option>
              ))}
            </select>
            <Button variant="primary" size="small" disabled={settingMatchups} onClick={handleSetMatchups}>
              {settingMatchups ? '...' : 'Set Matchup'}
            </Button>
          </div>
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === 'settings' && (
        <>
          <Card title="League Settings">
            {Object.entries(editSettings).map(([key, value]) => (
              <div className="form-group" key={key}>
                <label>{key.replace(/_/g, ' ')}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setEditSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
            <Button variant="primary" disabled={savingSettings} onClick={handleSaveSettings}>
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </Button>
          </Card>

          <Card title="Invite Code">
            <Button variant="secondary" onClick={handleGenerateInvite}>Generate New Invite Code</Button>
            {inviteCode && (
              <p className="mt-1 font-bold text-gold" style={{ fontSize: '1.125rem', letterSpacing: '1px' }}>
                {inviteCode}
              </p>
            )}
          </Card>

          <Card title="Reset User Password">
            <div className="flex flex-wrap gap-1 items-center">
              <select value={resetUserId} onChange={(e) => setResetUserId(e.target.value)} style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.875rem' }}>
                <option value="">Select player...</option>
                {standings.map((s) => (
                  <option key={s.user_id} value={s.user_id}>{s.display_name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="New password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.875rem' }}
              />
              <Button variant="danger" size="small" disabled={resetting || !resetUserId || !resetNewPassword} onClick={handleResetPassword}>
                {resetting ? '...' : 'Reset Password'}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
