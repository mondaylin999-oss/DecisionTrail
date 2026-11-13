import { NextResponse, type NextRequest } from "next/server";

const allowedMethods = "GET, POST, PATCH, OPTIONS";
const allowedHeaders = "Authorization, Content-Type, X-Firebase-AppCheck";

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const frontendOrigin = process.env.FRONTEND_ORIGIN?.replace(/\/$/, "");

  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    addCorsHeaders(response, origin, frontendOrigin);
    response.headers.set("Access-Control-Allow-Methods", allowedMethods);
    response.headers.set("Access-Control-Allow-Headers", allowedHeaders);
    response.headers.set("Access-Control-Max-Age", "86400");
    return response;
  }

  const response = NextResponse.next();
  addCorsHeaders(response, origin, frontendOrigin);
  return response;
}

function addCorsHeaders(response: NextResponse, origin: string | null, allowedOrigin: string | undefined) {
  response.headers.append("Vary", "Origin");
  if (origin && allowedOrigin && origin === allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
}

export const config = {
  matcher: "/api/:path*",
};
