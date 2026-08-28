import { googleImportDescriptor } from './googleImport.ts';

Deno.test('converte documentos editáveis para Documento Google', () => {
  for (const name of ['Ata.doc', 'Ata.docx', 'Ata.txt']) {
    const descriptor = googleImportDescriptor(name);
    if (descriptor?.fileType !== 'document' || descriptor.googleName !== 'Ata') {
      throw new Error(`Formato não reconhecido corretamente: ${name}`);
    }
  }
});

Deno.test('converte planilhas editáveis para Planilha Google', () => {
  for (const name of ['Lista.csv', 'Lista.xlsx']) {
    const descriptor = googleImportDescriptor(name);
    if (descriptor?.fileType !== 'spreadsheet' || descriptor.googleName !== 'Lista') {
      throw new Error(`Formato não reconhecido corretamente: ${name}`);
    }
  }
});

Deno.test('não envia PDF ou imagem para conversão', () => {
  for (const name of ['Documento.pdf', 'Foto.jpg', 'Imagem.png']) {
    if (googleImportDescriptor(name) !== null) {
      throw new Error(`Formato não editável aceito indevidamente: ${name}`);
    }
  }
});
