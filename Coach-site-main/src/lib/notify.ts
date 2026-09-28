"use client"

import type { MyNextFight } from "@/lib/useMyNextFight"

/**
 * F1: уведомления родителя «бой ребёнка скоро».
 *
 * Триггер — fight из useMyNextFight (очереди татами + ETA уже есть).
 * Чистое решение shouldNotify покрыто тестами; отправка — через
 * Notification API (только при granted, только по явному opt-in).
 */

export const FIGHT_NOTIFY_KEY = "kwf-fight-notify"
export const NOTIFY_ETA_THRESHOLD_SEC = 600 // «скоро» = ETA ≤ 10 мин

export interface NotifyEvent {
  /** Дедупликация в рамках сессии: `${state}:${matchId}`. */
  key: string
  title: string
  body: string
  live: boolean
}

function etaLabel(eta: number | null | undefined): string {
  if (eta === null || eta === undefined) return ""
  if (eta <= 0) return "начинается"
  if (eta < 60) return "меньше чем через минуту"
  return `примерно через ${Math.max(1, Math.round(eta / 60))} мин`
}

/**
 * Чистая функция: нужно ли уведомить о бое.
 * - live → всегда (один раз на бой);
 * - next с ETA ≤ порога → один раз на бой;
 * - waiting/null/ETA выше порога → тихо (рано, ETA ненадёжен).
 */
export function shouldNotifyFight(
  fight: MyNextFight | null,
  seen: ReadonlySet<string>,
  etaThresholdSec = NOTIFY_ETA_THRESHOLD_SEC
): NotifyEvent | null {
  if (!fight) return null
  const key = `${fight.state}:${fight.match.id}`
  if (seen.has(key)) return null
  const names = `${fight.match.athlete1} vs ${fight.match.athlete2}`
  if (fight.state === "live") {
    return {
      key,
      title: "Ребёнок сейчас на татами!",
      body: `${names} · ${fight.tatamiName}`,
      live: true,
    }
  }
  if (fight.state === "next") {
    const eta = fight.match.eta_seconds ?? null
    if (eta === null || eta > etaThresholdSec) return null
    return {
      key,
      title: "Следующий бой ребёнка скоро",
      body: `${names} · ${fight.tatamiName} · ${etaLabel(eta)}`,
      live: false,
    }
  }
  return null
}

export type NotifyPermission = "granted" | "denied" | "default" | "unsupported"

export function notifyPermission(): NotifyPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  return Notification.permission as NotifyPermission
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  try {
    return (await Notification.requestPermission()) as NotifyPermission
  } catch {
    return Notification.permission as NotifyPermission
  }
}

export function isFightNotifyEnabled(): boolean {
  try {
    return localStorage.getItem(FIGHT_NOTIFY_KEY) === "1"
  } catch {
    return false
  }
}

export function setFightNotifyEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(FIGHT_NOTIFY_KEY, "1")
    else localStorage.removeItem(FIGHT_NOTIFY_KEY)
  } catch {
    /* ignore */
  }
}

/** Отправка (только при granted; tag=file — повтор не плодит карточки). */
export function sendFightNotification(ev: NotifyEvent): boolean {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return false
    }
    new Notification(ev.title, { body: ev.body, tag: ev.key })
    return true
  } catch {
    return false
  }
}
