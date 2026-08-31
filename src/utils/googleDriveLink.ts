export type GoogleDriveFileType = 'document' | 'spreadsheet' | 'file';

export interface GoogleDriveLink {
  fileId: string;
  fileType: GoogleDriveFileType;
  normalizedUrl: string;
}

const GOOGLE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;

function requireValidFileId(fileId: string | null): string {
  if (!fileId || !GOOGLE_FILE_ID_PATTERN.test(fileId)) {
    throw new Error('O link não contém um identificador válido do Google Drive.');
  }

  return fileId;
}

export function parseGoogleDriveLink(
  rawUrl: string,
  fallbackType: GoogleDriveFileType = 'file'
): GoogleDriveLink {
  let url: URL;

  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error('Informe um link válido do Google Drive.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('O link do Google deve usar HTTPS.');
  }

  if (url.hostname === 'docs.google.com') {
    const documentMatch = url.pathname.match(/^\/document\/(?:u\/\d+\/)?d\/([^/]+)/);
    if (documentMatch) {
      const fileId = requireValidFileId(documentMatch[1]);
      return {
        fileId,
        fileType: 'document',
        normalizedUrl: `https://docs.google.com/document/d/${fileId}/edit`,
      };
    }

    const spreadsheetMatch = url.pathname.match(/^\/spreadsheets\/(?:u\/\d+\/)?d\/([^/]+)/);
    if (spreadsheetMatch) {
      const fileId = requireValidFileId(spreadsheetMatch[1]);
      return {
        fileId,
        fileType: 'spreadsheet',
        normalizedUrl: `https://docs.google.com/spreadsheets/d/${fileId}/edit`,
      };
    }

    throw new Error('Use um link de um Documento ou Planilha Google.');
  }

  if (url.hostname === 'drive.google.com') {
    const pathMatch = url.pathname.match(/^\/file\/d\/([^/]+)/);
    const fileId = requireValidFileId(pathMatch?.[1] ?? url.searchParams.get('id'));

    return {
      fileId,
      fileType: fallbackType,
      normalizedUrl: `https://drive.google.com/file/d/${fileId}/view`,
    };
  }

  throw new Error('Use somente links oficiais de docs.google.com ou drive.google.com.');
}

export function googleDriveMimeType(fileType: GoogleDriveFileType): string {
  if (fileType === 'document') return 'application/vnd.google-apps.document';
  if (fileType === 'spreadsheet') return 'application/vnd.google-apps.spreadsheet';
  return 'application/vnd.google-apps.file';
}
