import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getNextRace, getRaces, getStandings, getMyPicks } from '../api/client';
import type { F1Race, StandingsEntry, WeeklyPick } from '../types';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import RaceCountdown from '../components/race/RaceCountdown';
import Leaderboard from '../components/standings/Leaderboard';

/* ── Country flag emoji lookup ── */
const FLAG_MAP: Record<string, string> = {
  'Australia': '\u{1F1E6}\u{1F1FA}', 'China': '\u{1F1E8}\u{1F1F3}', 'Japan': '\u{1F1EF}\u{1F1F5}',
  'Bahrain': '\u{1F1E7}\u{1F1ED}', 'Saudi Arabia': '\u{1F1F8}\u{1F1E6}', 'USA': '\u{1F1FA}\u{1F1F8}',
  'Italy': '\u{1F1EE}\u{1F1F9}', 'Monaco': '\u{1F1F2}\u{1F1E8}', 'Spain': '\u{1F1EA}\u{1F1F8}',
  'Canada': '\u{1F1E8}\u{1F1E6}', 'Austria': '\u{1F1E6}\u{1F1F9}', 'UK': '\u{1F1EC}\u{1F1E7}',
  'Belgium': '\u{1F1E7}\u{1F1EA}', 'Hungary': '\u{1F1ED}\u{1F1FA}', 'Netherlands': '\u{1F1F3}\u{1F1F1}',
  'Azerbaijan': '\u{1F1E6}\u{1F1FF}', 'Singapore': '\u{1F1F8}\u{1F1EC}', 'Mexico': '\u{1F1F2}\u{1F1FD}',
  'Brazil': '\u{1F1E7}\u{1F1F7}', 'Qatar': '\u{1F1F6}\u{1F1E6}', 'UAE': '\u{1F1E6}\u{1F1EA}',
};
function getFlag(country: string | null) {
  if (!country) return '';
  return FLAG_MAP[country] ?? '';
}

