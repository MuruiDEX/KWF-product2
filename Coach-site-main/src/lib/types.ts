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
  // Авторство: выставляет сервер, старые новости — null.
  author: number | null
  author_name: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface Athlete {
  id: number
  first_name: string
  last_name: string
  // Кабинетный срез может отдавать null — чтения уже null-safe (|| "").
  birth_date: string | null
  weight: string
  height: string | null
  gender: "male" | "female"
  // Опционально: кабинетный срез его не возвращает, нигде не читается.
  parent?: number
  club?: string | null
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
  // N13: нижняя граница веса (старые записи — 0).
  weight_min?: string | number | null
  weight_max: string
  gender: Gender
  order: number
  match_duration?: number
  tatami?: number | null
  tatami_name?: string | null
  athletes: Athlete[]
  /** Фаза 4: порядок посева (id по порядку, первый — топ). */
  seed_order?: number[]
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
  // Phase 4: backend отдаёт судью (read-only, запись через set_referee).
  referee?: number | null
  referee_name?: string | null
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
    birth_date: string | null
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

export interface TemplateCategory {
  name: string
  age_min: number
  age_max: number
  weight_max: string
  gender: string
  order: number
  match_duration: number
  tatami?: number | null
}

export interface TournamentTemplate {
  id: number
  name: string
  snapshot: {
    mats_count: number
    location: string
    categories: TemplateCategory[]
  }
  categories_count: number
  created_at: string
  updated_at: string
}

export type LeadPlan = "trial" | "base" | "optimal" | "premium"
export type LeadStatus = "new" | "contacted" | "trial" | "paid" | "lost"

export interface Lead {
  id: number
  name: string
  phone: string
  plan: LeadPlan
  plan_display?: string
  message: string
  source: string
  status: LeadStatus
  status_display?: string
  handled_by?: number | null
  created_at: string
  updated_at: string
}

export const LEAD_PLANS: { value: LeadPlan; label: string }[] = [
  { value: "trial", label: "Пробное занятие" },
  { value: "base", label: "Базовая" },
  { value: "optimal", label: "Оптимальная" },
  { value: "premium", label: "Премиум" },
]

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "Новая" },
  { value: "contacted", label: "Связались" },
  { value: "trial", label: "На пробном" },
  { value: "paid", label: "Оплачена" },
  { value: "lost", label: "Потеряна" },
]

export type AssignmentStatus = "assigned" | "in_progress" | "done"

export interface Exercise {
  id: number
  workout: number
  name: string
  sets: number
  reps: string
  weight: string | null
  rest_seconds: number
  order: number
  comment: string
  video_url: string
}

export interface Workout {
  id: number
  title: string
  description: string
  trainer?: number | null
  group: string
  is_template: boolean
  exercises: Exercise[]
  exercises_count: number
  assignments_count: number
  created_at: string
  updated_at: string
}

export interface Assignment {
  id: number
  workout: number
  workout_title: string
  athlete: number
  athlete_name: string
  due_date: string | null
  status: AssignmentStatus
  status_display?: string
  note: string
  completed_at: string | null
  created_at: string
  done_count: number
  total_count: number
}

export interface WorkoutResult {
  id: number
  assignment: number
  exercise: number
  exercise_name?: string
  done: boolean
  actual_sets: number | null
  actual_reps: string
  actual_weight: string | null
  note: string
  logged_at: string
}

export const ASSIGNMENT_STATUSES: { value: AssignmentStatus; label: string }[] = [
  { value: "assigned", label: "Назначена" },
  { value: "in_progress", label: "Выполняется" },
  { value: "done", label: "Выполнена" },
]

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
