import { useState, useEffect } from 'react';
import { parseDate } from '../../utils/date';

interface RaceCountdownProps {
  targetDate: string; /* ISO date or datetime string */
  label?: string;
  raceStatus?: string; /* 'upcoming' | 'qualifying' | 'in_progress' | 'completed' */
}

function calcRemaining(target: number) {
  const diff = Math.max(0, target - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    mins: Math.floor((diff % 3_600_000) / 60_000),
    secs: Math.floor((diff % 60_000) / 1_000),
    total: diff,
  };
}

export default function RaceCountdown({ targetDate, label, raceStatus }: RaceCountdownProps) {
  const target = parseDate(targetDate).getTime();
  const [remaining, setRemaining] = useState(() => calcRemaining(target));

  useEffect(() => {
    const id = setInterval(() => setRemaining(calcRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining.total <= 0) {
    // Only show "Race has started!" if the server confirms the race is not upcoming.
    // If the server says 'upcoming' but the countdown hit zero, it's likely a
    // data issue (stale dates from Ergast API) — show a neutral message instead.
    if (raceStatus && raceStatus === 'upcoming') {
      return null; // hide the countdown — race hasn't actually started
    }
    return <p className="text-center text-gray font-semibold">Race has started!</p>;
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div>
      {label && <p className="text-center text-gray mb-1" style={{ fontSize: '0.8125rem' }}>{label}</p>}
      <div className="countdown">
        {[
          { value: remaining.days, label: 'Days' },
          { value: remaining.hours, label: 'Hrs' },
          { value: remaining.mins, label: 'Min' },
          { value: remaining.secs, label: 'Sec' },
        ].map((u) => (
          <div className="countdown__unit" key={u.label}>
            <span className="countdown__value">{pad(u.value)}</span>
            <span className="countdown__label">{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
