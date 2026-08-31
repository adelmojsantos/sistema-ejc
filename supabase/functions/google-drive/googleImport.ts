export type GoogleImportFileType = 'document' | 'spreadsheet';

export interface GoogleImportDescriptor {
  fileType: GoogleImportFileType;
  sourceMimeType: string;
  targetMimeType: string;
  googleName: string;
}

const IMPORT_FORMATS: Record<string, Omit<GoogleImportDescriptor, 'googleName'>> = {
  doc: {
    fileType: 'document',
    sourceMimeType: 'application/msword',
    targetMimeType: 'application/vnd.google-apps.document',
  },
  docx: {
    fileType: 'document',
    sourceMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    targetMimeType: 'application/vnd.google-apps.document',
  },
  txt: {
    fileType: 'document',
    sourceMimeType: 'text/plain',
    targetMimeType: 'application/vnd.google-apps.document',
  },
  csv: {
    fileType: 'spreadsheet',
    sourceMimeType: 'text/csv',
    targetMimeType: 'application/vnd.google-apps.spreadsheet',
  },
  xlsx: {
    fileType: 'spreadsheet',
    sourceMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    targetMimeType: 'application/vnd.google-apps.spreadsheet',
  },
};

export function googleImportDescriptor(fileName: string): GoogleImportDescriptor | null {
  const normalizedName = fileName.trim();
  const extensionMatch = normalizedName.match(/\.([^.]+)$/);
  if (!extensionMatch) return null;

  const extension = extensionMatch[1].toLowerCase();
  const format = IMPORT_FORMATS[extension];
  if (!format) return null;

  const googleName = normalizedName.slice(0, -extensionMatch[0].length).trim();
  if (!googleName) return null;

  return { ...format, googleName };
}
