import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  envDir: '../',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/pages/QuizPage.tsx', 'src/components/SectionProgressCapsules.tsx', 'src/hooks/useGenerationPolling.ts'],
      exclude: [
        'src/main.tsx',
        'src/App.tsx',
        'src/assets/**',
        'src/types/**',
        'src/constants/**',
        'src/styles/**',
        'src/lib/api.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
