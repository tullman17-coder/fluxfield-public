import type { ManagedHealth } from "@/lib/studio/presentation";

export function ManagedConnection({ health }: { health: ManagedHealth | null | undefined }) {
  return <section aria-label="Managed Zermo connection" className="space-y-4 rounded-2xl border border-white/10 glass p-5">
    <h2 className="text-lg text-[#f5eff6]">Zermo · managed connection</h2>
    <p role="status" className="text-sm text-[#b8aebb]">{!health ? "Checking connection…" : !health.configured ? "Server credential not configured" : !health.apiReachable ? "Configured · API unreachable" : health.ready ? "API reachable · ready to submit" : "API reachable · some operations are not ready"}</p>
    <div className="grid gap-3 sm:grid-cols-3">
      {([['text', 'Writing'], ['image', 'Images'], ['music', 'Music']] as const).map(([key, label]) => <div key={key} className="min-w-0 rounded-xl border border-white/10 p-3">
        <h3 className="text-sm text-[#f5eff6]">{label}</h3>
        <p className="mt-2 break-words text-sm text-[#b8aebb]">{health?.[key]?.model || "Model not reported"}</p>
        <p className="mt-1 text-xs text-[#8d838f]">{!health ? "Checking…" : health[key]?.ready ? "Ready to submit" : "Not ready"}</p>
      </div>)}
    </div>
    <p className="text-xs text-[#b8aebb]">Media worker configuration: {!health ? "checking" : health.workerConfigured ? "present" : "not ready"}. Spark controls the service; media runs on its configured worker. Connection checks are not proof of a completed generation.</p>
    <p className="text-sm text-[#b8aebb]">Writing, Chroma image generation and ACE music. Images: Fast 4 or Detail 8 steps, CFG 1, within 1024px. Music: 10–90 seconds, original FLAC download.</p>
    <p className="text-xs text-[#8d838f]">Explainer: scripts + still scene art. No reference editing, narration or native video generation in this connection. No preview fallback on failure. Credentials stay on the server.</p>
    {health?.error ? <p role="alert" className="text-sm text-amber-300">{health.error}</p> : null}
  </section>;
}
