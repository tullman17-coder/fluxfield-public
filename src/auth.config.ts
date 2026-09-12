import type { NextAuthConfig } from "next-auth";

export const authDisabled =
  process.env.AUTH_DISABLED === "true" ||
  process.env.AUTH_DISABLED === "1" ||
  !process.env.AUTHELIA_ISSUER;

/**
 * Edge-safe fragment used by middleware. Providers stay in `auth.ts`
 * because the OIDC client is not Edge-compatible.
 */
export const authConfig = {
  providers: [],
  trustHost: true,
  pages: { signIn: "/sign-in" },
  callbacks: {
    authorized({ auth }) {
      if (authDisabled) return true;
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
