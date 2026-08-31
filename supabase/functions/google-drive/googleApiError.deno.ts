import {
  GoogleApiError,
  isGoogleAccountRequiredError,
} from './googleApiError.ts';

Deno.test('reconhece destinatário sem Conta Google na resposta em português', () => {
  const error = new GoogleApiError(
    400,
    'Não há uma Conta do Google associada a esse endereço. Selecione a caixa "Notificar pessoas".',
    ['invalidSharingRequest'],
  );

  if (!isGoogleAccountRequiredError(error)) {
    throw new Error('A resposta deveria ser tratada como Conta Google necessária.');
  }
});

Deno.test('reconhece destinatário sem Conta Google na resposta em inglês', () => {
  const error = new GoogleApiError(
    400,
    'There is no Google Account associated with this email. Select Notify people.',
    ['invalidSharingRequest'],
  );

  if (!isGoogleAccountRequiredError(error)) {
    throw new Error('A resposta deveria ser tratada como Conta Google necessária.');
  }
});

Deno.test('não oculta outros erros de compartilhamento do Google', () => {
  const error = new GoogleApiError(400, 'The permission role is invalid.', ['invalidSharingRequest']);

  if (isGoogleAccountRequiredError(error)) {
    throw new Error('Um erro real de compartilhamento não pode ser ignorado.');
  }
});
