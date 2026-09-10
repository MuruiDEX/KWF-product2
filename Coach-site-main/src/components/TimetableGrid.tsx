"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { motion, MotionConfig } from "framer-motion"
import { ChevronLeft, ChevronRight, Clock, MapPin, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import EmptyState from "@/components/ui/EmptyState"
import { groupColorVars } from "@/lib/groupColors"
import type { TrainingSession } from "@/lib/types"
import type { ListResponse } from "@/lib/api"
import {
  PX_PER_MIN,
  countByGroup,
  formatTimeShort,
  layoutWeek,
  normalizeSessions,
  parseTimeToMinutes,
  weekTimeBounds,
} from "@/lib/timetable"

const DAYS_SHORT = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"]
const DAYS_FULL = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
]

/** Ширина gutter и минимум колонки дня — только presentation (позиции — в lib/timetable). */
const GUTTER_W = 64
const COL_MIN_W = 170
/** Вертикальный отступ сетки сверху/снизу — чтобы тени карточек
 *  и крайние подписи времени не обрезались контейнером. */
const GRID_PAD_Y = 12

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const dow = (d.getDay() + 6) % 7 // ПН = 0
  d.setDate(d.getDate() - dow)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatRange(monday: Date): string {
  const end = addDays(monday, 6)
  const sameMonth = monday.getMonth() === end.getMonth()
  const s = monday.toLocaleDateString("ru-RU", { day: "numeric" })
  const e = end.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
  return sameMonth ? `${s}–${e}` : `${s} ${monday.toLocaleDateString("ru-RU", { month: "long" })} – ${e}`
}

/** Раскладка и тайминги живут в lib/timetable (чистые функции, покрыты тестами). */

interface TimetableGridProps {
  /**
   * Сырой источник списка: массив, DRF-пагинация ({results}),
   * null/undefined. Нормализация — в normalizeSessions, поэтому
   * `visible` ниже всегда массив валидных сессий.
   */
  sessions: ListResponse<TrainingSession> | { results?: unknown }
  /** Показывать скрытые (кабинет тренера). Публично — только активные. */
  showInactive?: boolean
  /** Клик по карточке (кабинет — открыть редактирование). Иначе — детали. */
  onSessionClick?: (s: TrainingSession) => void
  /** Дополнительная кнопка в тулбаре (напр. «Занятие» в кабинете). */
  headerAction?: ReactNode
}

