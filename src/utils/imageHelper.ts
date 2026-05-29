/**
 * Utilidades para manipulação e compressão de imagens no frontend antes de enviar ao servidor.
 */

/**
 * Comprime uma imagem de forma assíncrona usando HTML5 Canvas.
 * Limita a dimensão máxima (largura ou altura) a 1600px e reduz a qualidade JPEG para 0.8,
 * o que reduz drasticamente o tamanho do arquivo (de 5MB+ para ~350KB) mantendo legibilidade perfeita para IA.
 * 
 * @param file O arquivo de imagem selecionado pelo usuário
 * @param maxWidth Largura máxima permitida (padrão: 1600px)
 * @param maxHeight Altura máxima permitida (padrão: 1600px)
 * @param quality Qualidade do JPEG resultante entre 0.0 e 1.0 (padrão: 0.8)
 * @returns Uma Promise contendo a imagem em formato Data URI Base64 comprimida
 */
export function compressImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Garante que o arquivo é de fato uma imagem
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo selecionado não é uma imagem válida.'));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcula a nova proporção se exceder os limites de dimensão
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível obter o contexto 2D do Canvas.'));
          return;
        }

        // Desenha a imagem redimensionada no canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Exporta para Data URL como jpeg comprimido
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };

      img.onerror = (err) => {
        reject(err);
      };
    };

    reader.onerror = (err) => {
      reject(err);
    };
  });
}
