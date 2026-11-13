import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}'],
      // URLs ficticias: las pruebas NUNCA llaman a AWS.
      env: {
        VITE_AUTH_API_URL: 'https://auth.test/dev',
        VITE_ATTENDANCE_API_URL: 'https://attendance.test/dev',
      },
    },
  })
)
