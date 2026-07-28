import { describe, expect, it } from 'vitest';
import { sanitizeRichHtml } from './sanitizeRichHtml';

describe('sanitizeRichHtml', () => {
  it('preserva a formatação editorial permitida', () => {
    const result = sanitizeRichHtml(
      '<p><strong>Tema</strong> <a href="https://example.com">saiba mais</a></p>'
    );

    expect(result).toContain('<strong>Tema</strong>');
    expect(result).toContain('href="https://example.com"');
  });

  it('remove scripts, eventos e protocolos perigosos', () => {
    const result = sanitizeRichHtml(
      '<img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">link</a>'
    );

    expect(result).not.toContain('script');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('<img');
  });
});
