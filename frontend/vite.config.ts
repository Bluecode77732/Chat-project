import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // src로 범위를 좁혀 `vitest run`이 Playwright e2e 스펙(e2e/*.spec.ts)을 집지 않게 함 —
    // 이 스펙들은 Playwright 러너 밖에서 test()를 호출해 수집 단계에서 실패함.
    // exclude는 기본값 유지로 node_modules 제외는 그대로 유지됨.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
