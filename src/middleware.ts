// File: middleware.ts

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt"; // <-- Import getToken

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // --- STEP 1: Get the decoded token instead of just checking for a cookie ---
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const isAuthenticated = !!token;

  const publicPaths = ["/login"];
  const adminPaths = ["/admin", "/api/admin"]; // <-- Define admin-only paths

  // --- STEP 2: Logic for Public Paths (Login Page) ---
  if (publicPaths.includes(path)) {
    if (isAuthenticated) {
      // If logged in, redirect from /login to the dashboard
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    // If not logged in and on a public path, allow access
    return NextResponse.next();
  }

  // --- STEP 3: Logic for Protected Paths ---
  if (!isAuthenticated) {
    // If not logged in and trying to access any protected path, redirect to login
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${path}`, req.url),
    );
  }

  // --- STEP 4: Logic for Admin-Only Paths ---
  const isAccessingAdminPath = adminPaths.some((p) => path.startsWith(p));
  if (isAccessingAdminPath && token.role !== "admin") {
    // If a non-admin tries to access an admin path, redirect them
    return NextResponse.redirect(new URL("/dashboard", req.url)); // Or a "/forbidden" page
  }

  // If all checks pass, allow the request to continue
  return NextResponse.next();
}

export const config = {
  // Update the matcher to include your new admin path
  matcher: ["/login", "/dashboard", "/boards", "/admin/:path*"],
};
