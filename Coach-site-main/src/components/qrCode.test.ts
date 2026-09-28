import { describe, expect, it } from 'vitest'
import { parseScannedCode } from './qrCode'

describe('parseScannedCode', () => {
  it('валидный 16-hex код нормализуется к верхнему регистру', () => {
    expect(parseScannedCode('  ab12cd34ef56ab78 ')).toBe('AB12CD34EF56AB78')
  })

  it('legacy-коды backend-тестов проходят', () => {
    expect(parseScannedCode('CHECKINCODE01')).toBe('CHECKINCODE01')
    expect(parseScannedCode('LEGACYCODE12')).toBe('LEGACYCODE12')
  })

  it('мусор отклоняется', () => {
    expect(parseScannedCode('')).toBeNull()
    expect(parseScannedCode(null)).toBeNull()
    expect(parseScannedCode(undefined)).toBeNull()
    expect(parseScannedCode(12345)).toBeNull()
    expect(parseScannedCode('AB')).toBeNull()
    expect(parseScannedCode('https://evil.example/phish')).toBeNull()
    expect(parseScannedCode('код-с-дефисом-и-кириллицей')).toBeNull()
    expect(parseScannedCode('A'.repeat(33))).toBeNull()
    expect(parseScannedCode('<script>alert(1)</script>')).toBeNull()
  })
})
