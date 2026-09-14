"use client";

import { useEffect, useState } from "react";
import type { GenerationMode } from "@/lib/adapters/types";
import type { ManagedHealth } from "./presentation";

type ConnectionSettings = {
  generationMode: GenerationMode;
  hasImproveApiKey?: boolean;
  improveProvider: "local" | "api";
  ollamaModel: string;
  unrestricted: boolean;
};

export function useStudioConnection() {
  const [settings, setSettings] = useState<ConnectionSettings | null>(null);
  const [health, setHealth] = useState<ManagedHealth | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let pending = false;
    async function read() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load the generation connection. Reload to retry.");
        const data = await response.json();
        if (!data.settings?.generationMode) throw new Error("Generation connection is missing.");
        if (!alive) return;
        setSettings(data.settings);
        setError("");
        if (data.settings.generationMode === "zermo") {
          const probe = await fetch("/api/health", { cache: "no-store" });
          if (!probe.ok) throw new Error("Could not check Zermo readiness. See Connections.");
          const result = await probe.json();
          if (alive) setHealth(result.health?.zermo ?? null);
        } else setHealth(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load connection.");
      } finally { pending = false; }
    }
    void read();
    window.addEventListener("focus", read);
    return () => { alive = false; window.removeEventListener("focus", read); };
  }, []);
  return { settings, health, error, zermo: settings?.generationMode === "zermo" };
}
