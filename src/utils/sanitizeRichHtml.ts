import DOMPurify from 'dompurify';

const SAFE_RICH_TEXT_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'a',
  'span'
];

const SAFE_RICH_TEXT_ATTRIBUTES = ['href', 'target', 'rel', 'class'];

export function sanitizeRichHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS: SAFE_RICH_TEXT_TAGS,
    ALLOWED_ATTR: SAFE_RICH_TEXT_ATTRIBUTES,
    ALLOW_DATA_ATTR: false
  });
}
