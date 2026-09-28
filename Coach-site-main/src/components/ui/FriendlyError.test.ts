import { describe, expect, it } from "vitest"
import { apiErrorMessage, apiErrorStatus } from "@/lib/api"

// FriendlyError строится на этих помощниках: фиксируем контракт,
// чтобы человеческие тексты не превратились обратно в технические.
describe("FriendlyError contract (api helpers)", () => {
  it("exposes 403 status for branching", () => {
    expect(apiErrorStatus({ status: 403, detail: "CSRF Failed" })).toBe(403)
  })

  it("never leaks raw CSRF text", () => {
    const msg = apiErrorMessage({ status: 403, detail: "CSRF Failed: CSRF cookie not set." })
    expect(msg).not.toMatch(/CSRF Failed/i)
    expect(msg.length).toBeGreaterThan(0)
  })

  it("explains offline without status code", () => {
    const msg = apiErrorMessage({ status: 0 })
    expect(msg).not.toMatch(/400|403|500|Bad Request/)
  })

  it("returns null status for unknown shapes", () => {
    expect(apiErrorStatus(null)).toBeNull()
    expect(apiErrorStatus("oops")).toBeNull()
  })
})
