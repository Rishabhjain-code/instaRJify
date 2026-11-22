export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = "GET", body, headers = {}, signal } = {}) {
  const multipart = body instanceof FormData;
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: "same-origin",
    signal,
    headers: {
      ...(body && !multipart && { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(
      "The server returned an unexpected response. Please try again.",
      response.status,
      "UNEXPECTED_RESPONSE",
    );
  }
  const payload = await response.json();
  if (!response.ok) {
    const details = payload.error?.fields
      ?.map((field) => `${field.field}: ${field.message}`)
      .join(". ");
    throw new ApiError(
      details || payload.error?.message || "The request could not be completed",
      response.status,
      payload.error?.code,
    );
  }
  return payload.data;
}
