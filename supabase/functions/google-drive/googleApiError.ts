export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly reasons: string[] = [],
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

export function isGoogleAccountRequiredError(error: unknown) {
  if (!(error instanceof GoogleApiError) || error.status !== 400) return false;

  const message = error.message.toLocaleLowerCase();
  const isInvalidSharingRequest = error.reasons.includes('invalidSharingRequest');
  const requiresNotification = message.includes('sendnotificationemail')
    || message.includes('notify people')
    || message.includes('notificar pessoas');
  const hasNoAssociatedAccount = message.includes('no google account associated')
    || message.includes('não há uma conta do google associada')
    || message.includes('não existe uma conta do google associada');

  return requiresNotification && (isInvalidSharingRequest || hasNoAssociatedAccount);
}
