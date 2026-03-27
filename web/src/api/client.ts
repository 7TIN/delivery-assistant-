const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

export const apiBaseUrl = rawBaseUrl.replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function resolveUrl(path: string): string {
  if (!apiBaseUrl) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(resolveUrl(path), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as unknown)
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : response.statusText || "Request failed";

    throw new ApiError(message, response.status, body);
  }

  return body as T;
}