/* ── Mini calendar component ── */
function RaceTimeline({ races, nextRaceId }: { races: F1Race[]; nextRaceId?: number }) {
  const navigate = useNavigate();
  const nextIdx = races.findIndex(r => r.id === nextRaceId);

  // Show a window of races: 2 past + next + 4 future
  const startIdx = Math.max(0, nextIdx - 2);
  const visible = races.slice(startIdx, startIdx + 7);

  return (
    <div style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto', padding: '0.25rem 0' }}>
      {visible.map((race) => {
        const isNext = race.id === nextRaceId;
        const isCompleted = race.status === 'completed';
        const month = new Date(race.race_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' });
        const day = new Date(race.race_date + 'T00:00:00').getDate();

        return (
          <div
            key={race.id}
            onClick={() => navigate(`/race/${race.id}`)}
            style={{
              flex: '0 0 auto',
              width: '5.5rem',
              padding: '0.5rem 0.375rem',
              borderRadius: '8px',
              background: isNext ? 'var(--color-navy)' : isCompleted ? 'var(--color-light-gray)' : 'var(--color-white)',
              border: isNext ? '2px solid var(--color-gold)' : '1px solid var(--color-light-gray)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              boxShadow: isNext ? '0 2px 8px rgba(198,178,93,0.35)' : 'var(--shadow-sm)',
              opacity: isCompleted ? 0.6 : 1,
            }}
          >
            <div style={{ fontSize: '1.125rem', lineHeight: 1.2 }}>{getFlag(race.country)}</div>
            <div style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              color: isNext ? 'var(--color-gold)' : 'var(--color-gray)',
              marginTop: '0.2rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              R{race.round}
            </div>
            <div style={{
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: isNext ? 'var(--color-white)' : 'var(--color-navy)',
              lineHeight: 1.2,
            }}>
              {day}
            </div>
            <div style={{
              fontSize: '0.625rem',
              fontWeight: 600,
              color: isNext ? 'rgba(255,255,255,0.7)' : 'var(--color-gray)',
              textTransform: 'uppercase',
            }}>
              {month}
            </div>
            {isCompleted && (
              <div style={{
                fontSize: '0.5625rem',
                fontWeight: 600,
                color: '#3E6B47',
                background: 'rgba(124,167,133,0.25)',
                borderRadius: '999px',
                padding: '0.1rem 0.3rem',
                marginTop: '0.2rem',
              }}>Done</div>
            )}
            {isNext && (
              <div style={{
                fontSize: '0.5625rem',
                fontWeight: 700,
                color: 'var(--color-dark-brown)',
                background: 'var(--color-gold)',
                borderRadius: '999px',
                padding: '0.1rem 0.3rem',
                marginTop: '0.2rem',
              }}>NEXT</div>
            )}
            {race.has_sprint === 1 && !isCompleted && !isNext && (
              <div style={{
                fontSize: '0.5625rem',
                fontWeight: 600,
                color: 'var(--color-navy)',
                background: 'rgba(159,188,209,0.3)',
                borderRadius: '999px',
                padding: '0.1rem 0.3rem',
                marginTop: '0.2rem',
              }}>Sprint</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [nextRace, setNextRace] = useState<F1Race | null>(null);
  const [allRaces, setAllRaces] = useState<F1Race[]>([]);
  const [leaderboard, setLeaderboard] = useState<StandingsEntry[]>([]);
  const [myPicks, setMyPicks] = useState<WeeklyPick[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [nr, races, st] = await Promise.all([
          getNextRace().catch(() => null),
          getRaces().catch(() => []),
          getStandings().catch(() => []),
        ]);
        if (cancelled) return;
        setNextRace(nr);
        setAllRaces(races);
        setLeaderboard(st);

        if (nr) {
          const p = await getMyPicks(nr.id).catch(() => []);
          if (!cancelled) setMyPicks(p);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Spinner />;

  const picksSubmitted = myPicks && myPicks.length > 0;

  return (
    <div className="page">
      <h1 className="page__title">Dashboard</h1>

      <div className="dashboard-grid">
        {/* Next Race Countdowns */}
        {nextRace && (
          <Card title={nextRace.race_name} className="dashboard-grid__full">
            <p className="text-gray mb-1" style={{ fontSize: '0.8125rem' }}>
              {nextRace.circuit_name} &middot; {nextRace.country || ''}
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {nextRace.quali_date && (
                <RaceCountdown
                  targetDate={
                    nextRace.quali_time
                      ? `${nextRace.quali_date}T${nextRace.quali_time}`
                      : nextRace.quali_date
                  }
                  label="Qualifying (picks lock)"
                />
              )}
              <RaceCountdown
                targetDate={
                  nextRace.race_time
                    ? `${nextRace.race_date}T${nextRace.race_time}`
                    : nextRace.race_date
                }
                label="Race starts in"
              />
            </div>
          </Card>
        )}

        {/* Race Timeline Calendar */}
        {allRaces.length > 0 && (
          <Card title="Season Calendar" className="dashboard-grid__full">
            <RaceTimeline races={allRaces} nextRaceId={nextRace?.id} />
            <Link
              to="/calendar"
              className="text-gold font-semibold"
              style={{ fontSize: '0.8125rem', display: 'block', marginTop: '0.75rem', textAlign: 'center' }}
            >
              View full calendar &rarr;
            </Link>
          </Card>
        )}

        {/* Action Items */}
        <Card title="Action Items">
          {nextRace && !picksSubmitted && (
            <div className="action-item">
              <span className="action-item__icon">&#9998;</span>
              <span className="action-item__text">
                <Link to="/picks">Submit your picks!</Link>
              </span>
            </div>
          )}
          <div className="action-item">
            <span className="action-item__icon">&#128663;</span>
            <span className="action-item__text">
              <Link to="/my-team">Review your team</Link>
            </span>
          </div>
          {picksSubmitted && (
            <div className="action-item">
              <span className="action-item__icon">&#10003;</span>
              <span className="action-item__text text-green">
                Picks submitted for {nextRace?.race_name}
              </span>
            </div>
          )}
        </Card>

        {/* Standings Snapshot */}
        <Card title="Standings">
          {leaderboard.length > 0 ? (
            <>
              <Leaderboard
                entries={leaderboard.slice(0, 5)}
                currentUserId={user?.id}
                compact
              />
              <Link
                to="/standings"
                className="text-gold font-semibold"
                style={{ fontSize: '0.8125rem', display: 'block', marginTop: '0.75rem' }}
              >
                View full standings &rarr;
              </Link>
            </>
          ) : (
            <p className="text-gray">No standings data yet.</p>
          )}
        </Card>
      </div>

      {user && (
        <p className="text-gray mt-2" style={{ fontSize: '0.8125rem' }}>
          Signed in as <strong>{user.display_name}</strong>
        </p>
      )}
    </div>
  );
}
