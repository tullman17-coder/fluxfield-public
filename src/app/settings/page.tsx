"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GenerationMode, StudioSettings } from "@/lib/adapters/types";
import type { ManagedHealth } from "@/lib/studio/presentation";
import { ManagedConnection } from "@/components/studio/managed-connection";

async function loadHealth(force = false) {
  const response = await fetch(`/api/health${force ? "?refresh=1" : ""}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Connection check failed");
  const h = await response.json();
  const m = h.settings?.generationMode === "zermo" ? null : await fetch("/api/ollama-models").then(r => r.json()).catch(() => null);
  return { h, m };
}

const ENGINE_LABEL: Record<string, string> = {
  zermo: "Zermo API",
  "zermo-unreachable": "Zermo unavailable — no fallback",
  "local-studio": "Studio",
  comfyui: "Comfy",
  mock: "Preview art",
};

type Probe = {
  ok: boolean;
  reachable: boolean;
  detail: string;
  models?: string[];
};

type Health = {
  zermo?: ManagedHealth;
  comfy: boolean;
  ollama: boolean;
  tts: boolean;
  ffmpeg: boolean;
  studio: boolean;
  studioReady?: boolean;
  effectiveMode: string;
  netbirdHint: string | null;
  probes?: {
    studio: Probe;
    comfy: Probe;
    ollama: Probe;
    tts: Probe;
  };
  applied?: string[];
  found?: { kind: string; url: string; detail: string; ok: boolean }[];
  mesh?: {
    provider: "netbird" | "tailscale" | "none";
    selfName: string;
    connected: number;
    total: number;
    peers: {
      name: string;
      fqdn: string;
      ip: string;
      connected: boolean;
      self: boolean;
      role?: "factory" | "personal" | "other" | "self" | "loopback";
    }[];
  };
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clearKeys, setClearKeys] = useState({ studio: false, improve: false });
  const [message, setMessage] = useState<string | null>(null);

  function applyHealth(
    h: { settings?: Partial<StudioSettings>; health: Health },
    m: { models?: string[] } | null,
  ) {
    setSettings((current) =>
      current ? { ...current, ...(h.settings || {}) } : current,
    );
    setHealth(h.health);
    setOllamaModels(m?.models || h.health.probes?.ollama.models || []);
  }

  async function refresh(force = false) {
    const { h, m } = await loadHealth(force);
    applyHealth(h, m);
  }

  useEffect(() => {
    let alive = true;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: { settings: StudioSettings }) => {
        if (alive) setSettings(s.settings);
      })
      .catch(() => undefined);
    loadHealth()
      .then(({ h, m }) => {
        if (alive) applyHealth(h, m);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, clearStudioApiKey: clearKeys.studio, clearImproveApiKey: clearKeys.improve }),
      });
      if (!response.ok) throw new Error("Settings save failed");
      const saved = await response.json();
      setSettings(saved.settings);
      setClearKeys({ studio: false, improve: false });
      await refresh();
      setMessage("Saved.");
    } catch {
      setMessage("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <p className="text-[#8d838f]">Loading…</p>;
  }

  if (settings.generationMode === "zermo" && !showAdvanced) return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><p className="text-xs uppercase tracking-wider text-[#e77ae6]">Connections</p><h1 className="mt-2 text-3xl text-white">Your Zermo studio</h1><p className="mt-2 text-[#b8aebb]">One managed connection. No local addresses or mesh setup needed in this browser.</p></div>
      <ManagedConnection health={health?.zermo} />
      <div className="flex flex-wrap gap-3"><Button onClick={() => void refresh(true).catch(() => setMessage("Connection check failed. Try again."))}>Check connection</Button><Button variant="outline" onClick={() => setShowAdvanced(true)}>Advanced / other providers</Button></div>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {settings.generationMode === "zermo" ? <Button variant="outline" onClick={() => setShowAdvanced(false)}>Back to managed Zermo connection</Button> : null}
      {(settings.hasStudioApiKey || settings.hasImproveApiKey) ? <div className="flex flex-wrap gap-2">
        {settings.hasStudioApiKey ? <Button variant="outline" onClick={() => { setClearKeys(v => ({ ...v, studio: true })); setSettings({ ...settings, studioApiKey: "" }); }}>Clear saved Studio key{clearKeys.studio ? " on Save" : ""}</Button> : null}
        {settings.hasImproveApiKey ? <Button variant="outline" onClick={() => { setClearKeys(v => ({ ...v, improve: true })); setSettings({ ...settings, improveApiKey: "" }); }}>Clear saved rewrite key{clearKeys.improve ? " on Save" : ""}</Button> : null}
      </div> : null}
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-[#e77ae6]">
          Connections
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white md:text-4xl">
          Where your work gets made
        </h1>
        <p className="mt-2 text-[#b8aebb]">
          Image and video run on the factory box — DGX Spark. Other mesh
          machines stay visible. Personal stacks are never used for
          generation.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <HealthCard
          label="Studio"
          probe={health?.probes?.studio}
          fallbackOk={!!health?.studio}
          detail={settings.studioUrl}
        />
        <HealthCard
          label="Comfy"
          probe={health?.probes?.comfy}
          fallbackOk={!!health?.comfy}
          detail={settings.comfyUrl}
        />
        <HealthCard
          label="Ollama"
          probe={health?.probes?.ollama}
          fallbackOk={!!health?.ollama}
          detail={`${settings.ollamaUrl}${settings.ollamaModel ? ` · ${settings.ollamaModel}` : ""}`}
        />
        <HealthCard
          label="Voice"
          probe={health?.probes?.tts}
          fallbackOk={!!health?.tts}
          detail={settings.ttsUrl}
        />
        <HealthCard
          label="FFmpeg"
          fallbackOk={!!health?.ffmpeg}
          detail={settings.ffmpegEnabled ? "On" : "Off"}
        />
      </div>
      <p className="text-sm text-[#8d838f]">
        Making images with{" "}
        <span className="text-[#e77ae6]">
          {health ? (ENGINE_LABEL[health.effectiveMode] ?? health.effectiveMode) : "…"}
        </span>
      </p>
      {health?.applied?.length ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Found on the mesh and saved: {health.applied.join(" · ")}
        </p>
      ) : null}
      {health?.mesh && health.mesh.provider !== "none" ? (
        <div className="rounded-2xl border border-white/10 glass p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[#f5eff6]">
              Mesh · {health.mesh.provider}
              {health.mesh.selfName ? ` · this machine is ${health.mesh.selfName}` : ""}
            </p>
            <p className="text-xs text-[#8d838f]">
              {health.mesh.connected} connected of {health.mesh.total} peers
            </p>
          </div>
          <ul className="mt-3 grid gap-1 text-xs text-[#b8aebb] sm:grid-cols-2">
            {health.mesh.peers
              .filter((p) => !p.self)
              .map((peer) => (
                <li key={peer.fqdn || peer.ip}>
                  <span className={peer.connected ? "text-emerald-400" : "text-[#8d838f]"}>
                    {peer.connected ? "●" : "○"}
                  </span>{" "}
                  <span className="text-[#f5eff6]">{peer.name}</span>{" "}
                  {peer.role === "factory" ? (
                    <span className="text-emerald-400">factory</span>
                  ) : peer.role === "personal" ? (
                    <span className="text-amber-300">personal</span>
                  ) : null}{" "}
                  <span className="text-[#8d838f]">
                    {peer.fqdn || peer.ip}
                  </span>
                </li>
              ))}
          </ul>
          {health.found?.some((f) => f.ok) ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs uppercase tracking-wider text-[#8d838f]">
                Live services
              </p>
              {health.found
                .filter((f) => f.ok)
                .map((hit) => (
                  <div
                    key={`${hit.kind}-${hit.url}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
                  >
                    <p className="text-xs text-[#f5eff6]">
                      <span className="uppercase text-[#8d838f]">{hit.kind}</span>{" "}
                      {hit.url}
                      <span className="mt-0.5 block text-[#8d838f]">{hit.detail}</span>
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#d565d6] text-black hover:bg-[#e77ae6]"
                      onClick={() => {
                        const key =
                          hit.kind === "studio"
                            ? "studioUrl"
                            : hit.kind === "comfy"
                              ? "comfyUrl"
                              : hit.kind === "tts"
                                ? "ttsUrl"
                                : "ollamaUrl";
                        setSettings((s) => (s ? { ...s, [key]: hit.url } : s));
                      }}
                    >
                      Use
                    </Button>
                  </div>
                ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[#8d838f]">
          No mesh client found on this machine. Install Netbird (or Tailscale)
          so Fluxfield can see the other boxes.
        </p>
      )}
      {health?.netbirdHint ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {health.netbirdHint}
        </p>
      ) : null}

      <div className="space-y-5 rounded-2xl border border-white/10 glass p-5">
        <Field label="Generation source" hint="Zermo: Chroma images (Fast 4 / Detail 8 steps, CFG 1, within 1024px), ACE music (10–90s FLAC). No reference editing, TTS or native long video. Credentials: server-only ZERMO_API_KEY or ZERMO_API_KEY_FILE; optional ZERMO_API_BASE (default https://api.zermo.org).">
          <select
            className="flex h-10 w-full rounded-lg border border-white/10 bg-white/10 px-3 text-sm"
            value={settings.generationMode}
            onChange={(e) =>
              setSettings({
                ...settings,
                generationMode: e.target.value as GenerationMode,
              })
            }
          >
            <option value="auto">Automatic — factory Studio, then factory Comfy</option>
            <option value="local-studio">Studio only</option>
            <option value="zermo">Zermo API — images + music, no fallback</option>
            <option value="comfyui">Comfy only</option>
            <option value="mock">Preview art — no graphics card needed</option>
          </select>
          {settings.generationMode === "zermo" ? <p className="text-xs" role="status">{health?.zermo?.configured ? (health.zermo.ready ? "Zermo authenticated connection ready" : "Zermo configured but unreachable — no fallback") : "Zermo server credential not configured"}</p> : null}
        </Field>
        <Field
          label="Studio address"
          hint="DGX Spark on the mesh, like http://dgx-spark.netbird.selfhosted:18088. Old 100.x addresses will not reach it."
        >
          <Input
            value={settings.studioUrl}
            onChange={(e) =>
              setSettings({ ...settings, studioUrl: e.target.value })
            }
            className="border-white/10 bg-white/10"
          />
        </Field>
        <Field
          label="Studio key"
          hint="The same key your Studio app uses."
        >
          <Input
            type="password"
            value={settings.studioApiKey || ""}
            onChange={(e) =>
              setSettings({ ...settings, studioApiKey: e.target.value })
            }
            className="border-white/10 bg-white/10"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Comfy address"
          hint="Only if Comfy is listening on DGX. Leave blank otherwise — personal machines are rejected."
        >
          <Input
            value={settings.comfyUrl}
            onChange={(e) =>
              setSettings({ ...settings, comfyUrl: e.target.value })
            }
            className="border-white/10 bg-white/10"
          />
        </Field>
        <Field label="Comfy model (optional)">
          <Input
            value={settings.comfyCheckpoint}
            onChange={(e) =>
              setSettings({ ...settings, comfyCheckpoint: e.target.value })
            }
            placeholder="flux1-dev.safetensors"
            className="border-white/10 bg-white/10"
          />
        </Field>
        <Field
          label="Ollama address"
          hint="Ollama, or any OpenAI-style local server. Fluxfield scans 11434 / 1234 on this machine and will not call Connected unless a model is actually loaded."
        >
          <Input
            value={settings.ollamaUrl}
            onChange={(e) =>
              setSettings({ ...settings, ollamaUrl: e.target.value })
            }
            className="border-white/10 bg-white/10"
          />
        </Field>
        <Field
          label="Writing model"
          hint="Pick one you have already pulled, or type any name."
        >
          <Input
            value={settings.ollamaModel}
            onChange={(e) =>
              setSettings({ ...settings, ollamaModel: e.target.value })
            }
            className="border-white/10 bg-white/10"
            list="ollama-models"
            placeholder="llama3.2"
          />
          <datalist id="ollama-models">
            {ollamaModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          {ollamaModels.length ? (
            <p className="text-xs text-[#8d838f]">
              {ollamaModels.length} model{ollamaModels.length === 1 ? "" : "s"} ready
            </p>
          ) : null}
        </Field>
        <Field label="Voice address" hint="Piper, or any OpenAI-style speech service">
          <Input
            value={settings.ttsUrl}
            onChange={(e) =>
              setSettings({ ...settings, ttsUrl: e.target.value })
            }
            className="border-white/10 bg-white/10"
          />
        </Field>
        <Field label="Voice">
          <Input
            value={settings.ttsVoice}
            onChange={(e) =>
              setSettings({ ...settings, ttsVoice: e.target.value })
            }
            className="border-white/10 bg-white/10"
          />
        </Field>
        <Field
          label="Music address"
          hint="A local music model, if you run one. Blank writes the track here."
        >
          <Input
            value={settings.musicUrl}
            onChange={(e) =>
              setSettings({ ...settings, musicUrl: e.target.value })
            }
            placeholder="http://studio.netbird.cloud:8020"
            className="border-white/10 bg-white/10"
          />
        </Field>
        <Field label="Music model">
          <Input
            value={settings.musicModel}
            onChange={(e) =>
              setSettings({ ...settings, musicModel: e.target.value })
            }
            placeholder="ace-step-v1"
            className="border-white/10 bg-white/10"
          />
        </Field>
        <label className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-3 text-sm">
          <span>
            Stitch videos
            <span className="mt-1 block text-xs text-[#8d838f]">
              Joins explainer scenes and narration into one file. Needs FFmpeg
              installed.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.ffmpegEnabled}
            onChange={(e) =>
              setSettings({ ...settings, ffmpegEnabled: e.target.checked })
            }
            className="size-4 accent-[#d565d6]"
          />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-3 text-sm">
          <span>
            Take prompts as written
            <span className="mt-1 block text-xs text-[#8d838f]">
              For openweight models. Stops Fluxfield adding blocks of its own,
              tells your machine to leave its checker off, and adds a set of
              adult looks to the style list.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.unrestricted}
            onChange={(e) =>
              setSettings({ ...settings, unrestricted: e.target.checked })
            }
            className="size-4 accent-[#d565d6]"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={save}
            disabled={saving}
            className="bg-[#d565d6] font-semibold text-black hover:bg-[#e77ae6]"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => void refresh(true)}
            className="border-white/15 bg-white/5 text-[#f5eff6]"
          >
            Scan the mesh
          </Button>
        </div>
        {message ? <p className="text-sm text-[#b8aebb]">{message}</p> : null}
      </div>

      <div className="space-y-5 rounded-2xl border border-white/10 glass p-5">
        <div>
          <h2 className="text-[#f5eff6]">Rewriting prompts</h2>
          <p className="mt-1 text-sm text-[#b8aebb]">
            Sets what happens when you tap <strong>Rewrite</strong>. Use the
            model on your own machine, or a cloud key.
          </p>
        </div>
        <Field label="Rewrite with">
          <select
            className="flex h-10 w-full rounded-lg border border-white/10 bg-white/10 px-3 text-sm"
            value={settings.improveProvider}
            onChange={(e) =>
              setSettings({
                ...settings,
                improveProvider: e.target.value as "local" | "api",
              })
            }
          >
            <option value="local">My model</option>
            <option value="api">Cloud</option>
          </select>
        </Field>
        <Field
          label="Cloud address"
          hint="For example https://api.openai.com/v1"
        >
          <Input
            value={settings.improveApiBase}
            onChange={(e) =>
              setSettings({ ...settings, improveApiBase: e.target.value })
            }
            className="border-white/10 bg-white/10"
          />
        </Field>
        <Field label="Cloud key" hint="Only used when you pick Cloud above.">
          <Input
            type="password"
            value={settings.improveApiKey || ""}
            onChange={(e) =>
              setSettings({ ...settings, improveApiKey: e.target.value })
            }
            className="border-white/10 bg-white/10"
            autoComplete="off"
          />
        </Field>
        <Field label="Cloud model">
          <Input
            value={settings.improveApiModel}
            onChange={(e) =>
              setSettings({ ...settings, improveApiModel: e.target.value })
            }
            className="border-white/10 bg-white/10"
          />
        </Field>
      </div>

      <div className="rounded-2xl border border-white/10 p-5 text-sm text-[#b8aebb]">
        <h2 className="mb-2 text-[#f5eff6]">What each one does</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-zinc-200">Studio</strong> — makes images
            and video frames on DGX. This is the one worth setting up first.
          </li>
          <li>
            <strong className="text-zinc-200">Comfy</strong> — only if it is
            running on DGX. Other Comfy boxes on the mesh are ignored.
          </li>
          <li>
            <strong className="text-zinc-200">Ollama</strong> — writes campaign
            copy and explainer scripts.
          </li>
          <li>
            <strong className="text-zinc-200">Voice</strong> — reads explainer
            scripts out loud.
          </li>
          <li>
            <strong className="text-zinc-200">FFmpeg</strong> — turns explainer
            scenes and narration into a single video.
          </li>
        </ul>
        <p className="mt-3">
          Address each machine by its Netbird name. Nothing here is required —
          with none of it set up you still get preview art to lay out against.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-[#8d838f]">{hint}</p> : null}
    </div>
  );
}

function HealthCard({
  label,
  probe,
  fallbackOk,
  detail,
}: {
  label: string;
  probe?: Probe;
  fallbackOk: boolean;
  detail: string;
}) {
  const ok = probe?.ok ?? fallbackOk;
  const warn = !ok && !!probe?.reachable;
  const tone = ok ? "ok" : warn ? "warn" : "down";
  const status = ok
    ? "Connected"
    : warn
      ? "Reached — not usable"
      : "Not found";
  return (
    <div className="rounded-2xl border border-white/10 glass p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#f5eff6]">{label}</span>
        <span
          className={
            tone === "ok"
              ? "text-emerald-400"
              : tone === "warn"
                ? "text-amber-300"
                : "text-[#8d838f]"
          }
        >
          {status}
        </span>
      </div>
      <p className="mt-2 truncate text-xs text-[#8d838f]">{detail}</p>
      {probe?.detail ? (
        <p className="mt-1 text-xs text-[#8d838f]">{probe.detail}</p>
      ) : null}
    </div>
  );
}
