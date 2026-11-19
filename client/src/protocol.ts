/** Shared public transport values; no product policy or server imports. */
export type JsonObject = { [key: string]: unknown };
export class JobHuntError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;
  /** A short sentence the service wrote for a person, set only for a refused tool call. Never a credential or the request. */
  readonly detail?: string;
  constructor(code: string, status = 0, requestId?: string, retryAfterSeconds?: number, detail?: string) {
    super(code); this.name = 'JobHuntError'; this.code = code; this.status = status;
    this.requestId = requestId; this.retryAfterSeconds = retryAfterSeconds; this.detail = detail;
  }
}

export function record(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
