import i18n from '../../i18n';

export interface ApiErrorPayload {
  code: string;
  message?: string;
  details?: unknown;
  statusCode?: number;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(payload: ApiErrorPayload, statusCode: number) {
    super(payload.message ?? payload.code);
    this.code = payload.code;
    this.statusCode = statusCode;
    this.details = payload.details;
    this.name = 'ApiError';
  }

  translate(): string {
    const key = `errors:${this.code}`;
    const translated = i18n.t(key);
    if (translated && translated !== key) return translated;
    return this.message || i18n.t('errors:UNKNOWN');
  }
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string'
  );
}

export async function fetchWithErrorMapping(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (err) {
    throw new ApiError({ code: 'NETWORK_ERROR', message: (err as Error)?.message }, 0);
  }

  if (response.ok) return response;

  let payload: ApiErrorPayload | undefined;
  try {
    const text = await response.clone().text();
    if (text) {
      const parsed = JSON.parse(text);
      if (isApiErrorPayload(parsed)) {
        payload = parsed;
      } else if (parsed && typeof parsed === 'object' && 'error' in parsed && isApiErrorPayload((parsed as { error: unknown }).error)) {
        payload = (parsed as { error: ApiErrorPayload }).error;
      }
    }
  } catch {
    // fallthrough
  }

  if (!payload) {
    const code =
      response.status === 401 ? 'AUTH_TOKEN_INVALID' :
      response.status === 403 ? 'FORBIDDEN' :
      response.status === 404 ? 'UNKNOWN' :
      'UNKNOWN';
    payload = { code, message: response.statusText };
  }

  throw new ApiError(payload, response.status);
}

export function translateError(err: unknown): string {
  if (err instanceof ApiError) return err.translate();
  if (err instanceof Error) return err.message;
  return i18n.t('errors:UNKNOWN');
}
