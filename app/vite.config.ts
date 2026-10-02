/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  // 本番は https://www.chrom.jp/hit-and-blow/ 配下で配信する
  base: command === 'build' ? '/hit-and-blow/' : '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
}))
