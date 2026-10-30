export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(35000),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ. Kiểm tra backend và thử lại nhé.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(data?.error ?? 'Có lỗi xảy ra. Vui lòng thử lại.', response.status);
  return data as T;
}
export const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
export function readStorage<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* App remains usable when browser storage is disabled. */
  }
}