export default function TimetableGrid({
  sessions: sessionsProp,
  showInactive = false,
  onSessionClick,
  headerAction,
}: TimetableGridProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [groupFilter, setGroupFilter] = useState<string>("all")
  const [openId, setOpenId] = useState<number | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const monday = useMemo(() => addDays(mondayOf(new Date()), weekOffset * 7), [weekOffset])
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday])
  const todayIdx = (new Date().getDay() + 6) % 7
  const showToday = weekOffset === 0
  const nowMin = now.getHours() * 60 + now.getMinutes()

  // Нормализация границы: что бы ни пришло сверху (массив, DRF-пагинация,
  // null/undefined/мусор) — дальше всегда массив валидных сессий.
  // `visible` типизирован как TrainingSession[], итерирование безопасно.
  const sessions = useMemo(() => normalizeSessions(sessionsProp), [sessionsProp])
  const visible: TrainingSession[] = useMemo(
    () => (showInactive ? sessions : sessions.filter((s) => s.is_active)),
    [sessions, showInactive]
  )
  const groups = useMemo(() => countByGroup(visible).map((g) => g.group), [visible])

  // Производный фильтр: если выбранной группы больше нет в данных,
  // показываем всё (без setState в effect и каскадных рендеров).
  const activeFilter = groupFilter === "all" || groups.includes(groupFilter) ? groupFilter : "all"

  const filtered = useMemo(
    () => (activeFilter === "all" ? visible : visible.filter((s) => s.group === activeFilter)),
    [visible, activeFilter]
  )

  const { dayStart, dayEnd, byDay } = useMemo(() => {
    const { dayStart: lo, dayEnd: hi } = weekTimeBounds(filtered)
    return { dayStart: lo, dayEnd: hi, byDay: layoutWeek(filtered, lo) }
  }, [filtered])

  const open = filtered.find((s) => s.id === openId) ?? null
  const hours: number[] = []
  for (let h = Math.floor(dayStart / 60); h <= Math.floor(dayEnd / 60); h++) hours.push(h)
  const gridH = (dayEnd - dayStart) * PX_PER_MIN
  const bodyH = gridH + GRID_PAD_Y * 2

  const isLiveNow = (s: TrainingSession) => {
    const start = parseTimeToMinutes(s.start_time)
    const end = parseTimeToMinutes(s.end_time)
    if (start === null || end === null) return false
    return showToday && s.day === todayIdx && start <= nowMin && nowMin < end
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="space-y-4">
      {/* Тулбар: фильтр групп + навигация недель */}
      <div className="rounded-2xl border border-border bg-white shadow-sm p-4 flex flex-col xl:flex-row xl:items-center gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
          <button
            type="button"
            onClick={() => setGroupFilter("all")}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer ${
              activeFilter === "all"
                ? "bg-gold text-dark-blue shadow-md shadow-gold/25"
                : "bg-light-gray text-secondary-text hover:text-dark-text border border-border"
            }`}
          >
            Все группы
          </button>
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupFilter(activeFilter === g ? "all" : g)}
              style={activeFilter === g ? groupColorVars(g) : undefined}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-colors duration-200 cursor-pointer ${
                activeFilter === g
                  ? "filter-pill-active"
                  : "bg-light-gray text-secondary-text hover:text-dark-text border border-border"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 xl:ml-auto shrink-0">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            aria-label="Предыдущая неделя"
            className="w-9 h-9 rounded-xl border border-border bg-white flex items-center justify-center text-dark-text hover:border-primary-blue/40 hover:shadow-sm transition-all cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            className="h-9 px-4 rounded-xl border border-border bg-white text-sm font-bold text-dark-text hover:border-primary-blue/40 transition-all cursor-pointer disabled:opacity-40"
          >
            Сегодня
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            aria-label="Следующая неделя"
            className="w-9 h-9 rounded-xl border border-border bg-white flex items-center justify-center text-dark-text hover:border-primary-blue/40 hover:shadow-sm transition-all cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
          <span className="text-sm font-extrabold text-dark-text tabular-nums whitespace-nowrap min-w-[110px] text-center">
            {formatRange(monday)}
          </span>
          {headerAction}
        </div>
      </div>

      {/* Сетка */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white shadow-sm">
          <EmptyState
            icon={<Clock size={26} />}
            title={visible.length === 0 ? "Расписание пока пусто" : "В этой группе занятий нет"}
            hint={
              visible.length === 0
                ? "Тренер ещё не добавил занятия — загляните позже"
                : "Выберите другую группу"
            }
          />
        </div>
      ) : (
        <div className="rounded-3xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: GUTTER_W + COL_MIN_W * 7 }}>
              {/* Шапка дней */}
              <div
                className="grid border-b border-border bg-light-gray"
                style={{ gridTemplateColumns: `${GUTTER_W}px repeat(7, minmax(${COL_MIN_W}px, 1fr))` }}
              >
                <div className="p-3 sticky left-0 bg-light-gray z-10" />
                {DAYS_SHORT.map((d, i) => {
                  const isToday = showToday && i === todayIdx
                  return (
                    <div
                      key={d}
                      className={`p-3 text-center relative border-l border-border ${isToday ? "bg-gold/10" : ""}`}
                    >
                      {isToday && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gold" />
                      )}
                      <div
                        className={`text-sm font-extrabold ${isToday ? "text-gold" : "text-dark-text"}`}
                      >
                        {d}
                        <span className="ml-1.5 tabular-nums font-bold">
                          {weekDates[i].getDate()}
                        </span>
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-secondary-text hidden sm:block">
                        {isToday ? "Сегодня" : DAYS_FULL[i]}
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Тело сетки */}
              <div
                className="grid relative"
                style={{ gridTemplateColumns: `${GUTTER_W}px repeat(7, minmax(${COL_MIN_W}px, 1fr))` }}
              >
                {/* Шкала времени */}
                <div
                  className="relative sticky left-0 bg-white z-10"
                  style={{ height: bodyH }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute right-1.5 text-[10px] font-bold text-secondary-text tabular-nums whitespace-nowrap"
                      style={{ top: GRID_PAD_Y + (h * 60 - dayStart) * PX_PER_MIN - 7 }}
                    >
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                {/* Колонки дней */}
                {byDay.map((items, d) => {
                  const isToday = showToday && d === todayIdx
                  return (
                    <div
                      key={d}
                      className={`relative border-l border-border ${isToday ? "bg-gold/[0.04]" : ""}`}
                      style={{ height: bodyH }}
                    >
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-t border-border"
                          style={{ top: GRID_PAD_Y + (h * 60 - dayStart) * PX_PER_MIN, opacity: 0.6 }}
                        />
                      ))}
                      {items.map((s, idx) => {
                        const live = isLiveNow(s)
                        const hasBadge = live || !s.is_active
                        // Доп. строки показываем только если высота реально вмещает контент,
                        // иначе низ карточки обрезался (overflow-hidden).
                        const showKind = s.height >= (hasBadge ? 122 : 104)
                        const showMeta = s.height >= (hasBadge ? 142 : 126)
                        return (
                          <motion.button
                            key={s.id}
                            type="button"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: "easeOut", delay: Math.min(idx * 0.03, 0.3) }}
                            whileHover={{ y: -2, scale: 1.015 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => {
                              if (onSessionClick) onSessionClick(s)
                              else setOpenId(s.id)
                            }}
                            title={`${s.group}, ${formatTimeShort(s.start_time)}–${formatTimeShort(s.end_time)}`}
                            className={`session-card absolute rounded-xl text-left overflow-hidden p-2.5 cursor-pointer hover:z-10 ${
                              live ? "session-card-live ring-1 ring-gold/60" : ""
                            } ${!s.is_active ? "opacity-55" : ""}`}
                            style={{
                              top: GRID_PAD_Y + s.top,
                              height: s.height,
                              left: `calc(${(s.lane / s.lanes) * 100}% + 4px)`,
                              width: `calc(${100 / s.lanes}% - 8px)`,
                              ...groupColorVars(s.group),
                            }}
                          >
                            {live && (
                              <span className="inline-block text-[9px] font-extrabold uppercase tracking-[0.12em] text-dark-blue bg-gold rounded-full px-2 py-0.5 mb-1">
                                Сейчас
                              </span>
                            )}
                            {!s.is_active && (
                              <span className="inline-block text-[9px] font-extrabold uppercase tracking-[0.12em] text-secondary-text bg-light-gray border border-border rounded-full px-2 py-0.5 mb-1">
                                Скрыто
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-dark-text leading-tight">
                              <span aria-hidden className="session-dot inline-block w-1.5 h-1.5 rounded-full shrink-0" />
                              <span className="line-clamp-2">{s.group}</span>
                            </div>
                            <div className="session-time flex flex-wrap items-center gap-x-1 text-[11px] font-bold tabular-nums leading-tight mt-0.5">
                              <span>{formatTimeShort(s.start_time)}</span>
                              <span aria-hidden>–</span>
                              <span>{formatTimeShort(s.end_time)}</span>
                            </div>
                            {showKind && s.kind && (
                              <div className="text-[11px] font-semibold text-secondary-text truncate mt-0.5">
                                {s.kind}
                              </div>
                            )}
                            {showMeta && (s.trainer_name || s.room) && (
                              <div className="text-[10px] text-secondary-text truncate mt-0.5">
                                {[s.trainer_name, s.room].filter(Boolean).join(" · ")}
                              </div>
                            )}
                          </motion.button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Детали занятия */}
      {open && !onSessionClick && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setOpenId(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-border p-6 w-full max-w-md"
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary-text">
              {DAYS_FULL[open.day] ?? "—"} · {formatTimeShort(open.start_time)}–{formatTimeShort(open.end_time)}
            </div>
            <h3 className="text-xl font-extrabold text-dark-text mt-1">{open.group}</h3>
            {open.kind && <p className="text-sm text-secondary-text mt-0.5">{open.kind}</p>}
            <div className="space-y-2.5 mt-5">
              {open.trainer_name && (
                <div className="flex items-center gap-2.5 text-sm text-dark-text">
                  <UserRound size={16} className="text-primary-blue shrink-0" />
                  <span className="font-semibold">{open.trainer_name}</span>
                </div>
              )}
              {open.room && (
                <div className="flex items-center gap-2.5 text-sm text-dark-text">
                  <MapPin size={16} className="text-primary-blue shrink-0" />
                  <span className="font-semibold">{open.room}</span>
                </div>
              )}
              {open.note && (
                <p className="text-sm text-secondary-text leading-relaxed pt-1">{open.note}</p>
              )}
              {!open.trainer_name && !open.room && !open.note && (
                <p className="text-sm text-secondary-text">Дополнительной информации нет.</p>
              )}
            </div>
            <div className="flex justify-end pt-5">
              <Button size="sm" variant="ghost" className="h-10 px-5 text-sm" onClick={() => setOpenId(null)}>
                Закрыть
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
    </MotionConfig>
  )
}
