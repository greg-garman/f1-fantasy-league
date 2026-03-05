import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getNextRace, getStandings, getMyPicks } from '../api/client';
import type { F1Race, StandingsEntry, WeeklyPick } from '../types';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import RaceCountdown from '../components/race/RaceCountdown';
import Leaderboard from '../components/standings/Leaderboard';

export default function DashboardPage() {
  const { user } = useAuth();
  const [nextRace, setNextRace] = useState<F1Race | null>(null);
  const [leaderboard, setLeaderboard] = useState<StandingsEntry[]>([]);
  const [myPicks, setMyPicks] = useState<WeeklyPick[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [nr, st] = await Promise.all([
          getNextRace().catch(() => null),
          getStandings().catch(() => []),
        ]);
        if (cancelled) return;
        setNextRace(nr);
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
            <div style={{ marginTop: '0.75rem' }} />
            <RaceCountdown
              targetDate={
                nextRace.race_time
                  ? `${nextRace.race_date}T${nextRace.race_time}`
                  : nextRace.race_date
              }
              label="Race starts in"
            />
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
