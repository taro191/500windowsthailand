/** A failure to report to the client as `{ success: false, error }` with an HTTP status. */
export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 502 | 503,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

export const badRequest = (message: string, extra?: Record<string, unknown>) => new ApiError(400, message, extra)
export const notFound = (message: string) => new ApiError(404, message)
export const conflict = (message: string, extra?: Record<string, unknown>) => new ApiError(409, message, extra)
export const forbidden = (message: string, extra?: Record<string, unknown>) => new ApiError(403, message, extra)
