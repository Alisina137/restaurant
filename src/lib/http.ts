import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(fn: () => Promise<T>) {
  const requestId = randomUUID();
  try {
    return Response.json(
      { data: await fn(), requestId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof ZodError
          ? 400
          : 500;
    const message =
      error instanceof HttpError
        ? error.message
        : error instanceof ZodError
          ? error.issues[0]?.message
          : "Something went wrong. Please try again.";
    if (status === 500)
      console.error(
        JSON.stringify({ level: "error", requestId, event: "request_failed" }),
      );
    return Response.json(
      { error: message, requestId },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export function sameOrigin(request: Request) {
  const expected = new URL(
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
  ).origin;
  if (request.headers.get("origin") !== expected)
    throw new HttpError(403, "This request is not allowed.");
}
export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new HttpError(413, "The file or request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "The file or request is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(request: Request) {
  try {
    return JSON.parse((await boundedBody(request, 32_000)).toString("utf8"));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "Invalid JSON request.");
  }
}
