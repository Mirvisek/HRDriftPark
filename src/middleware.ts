import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;
  const isReqAdmin = pathname.startsWith("/admin") || pathname.startsWith("/(portal)/admin");

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isReqAdmin) {
    const role = (req.auth?.user as { role?: string })?.role;
    if (role !== "owner" && role !== "manager" && role !== "technik") {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/alerts/:path*",
    "/analytics/:path*",
    "/availability/:path*",
    "/checklists/:path*",
    "/dashboard/:path*",
    "/events/:path*",
    "/magazyn/:path*",
    "/schedule/:path*",
    "/settings/:path*",
    "/tasks/:path*",
    "/timesheet/:path*",
    "/today/:path*",
    "/worktime/:path*",
  ],
};
