import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRaces } from '../api/client';
import type { F1Race } from '../types';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';

export default function RaceCalendarPage() {
  const navigate = useNavigate();
  const [races, setRaces] = useState<F1Race[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRaces()
      .then(setRaces)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  /* Find first upcoming race */
  const nextRace = races.find((r) => r.status !== 'completed');

  return (
    <div className="page">
      <h1 className="page__title">Race Calendar</h1>

      {races.length === 0 && <p className="text-gray">No races found. Season data may not be synced yet.</p>}

      {races.map((race) => {
        const isNext = nextRace && race.id === nextRace.id;
        const dateStr = new Date(race.race_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });

        return (
          <div
            key={race.id}
            className={`race-list__item ${isNext ? 'race-list__item--next' : ''}`}
            onClick={() => navigate(`/race/${race.id}`)}
          >
            <span className="race-list__round">R{race.round}</span>
            <div className="race-list__info">
              <span className="race-list__name">{race.race_name}</span>
              <span className="race-list__circuit">
                {race.circuit_name}
                {race.country ? ` \u00B7 ${race.country}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              <span className="race-list__date">{dateStr}</span>
              {race.status === 'completed' ? (
                <Badge variant="green">Completed</Badge>
              ) : isNext ? (
                <Badge variant="gold">Next</Badge>
              ) : (
                <Badge variant="gray">Upcoming</Badge>
              )}
              {race.has_sprint === 1 && <Badge variant="blue">Sprint</Badge>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
