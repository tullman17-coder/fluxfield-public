"use client";

import { useEffect, useState } from "react";

type SessionUser = { name?: string | null; email?: string | null };

export function AuthStatus() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        setUser(d?.user ?? null);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  if (!ready || !user) return null;

  const label = user.name || user.email || "Signed in";

  return (
    <div className="grid shrink-0 justify-items-center gap-1 border-t border-white/10 pt-3">
      <span
        className="max-w-full truncate px-1 text-center text-[9px] text-[#b8aebb] sm:text-[10px]"
        title={label}
      >
        {label}
      </span>
      <button
        type="button"
        className="min-h-9 rounded-lg px-2 text-[9px] text-[#8d838f] hover:text-[#f5eff6] sm:text-[11px]"
        onClick={() => {
          window.location.href = "/api/auth/signout?callbackUrl=/sign-in";
        }}
      >
        Sign out
      </button>
    </div>
  );
}
