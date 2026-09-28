import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // L6: раньше только .test.ts — .tsx-тесты компонентов молча не бежали.
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
