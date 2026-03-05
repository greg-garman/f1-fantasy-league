import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getRace, getRaceScores } from '../api/client';
import type { F1Race, F1RaceResult, RaceScore } from '../types';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import { formatRaceDate } from '../utils/date';

export default function RaceDetailPage() {
  const { raceId } = useParams<{ raceId: string }>();
  const [race, setRace] = useState<(F1Race & { results?: F1RaceResult[] }) | null>(null);
  const [scores, setScores] = useState<RaceScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!raceId) return;
    const id = Number(raceId);
    Promise.all([
      getRace(id).catch(() => null),
      getRaceScores(id).catch(() => []),
    ]).then(([r, s]) => {
      setRace(r);
      setScores(s);
    }).finally(() => setLoading(false));
  }, [raceId]);

  if (loading) return <Spinner />;
  if (!race) {
    return (
      <div className="page">
        <h1 className="page__title">Race Not Found</h1>
        <p className="text-gray">Could not load race details.</p>
      </div>
    );
  }

  const results = race.results || [];
  const raceResults = results.filter((r) => r.session_type === 'race').sort((a, b) => (a.finish_position ?? 99) - (b.finish_position ?? 99));

  return (
    <div className="page">
      <h1 className="page__title">{race.race_name}</h1>
      <p className="text-gray mb-1">
        {race.circuit_name}
        {race.country ? ` \u00B7 ${race.country}` : ''}
        {' \u00B7 '}
        {formatRaceDate(race.race_date, { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
      <div className="mb-2">
        <Badge variant={race.status === 'completed' ? 'green' : 'gray'}>
          {race.status === 'completed' ? 'Completed' : 'Upcoming'}
        </Badge>
      </div>

      {/* Race Results */}
      {raceResults.length > 0 && (
        <Card title="Race Results">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Driver</th>
                  <th>Grid</th>
                  <th>Status</th>
                  <th className="text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {raceResults.map((r) => (
                  <tr key={r.id}>
                    <td className="font-bold">{r.position_text || r.finish_position || '-'}</td>
                    <td>
                      {r.driver_id}
                      {r.fastest_lap === 1 && (
                        <Badge variant="blue" >FL</Badge>
                      )}
                    </td>
                    <td>{r.grid_position ?? '-'}</td>
                    <td>{r.status || 'Finished'}</td>
                    <td className="text-right font-bold">{r.points_real}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Player Scores */}
      {scores.length > 0 && (
        <Card title="Player Scores">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th className="text-right">Team</th>
                  <th className="text-right">Picks</th>
                  <th className="text-right">Adj.</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {scores
                  .sort((a, b) => b.total_points - a.total_points)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>User #{s.user_id}</td>
                      <td className="text-right">{s.team_points}</td>
                      <td className="text-right">{s.picks_points}</td>
                      <td className="text-right">{s.manual_adjustment}</td>
                      <td className="text-right font-bold">{s.total_points}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {results.length === 0 && scores.length === 0 && (
        <Card>
          <p className="text-gray text-center">
            Results will appear after the race is completed and scored.
          </p>
        </Card>
      )}
    </div>
  );
}
