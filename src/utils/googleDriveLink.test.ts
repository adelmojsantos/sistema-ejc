import { describe, expect, it } from 'vitest';
import { googleDriveMimeType, parseGoogleDriveLink } from './googleDriveLink';

describe('parseGoogleDriveLink', () => {
  it('normaliza um link do Google Docs e remove parâmetros extras', () => {
    expect(parseGoogleDriveLink(
      'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit?usp=sharing'
    )).toEqual({
      fileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz',
      fileType: 'document',
      normalizedUrl: 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit',
    });
  });

  it('reconhece um link de planilha com seletor de conta', () => {
    expect(parseGoogleDriveLink(
      'https://docs.google.com/spreadsheets/u/1/d/1SheetIdentifier_12345/edit#gid=0'
    ).fileType).toBe('spreadsheet');
  });

  it('aceita links de arquivo e respeita o tipo informado', () => {
    expect(parseGoogleDriveLink(
      'https://drive.google.com/file/d/1DriveIdentifier_12345/view?usp=sharing',
      'document'
    )).toEqual({
      fileId: '1DriveIdentifier_12345',
      fileType: 'document',
      normalizedUrl: 'https://drive.google.com/file/d/1DriveIdentifier_12345/view',
    });
  });

  it('aceita o formato open?id do Drive', () => {
    expect(parseGoogleDriveLink(
      'https://drive.google.com/open?id=1DriveIdentifier_67890'
    ).fileId).toBe('1DriveIdentifier_67890');
  });

  it.each([
    'http://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit',
    'https://docs.google.com.evil.example/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit',
    'https://example.com/arquivo',
    'javascript:alert(1)',
  ])('rejeita links não oficiais ou inseguros: %s', (url) => {
    expect(() => parseGoogleDriveLink(url)).toThrow();
  });
});

describe('googleDriveMimeType', () => {
  it('mapeia os tipos para MIME types do Google', () => {
    expect(googleDriveMimeType('document')).toBe('application/vnd.google-apps.document');
    expect(googleDriveMimeType('spreadsheet')).toBe('application/vnd.google-apps.spreadsheet');
    expect(googleDriveMimeType('file')).toBe('application/vnd.google-apps.file');
  });
});
