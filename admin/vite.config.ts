import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5174,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // src로 수집 범위를 좁혀 vitest run이 Playwright e2e 스펙(e2e/*.spec.ts)까지
    // 집어가지 않게 함 — 이 스펙들은 Playwright 러너 밖에서 test()를 호출해 수집이 깨짐.
    // exclude는 기본값 그대로 둬도 node_modules는 제외됨.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
