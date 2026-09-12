import { authDisabled, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  if (authDisabled) {
    redirect("/");
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e77ae6]">
          Fluxfield
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[#f5eff6]">
          Sign in to continue
        </h1>
        <p className="mt-2 text-sm text-[#b8aebb]">
          Your studio opens after Authelia knows who you are.
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signIn("authelia", { redirectTo: callbackUrl });
        }}
      >
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-[#e77ae6] px-6 text-sm font-semibold text-[#1a101c]"
        >
          Continue with Authelia
        </button>
      </form>
    </div>
  );
}
