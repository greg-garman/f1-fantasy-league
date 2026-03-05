import { useState, useEffect } from 'react';
import { getNextRace, getMyPicks, getMatchups, getDrivers, submitPicks } from '../api/client';
import type { F1Race, F1Driver, WeeklyPick, H2HMatchup } from '../types';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import RaceCountdown from '../components/race/RaceCountdown';
import { parseRaceDateTime } from '../utils/date';

function getConstructors(driversList: F1Driver[]) {
  const set = new Set<string>();
  driversList.forEach((d) => set.add(d.constructor_name));
  return Array.from(set).sort();
}

export default function WeeklyPicksPage() {
  const { user } = useAuth();
  const [nextRace, setNextRace] = useState<F1Race | null>(null);
  const [driversList, setDriversList] = useState<F1Driver[]>([]);
  const [existingPicks, setExistingPicks] = useState<WeeklyPick[]>([]);
  const [matchups, setMatchups] = useState<H2HMatchup[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* form state - all picks stored as pick_value strings */
  const [pole, setPole] = useState('');
  const [winner, setWinner] = useState('');
  const [fastestLap, setFastestLap] = useState('');
  const [dnf, setDnf] = useState('');
  const [podium, setPodium] = useState<string[]>([]);
  const [constructorPodium, setConstructorPodium] = useState<string[]>([]);
  const [h2hPick, setH2hPick] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [nr, d] = await Promise.all([
          getNextRace().catch(() => null),
          getDrivers().catch(() => []),
        ]);
        setNextRace(nr);
        setDriversList(d.filter((dr) => dr.is_active));

        if (nr) {
          const [ep, m] = await Promise.all([
            getMyPicks(nr.id).catch(() => []),
            getMatchups(nr.id).catch(() => []),
          ]);
          setExistingPicks(ep);
          setMatchups(m);

          /* pre-fill from existing picks */
          ep.forEach((p) => {
            if (p.pick_type === 'pole') setPole(p.pick_value);
            if (p.pick_type === 'winner') setWinner(p.pick_value);
            if (p.pick_type === 'fastest_lap') setFastestLap(p.pick_value);
            if (p.pick_type === 'dnf') setDnf(p.pick_value);
            if (p.pick_type === 'podium') {
              setPodium((prev) => [...prev, p.pick_value]);
            }
            if (p.pick_type === 'constructor_podium') {
              setConstructorPodium((prev) => [...prev, p.pick_value]);
            }
            if (p.pick_type === 'h2h') setH2hPick(p.pick_value);
          });
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.id]);

  const isLocked = nextRace ? nextRace.picks_locked === 1 : true;
  const constructors = getConstructors(driversList);

  const togglePodium = (driverId: string) => {
    setPodium((prev) => {
      if (prev.includes(driverId)) return prev.filter((id) => id !== driverId);
      if (prev.length >= 3) return prev;
      return [...prev, driverId];
    });
  };

  const toggleConstructorPodium = (name: string) => {
    setConstructorPodium((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= 3) return prev;
      return [...prev, name];
    });
  };

  const handleSubmit = async () => {
    if (!nextRace) return;
    setSubmitting(true);
    setError('');
    setSuccess('');

    const picksList: Array<{ pick_type: string; pick_value: string }> = [];

    if (pole) picksList.push({ pick_type: 'pole', pick_value: pole });
    if (winner) picksList.push({ pick_type: 'winner', pick_value: winner });
    if (fastestLap) picksList.push({ pick_type: 'fastest_lap', pick_value: fastestLap });
    if (dnf) picksList.push({ pick_type: 'dnf', pick_value: dnf });
    podium.forEach((id) => picksList.push({ pick_type: 'podium', pick_value: id }));
    constructorPodium.forEach((c) => picksList.push({ pick_type: 'constructor_podium', pick_value: c }));
    if (h2hPick) picksList.push({ pick_type: 'h2h', pick_value: h2hPick });

    try {
      const result = await submitPicks(nextRace.id, picksList);
      setExistingPicks(result);
      setSuccess('Picks saved successfully!');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit picks');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;

  if (!nextRace) {
    return (
      <div className="page">
        <h1 className="page__title">Weekly Picks</h1>
        <p className="text-gray">No upcoming race found.</p>
      </div>
    );
  }

  /* Show results for completed picks */
  if (nextRace.status === 'completed' && existingPicks.length > 0) {
    return (
      <div className="page">
        <h1 className="page__title">Picks &mdash; {nextRace.race_name}</h1>
        <Card title="Your Pick Results">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Type</th><th>Pick</th><th>Result</th><th>Pts</th></tr>
              </thead>
              <tbody>
                {existingPicks.map((p) => (
                  <tr key={p.id}>
                    <td style={{ textTransform: 'capitalize' }}>{p.pick_type.replace('_', ' ')}</td>
                    <td>{p.pick_value}</td>
                    <td>
                      {p.is_correct === 1 && <Badge variant="green">Correct</Badge>}
                      {p.is_correct === 0 && <Badge variant="danger">Wrong</Badge>}
                      {p.is_correct === null && <Badge variant="gray">Pending</Badge>}
                    </td>
                    <td className="font-bold">{p.points_earned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  /* Locked state */
  if (isLocked) {
    return (
      <div className="page">
        <h1 className="page__title">Weekly Picks &mdash; {nextRace.race_name}</h1>
        <Card>
          <div className="pick-locked">
            <div className="pick-locked__icon">&#128274;</div>
            <p className="pick-locked__text">Picks are locked</p>
            <p className="text-gray mt-1" style={{ fontSize: '0.875rem' }}>
              Picks locked at qualifying time. Check back after the race for results.
            </p>
          </div>
          {existingPicks.length > 0 && (
            <div className="mt-2">
              <p className="font-semibold text-navy mb-1">Your submitted picks:</p>
              {existingPicks.map((p) => (
                <p key={p.id} className="text-gray" style={{ fontSize: '0.875rem' }}>
                  <span style={{ textTransform: 'capitalize' }}>{p.pick_type.replace('_', ' ')}</span>:{' '}
                  {p.pick_value}
                </p>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  /* Driver select helper */
  const driverSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <div className="pick-group">
      <div className="pick-group__label">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- Select --</option>
        {driversList.map((d) => (
          <option key={d.driver_id} value={d.driver_id}>
            {d.first_name} {d.last_name} ({d.constructor_name})
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="page">
      <h1 className="page__title">Weekly Picks</h1>

      <Card title={nextRace.race_name}>
        <RaceCountdown
          targetDate={
            parseRaceDateTime(
              nextRace.quali_date || nextRace.race_date,
              nextRace.quali_time
            ).toISOString()
          }
          label="Picks lock in"
          raceStatus={nextRace.status}
        />
      </Card>

      {error && <div className="login-card__error mb-1">{error}</div>}
      {success && (
        <div
          style={{
            background: 'rgba(124,167,133,0.15)',
            color: '#3E6B47',
            padding: '0.6rem 0.75rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
            marginBottom: '1rem',
          }}
        >
          {success}
        </div>
      )}

      <Card title="Race Predictions">
        {driverSelect(pole, setPole, 'Pole Position')}
        {driverSelect(winner, setWinner, 'Race Winner')}
        {driverSelect(fastestLap, setFastestLap, 'Fastest Lap')}
        {driverSelect(dnf, setDnf, 'First DNF')}
      </Card>

      <Card title="Podium (Pick 3)">
        <div className="podium-select">
          {driversList.map((d) => (
            <button
              key={d.driver_id}
              type="button"
              className={`podium-select__chip ${podium.includes(d.driver_id) ? 'podium-select__chip--selected' : ''}`}
              onClick={() => togglePodium(d.driver_id)}
            >
              {d.code}
            </button>
          ))}
        </div>
        {podium.length > 0 && (
          <p className="text-gray mt-1" style={{ fontSize: '0.8125rem' }}>
            Selected: {podium.map((id) => driversList.find((d) => d.driver_id === id)?.code).join(', ')} ({podium.length}/3)
          </p>
        )}
      </Card>

      <Card title="Constructor Podium (Pick 3)">
        <div className="podium-select">
          {constructors.map((c) => (
            <button
              key={c}
              type="button"
              className={`podium-select__chip ${constructorPodium.includes(c) ? 'podium-select__chip--selected' : ''}`}
              onClick={() => toggleConstructorPodium(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {constructorPodium.length > 0 && (
          <p className="text-gray mt-1" style={{ fontSize: '0.8125rem' }}>
            Selected: {constructorPodium.join(', ')} ({constructorPodium.length}/3)
          </p>
        )}
      </Card>

      {/* H2H Matchups */}
      {matchups.length > 0 && (
        <Card title="Head-to-Head Matchups">
          {matchups.map((m) => (
            <div key={m.id} className="matchup-card">
              <div className="matchup-card__player">
                <div className="matchup-card__player-name">
                  {m.driver_a ? `${m.driver_a.first_name} ${m.driver_a.last_name}` : m.driver_a_id}
                </div>
              </div>
              <div className="matchup-card__vs">VS</div>
              <div className="matchup-card__player">
                <div className="matchup-card__player-name">
                  {m.driver_b ? `${m.driver_b.first_name} ${m.driver_b.last_name}` : m.driver_b_id}
                </div>
              </div>
              <div className="matchup-card__pick" style={{ flex: 1 }}>
                <select
                  value={h2hPick}
                  onChange={(e) => setH2hPick(e.target.value)}
                >
                  <option value="">Pick winner</option>
                  <option value={m.driver_a_id}>
                    {m.driver_a?.code || m.driver_a_id}
                  </option>
                  <option value={m.driver_b_id}>
                    {m.driver_b?.code || m.driver_b_id}
                  </option>
                </select>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Button variant="primary" block disabled={submitting} onClick={handleSubmit}>
        {submitting ? 'Saving...' : existingPicks.length > 0 ? 'Update Picks' : 'Submit Picks'}
      </Button>
    </div>
  );
}
