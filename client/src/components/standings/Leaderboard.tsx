import type { StandingsEntry } from '../../types';

interface LeaderboardProps {
  entries: StandingsEntry[];
  currentUserId?: number;
  races?: { race_id: number; round: number }[];
  onRaceClick?: (raceId: number) => void;
  compact?: boolean;
}

export default function Leaderboard({
  entries,
  currentUserId,
  races,
  onRaceClick,
  compact = false,
}: LeaderboardProps) {
  const rankClass = (idx: number) => {
    const rank = idx + 1;
    if (rank === 1) return 'leaderboard__rank leaderboard__rank--1';
    if (rank === 2) return 'leaderboard__rank leaderboard__rank--2';
    if (rank === 3) return 'leaderboard__rank leaderboard__rank--3';
    return 'leaderboard__rank';
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th className="text-right">Points</th>
            {!compact &&
              races?.map((r) => (
                <th
                  key={r.race_id}
                  className="text-center hide-mobile"
                  style={{ cursor: onRaceClick ? 'pointer' : undefined, fontSize: '0.75rem' }}
                  onClick={() => onRaceClick?.(r.race_id)}
                  title={`Round ${r.round}`}
                >
                  R{r.round}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((s, idx) => {
            const isMe = currentUserId !== undefined && s.user_id === currentUserId;
            return (
              <tr key={s.user_id} className={isMe ? 'table__row--highlight' : ''}>
                <td>
                  <span className={rankClass(idx)}>{idx + 1}</span>
                </td>
                <td>{s.display_name}</td>
                <td className="text-right font-bold">{s.total_points}</td>
                {!compact &&
                  races?.map((r) => {
                    const rs = s.race_scores?.find((sc) => sc.race_id === r.race_id);
                    return (
                      <td key={r.race_id} className="text-center hide-mobile" style={{ fontSize: '0.8125rem' }}>
                        {rs ? rs.total_points : '-'}
                      </td>
                    );
                  })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
