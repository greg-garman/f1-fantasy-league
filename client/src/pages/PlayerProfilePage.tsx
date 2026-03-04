import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPlayerTeam, getStandings } from '../api/client';
import type { UserTeamEntry, StandingsEntry } from '../types';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';

export default function PlayerProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [team, setTeam] = useState<UserTeamEntry[]>([]);
  const [budget, setBudget] = useState(0);
  const [playerStanding, setPlayerStanding] = useState<StandingsEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const id = Number(userId);

    Promise.all([
      getPlayerTeam(id).catch(() => ({ team: [], budget: 0 })),
      getStandings().catch(() => []),
    ]).then(([t, standings]) => {
      setTeam(t.team);
      setBudget(t.budget);
      const found = standings.find((s) => s.user_id === id) || null;
      setPlayerStanding(found);
    }).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;

  const displayName = playerStanding?.display_name || `Player #${userId}`;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="page">
      <div className="profile-header">
        <div className="profile-header__avatar">{initials}</div>
        <div>
          <div className="profile-header__name">{displayName}</div>
          <div className="profile-header__points">
            {playerStanding ? `${playerStanding.total_points} total points` : 'No scores yet'}
          </div>
        </div>
      </div>

      {/* Team */}
      <Card title="Current Team">
        {team.length === 0 ? (
          <p className="text-gray">No team data available.</p>
        ) : (
          team.map((slot) => {
            const d = slot.driver;
            return (
              <div key={slot.id} className="driver-card">
                <div className="driver-card__info">
                  <span className="driver-card__name">
                    {d ? `${d.first_name} ${d.last_name}` : slot.driver_id}
                  </span>
                  <span className="driver-card__constructor">{d?.constructor_name || ''}</span>
                </div>
                <div className="driver-card__meta">
                  <span className="driver-card__price">${(d?.current_price ?? slot.price_paid).toFixed(1)}M</span>
                  <span className="driver-card__code">{d?.code || ''}</span>
                </div>
              </div>
            );
          })
        )}
        <p className="text-gray mt-1" style={{ fontSize: '0.8125rem' }}>
          Budget remaining: <strong>${budget.toFixed(1)}M</strong>
        </p>
      </Card>

      {/* Race-by-Race scores */}
      {playerStanding && playerStanding.race_scores.length > 0 && (
        <Card title="Race-by-Race Scores">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Round</th>
                  <th className="text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {playerStanding.race_scores.map((rs) => (
                  <tr key={rs.race_id}>
                    <td>Round {rs.round}</td>
                    <td className="text-right font-bold">{rs.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
