const DEFAULT_MAX_INPUT_BYTES = 15 * 1024 * 1024;
const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.82;

export interface ImageOptimizationOptions {
  maxInputBytes?: number;
  maxDimension?: number;
  quality?: number;
}

const passthroughTypes = new Set([
  'image/gif',
  'image/svg+xml',
]);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível processar a imagem selecionada.'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível otimizar a imagem.')),
      'image/webp',
      quality,
    );
  });
}

/**
 * Redimensiona fotos no navegador e converte para WebP antes do upload.
 * GIF/SVG são preservados para não perder animação ou conteúdo vetorial.
 */
export async function optimizeImageForUpload(
  file: File,
  options: ImageOptimizationOptions = {},
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido.');
  }

  const maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
  if (file.size > maxInputBytes) {
    throw new Error(`A imagem deve ter no máximo ${Math.round(maxInputBytes / 1024 / 1024)} MB.`);
  }

  if (passthroughTypes.has(file.type)) return file;

  const image = await loadImage(file);
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('O navegador não oferece suporte à otimização de imagens.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, options.quality ?? DEFAULT_QUALITY);
  if (blob.size >= file.size && scale === 1) return file;

  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'imagem';
  return new File([blob], `${baseName}.webp`, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}

export function getFileExtension(file: File, fallback = 'bin') {
  if (file.type === 'image/webp') return 'webp';
  return file.name.split('.').pop()?.toLowerCase() || fallback;
}

export const IMMUTABLE_PUBLIC_UPLOAD_OPTIONS = {
  cacheControl: '31536000',
  upsert: false,
} as const;
