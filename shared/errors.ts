/**
 * Tiny HTTP error class shared between server route handlers and the tRPC
 * context. Carries an HTTP status code so the express layer can map it to a
 * response without losing the original message.
 */
class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}
export const ForbiddenError = (msg: string) => new HttpError(403, msg);
