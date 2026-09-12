import NextAuth from "next-auth";
import { authConfig, authDisabled } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (authDisabled) return NextResponse.next();

  const path = req.nextUrl.pathname;
  if (
    path.startsWith("/api/auth") ||
    path.startsWith("/api/health") ||
    path === "/sign-in"
  ) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)",
  ],
};
