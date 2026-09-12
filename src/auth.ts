import NextAuth from "next-auth";
import { authConfig, authDisabled } from "@/auth.config";

const providers = [];

if (!authDisabled && process.env.AUTHELIA_ISSUER) {
  providers.push({
    id: "authelia",
    name: "Authelia",
    type: "oidc" as const,
    issuer: process.env.AUTHELIA_ISSUER,
    clientId: process.env.AUTHELIA_CLIENT_ID!,
    clientSecret: process.env.AUTHELIA_CLIENT_SECRET!,
    wellKnown: `${process.env.AUTHELIA_ISSUER.replace(/\/$/, "")}/.well-known/openid-configuration`,
    authorization: { params: { scope: "openid profile email" } },
    checks: ["pkce", "state"] as ("pkce" | "state")[],
    profile(profile: Record<string, unknown>) {
      return {
        id: String(profile.sub),
        name:
          (profile.name as string) ||
          (profile.preferred_username as string) ||
          (profile.email as string) ||
          "Signed in",
        email: (profile.email as string) || null,
        image: null,
      };
    },
  });
}

export { authDisabled };

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  secret: process.env.AUTH_SECRET || "fluxfield-dev-only-change-me",
  session: { strategy: "jwt" },
});
