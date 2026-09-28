/** QR явки: payload — сырой link_code спортсмена (backend ждёт точный код).
 * Никаких префиксов/URL: сканер — механизм ввода, не авторизации. */

/** Строгая проверка отсканированного значения. Мусор → null.
 * Допуск 4–32 [A-Z0-9]: покрывает 16-hex коды и legacy-коды backend-тестов. */
export function parseScannedCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (!/^[A-Z0-9]{4,32}$/.test(code)) return null
  return code
}

/** Поддержка сканера: BarcodeDetector + камера. Вызывать в браузере. */
export function isScannerSupported(): boolean {
  if (typeof window === 'undefined') return false
  return (
    'BarcodeDetector' in window &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  )
}
