export interface User {
  id: number;
  username: string;
  display_name: string;
  is_admin: number;
  budget: number;
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
  has_sprint: number;
  status: string;
  picks_locked: number;
}

export interface F1RaceResult {
  id: number;
  race_id: number;
  driver_id: string;
  session_type: string;
  grid_position: number | null;
  finish_position: number | null;
  position_text: string | null;
  points_real: number;
  status: string | null;
  fastest_lap: number;
}

export interface UserTeamEntry {
  id: number;
  user_id: number;
  driver_id: string;
  slot: number;
  price_paid: number;
  driver?: F1Driver;
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
  user_name?: string;
  driver_out_name?: string;
  driver_in_name?: string;
}

export interface WeeklyPick {
  id: number;
  user_id: number;
  race_id: number;
  pick_type: string;
  pick_value: string;
  is_correct: number | null;
  points_earned: number;
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
}

export interface H2HMatchup {
  id: number;
  race_id: number;
  driver_a_id: string;
  driver_b_id: string;
  driver_a?: F1Driver;
  driver_b?: F1Driver;
}

export interface StandingsEntry {
  user_id: number;
  display_name: string;
  total_points: number;
  race_scores: {
    race_id: number;
    round: number;
    total_points: number;
  }[];
}
