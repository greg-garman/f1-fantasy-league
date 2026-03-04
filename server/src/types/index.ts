export interface User {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  is_admin: number;
  budget: number;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

export interface F1Driver {
  id: number;
  driver_id: string;
  code: string;
  first_name: string;
  last_name: string;
  constructor_id: string;
  constructor_name: string;
  nationality: string | null;
  number: number | null;
  current_price: number;
  initial_price: number;
  is_active: number;
  photo_url: string | null;
}

export interface F1Race {
  id: number;
  season: number;
  round: number;
  race_name: string;
  circuit_name: string;
  country: string | null;
  race_date: string;
  race_time: string | null;
  quali_date: string | null;
  quali_time: string | null;
  sprint_date: string | null;
  fp1_date: string | null;
  has_sprint: number;
  status: 'upcoming' | 'qualifying' | 'in_progress' | 'completed';
  picks_locked: number;
}

export interface F1RaceResult {
  id: number;
  race_id: number;
  driver_id: string;
  session_type: 'race' | 'qualifying' | 'sprint';
  grid_position: number | null;
  finish_position: number | null;
  position_text: string | null;
  points_real: number;
  status: string | null;
  fastest_lap: number;
  time_or_gap: string | null;
  created_at: string;
}

export interface UserTeam {
  id: number;
  user_id: number;
  driver_id: string;
  slot: number;
  acquired_at: string;
  price_paid: number;
}

export interface Transfer {
  id: number;
  user_id: number;
  race_id: number;
  driver_out_id: string;
  driver_in_id: string;
  price_out: number;
  price_in: number;
  created_at: string;
}

export interface WeeklyPick {
  id: number;
  user_id: number;
  race_id: number;
  pick_type: string;
  pick_value: string;
  is_correct: number | null;
  points_earned: number;
  created_at: string;
}

export interface RaceScore {
  id: number;
  user_id: number;
  race_id: number;
  team_points: number;
  picks_points: number;
  total_points: number;
  manual_adjustment: number;
  breakdown_json: string | null;
  created_at: string;
}

export interface DriverPriceHistory {
  id: number;
  driver_id: string;
  race_id: number;
  price: number;
  created_at: string;
}
