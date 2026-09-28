import type { InfoErrors, TournamentInfoState } from './wizardTypes'

/** Пошаговая валидация Step 1. Только реальные требования API:
 * name/start_date/end_date обязательны, старт не позже финиша, татами ≥ 1. */
export function validateInfo(info: TournamentInfoState): InfoErrors {
  const errors: InfoErrors = {}
  if (!info.name || !info.name.trim()) {
    errors.name = 'Укажите название турнира'
  }
  if (!info.start_date) {
    errors.start_date = 'Выберите дату начала'
  }
  if (!info.end_date) {
    errors.end_date = 'Выберите дату окончания'
  }
  if (info.start_date && info.end_date && info.start_date > info.end_date) {
    errors.dateRange = 'Дата начала не может быть позже даты окончания'
  }
  if (!Number.isFinite(info.mats_count) || info.mats_count < 1) {
    errors.mats_count = 'Нужно хотя бы одно татами'
  }
  return errors
}

export function hasErrors(errors: InfoErrors): boolean {
  return Object.keys(errors).length > 0
}
