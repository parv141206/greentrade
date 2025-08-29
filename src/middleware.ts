import { NextRequest, NextResponse } from "next/server";

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const sessionToken = req.cookies.get("authjs.session-token")?.value;
  const isAuthenticated = !!sessionToken;

  console.log("Middleware Path:", path);
  console.log("Session Token Exists:", isAuthenticated);

  const publicPaths = ["/login"];

  if (publicPaths.includes(path)) {
    if (path === "/login" && isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    console.log(
      "Unauthenticated user accessing protected path. Redirecting to /login",
    );
    return NextResponse.redirect(new URL(`/login`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard", "/boards"],
};
