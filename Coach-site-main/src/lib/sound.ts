/** Фаза 8: синтезированный гонг зала (WebAudio, без аудиофайлов).
 *
 * Звук включается только явным тоглом (политики автоплея + уважение
 * к залу). Все функции безопасны вне браузера (SSR) — молча no-op.
 */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null
    if (!ctx) ctx = new AC()
    if (ctx.state === "suspended") void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function strike(
  ac: AudioContext,
  at: number,
  freq: number,
  dur: number,
  peak: number,
  type: OscillatorType = "sine"
) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(peak, at + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(gain).connect(ac.destination)
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

/** Удар гонга: низкий гул + обертоны, ~1.8с затухания. */
export function playGong() {
  const ac = audio()
  if (!ac) return
  try {
    const t = ac.currentTime
    strike(ac, t, 196, 1.8, 0.5, "sine")
    strike(ac, t, 294, 1.2, 0.25, "triangle")
    strike(ac, t, 392, 0.9, 0.15, "triangle")
  } catch {
    // Звук — украшение: ошибки глушим.
  }
}

/** Финиш: два коротких сигнала. */
export function playFinish() {
  const ac = audio()
  if (!ac) return
  try {
    const t = ac.currentTime
    strike(ac, t, 660, 0.25, 0.3, "sine")
    strike(ac, t + 0.3, 880, 0.4, 0.3, "sine")
  } catch {
    // Звук — украшение: ошибки глушим.
  }
}
