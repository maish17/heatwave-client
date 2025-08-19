export class ExtractorError<TCode extends string> extends Error {
  constructor(public code: TCode, message: string, public cause?: unknown) {
    super(message);
    this.name = "ExtractorError";
  }
}
