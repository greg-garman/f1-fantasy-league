import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStandings, getRaces } from '../api/client';
import type { StandingsEntry, F1Race } from '../types';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/ui/Spinner';
import Leaderboard from '../components/standings/Leaderboard';

export default function StandingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<StandingsEntry[]>([]);
  const [races, setRaces] = useState<F1Race[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, r] = await Promise.all([getStandings(), getRaces().catch(() => [])]);
        setEntries(s);
        setRaces(r.filter((race) => race.status === 'completed'));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  const raceHeaders = races.map((r) => ({ race_id: r.id, round: r.round }));

  return (
    <div className="page">
      <h1 className="page__title">Standings</h1>
      {entries.length === 0 ? (
        <p className="text-gray">No standings data yet. Scores will appear after the first race.</p>
      ) : (
        <Leaderboard
          entries={entries}
          currentUserId={user?.id}
          races={raceHeaders}
          onRaceClick={(raceId) => navigate(`/race/${raceId}`)}
        />
      )}
    </div>
  );
}
