export type TournamentStep = 'info' | 'categories' | 'participants' | 'review'

export type PublishMode = 'draft' | 'published'

export interface TournamentInfoState {
  name: string
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  location: string
  description: string
  mats_count: number
}

export const EMPTY_TOURNAMENT_INFO: TournamentInfoState = {
  name: '',
  start_date: '',
  start_time: '',
  end_date: '',
  end_time: '',
  location: '',
  description: '',
  mats_count: 1,
}

export interface CategoryDraft {
  id: number
  name: string
  gender: string
  age_min: number
  age_max: number
  weight_min: number
  weight_max: number
}

export interface CategoryFormState {
  name: string
  gender: string
  age_min: number
  age_max: number
  weight_min: number
  weight_max: number
}

export const EMPTY_CATEGORY_FORM: CategoryFormState = {
  name: '',
  gender: 'male',
  age_min: 10,
  age_max: 12,
  weight_min: 0,
  weight_max: 45,
}

/** Ошибки Step 1 — по полям (зеркалят требования backend, без выдуманных правил). */
export type InfoErrors = Partial<
  Record<'name' | 'start_date' | 'end_date' | 'dateRange' | 'mats_count', string>
>

export interface TournamentDraft {
  info: TournamentInfoState
  categories: CategoryDraft[]
  selectedAthletes: Record<number, number[]>
  publishMode: PublishMode
  updatedAt: string
}
