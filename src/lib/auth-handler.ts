import { sameOrigin, HttpError } from "./http";
export async function secureAuthHandler(
  auth: { handler: (request: Request) => Promise<Response> },
  request: Request,
) {
  if (request.method === "POST") {
    try {
      sameOrigin(request);
    } catch (e) {
      if (e instanceof HttpError)
        return Response.json({ message: e.message }, { status: e.status });
      throw e;
    }
  }
  return auth.handler(request);
}
