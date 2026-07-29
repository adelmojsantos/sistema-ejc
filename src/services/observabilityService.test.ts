import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureAppError,
  clearLocalDiagnostics,
  getLocalDiagnostics,
} from './observabilityService';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('observabilityService', () => {
  beforeEach(() => {
    clearLocalDiagnostics();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('remove dados sensíveis antes de registrar o erro', () => {
    captureAppError(
      new Error('Falha para pessoa@example.com password=segredo eyJabc.def.ghi'),
      { source: 'test' }
    );

    const [event] = getLocalDiagnostics();
    expect(event.message).toContain('[email]');
    expect(event.message).toContain('password=[redacted]');
    expect(event.message).toContain('[token]');
    expect(event.message).not.toContain('pessoa@example.com');
    expect(event.message).not.toContain('segredo');
  });

  it('mantém apenas os eventos mais recentes da sessão', () => {
    for (let index = 0; index < 35; index += 1) {
      captureAppError(`Erro ${index}`, { source: 'test' });
    }

    const events = getLocalDiagnostics();
    expect(events).toHaveLength(30);
    expect(events[0].message).toBe('Erro 34');
    expect(events.at(-1)?.message).toBe('Erro 5');
  });
});
