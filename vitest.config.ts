import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', '**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/components/ProtectedRoute.tsx',
        'src/components/ConfirmDialog.tsx',
        'src/contexts/EncontroContext.tsx',
        'src/contexts/EquipeContext.tsx',
        'src/pages/Public/QuadranteAuthPage.tsx',
        'src/utils/sanitizeRichHtml.ts',
        'src/utils/userFacingError.ts',
      ],
    },
  },
});
