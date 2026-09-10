export interface Profile {
  phone: string
  club: string
  belt: string
  birth_date: string | null
  role: "parent" | "trainer"
}

export interface MeUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  profile: Profile
}

export interface News {
  id: number
  title: string
  slug: string
  description: string
  image: string | null
  is_published: boolean
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface Athlete {
  id: number
  first_name: string
  last_name: string
  birth_date: string
  weight: string
  height: string | null
  gender: "male" | "female"
  parent: number
  club?: string
  // AthleteSerializer отдаёт trainer как id, search_candidates — как username.
  trainer?: number | string | null
  age: number
  link_code?: string | null
}

export type Gender = "male" | "female" | "any"

export interface TournamentCategory {
  id: number
  tournament: number
  name: string
  age_min: number
  age_max: number
  weight_max: string
  gender: Gender
  order: number
  match_duration?: number
  tatami?: number | null
  tatami_name?: string | null
  athletes: Athlete[]
  rounds: Round[]
}

export interface Round {
  id: number
  category: number
  name: string
  order: number
  status?: "waiting" | "in_progress" | "finished"
  matches: Match[]
}

export interface Tatami {
  id: number
  name: string
  order: number
}

export interface Match {
  id: number
  round: number
  round_name: string
  round_order: number
  category: number
  category_name: string
  match_number: number
  athlete1: number | null
  athlete1_id?: number | null
  athlete1_name: string | null
  athlete2: number | null
  athlete2_id?: number | null
  athlete2_name: string | null
  score1: number
  score2: number
  winner: number | null
  winner_id?: number | null
  winner_name: string | null
  tatami: number | null
  tatami_name: string | null
  fight_number: number
  previous_match1: number | null
  previous_match2: number | null
  previousMatch1?: number | null
  previousMatch2?: number | null
  start_time?: string | null
  end_time?: string | null
  duration_seconds?: number | null
  started_at?: string | null
  accumulated_seconds?: number
  remaining_seconds?: number | null
  timer_running?: boolean
  status: "waiting" | "pending" | "in_progress" | "finished" | "ready" | "bye" | "paused"
}

export interface Tournament {
  id: number
  name: string
  slug: string
  description: string
  location?: string
  start_date: string
  start_time?: string | null
  end_date: string
  end_time?: string | null
  status: "draft" | "published" | "finished"
  created_at: string
  // List-сериализатор отдаёт created_by как username (str),
  // кабинетный фильтр fallback — по username; по id — надёжнее.
  created_by?: string | number
  mats_count?: number
  categories_count?: number
  categories?: TournamentCategory[]
}

export interface CabinetData {  athletes: {
    id: number
    first_name: string
    last_name: string
    birth_date?: string | null
    age: number
    weight: string
    gender: "male" | "female"
    height: string | null
    club?: string | null
    link_code?: string | null
  }[]
  tournaments: Tournament[]
  matches: Match[]
}

export interface TrainingSession {
  id: number
  day: number
  day_name: string
  start_time: string
  end_time: string
  group: string
  kind: string
  trainer_name: string
  room: string
  note: string
  is_active: boolean
  order: number
}
