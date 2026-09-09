export class LocalSourceAccessPaused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalSourceAccessPaused";
  }
}
