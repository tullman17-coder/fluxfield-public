"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GenerationMode, StudioSettings } from "@/lib/adapters/types";

type Health = {
  comfy: boolean;
  ollama: boolean;
  tts: boolean;
  ffmpeg: boolean;
  studio: boolean;
  effectiveMode: string;
  netbirdHint: string | null;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const [s, h] = await Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
    ]);
    setSettings(s.settings);
    setHealth(h.health);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      await refresh();
      setMessage("Saved. Health re-probed.");
    } catch {
      setMessage("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <p className="text-zinc-500">Loading adapters…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-[#e77ae6]">
          Self-host adapters
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white md:text-4xl">
          Point Fieldbench at your model machine
        </h1>
        <p className="mt-2 text-zinc-400">
          Wrappers and Explainer stay on this app. Heavy generation can live on
          another mesh peer — Local Studio controller, ComfyUI, Ollama,
          Piper/OpenAI-TTS, FFmpeg.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <HealthCard
          label="Local Studio"
          ok={!!health?.studio}
          detail={settings.studioUrl}
        />
        <HealthCard label="ComfyUI" ok={!!health?.comfy} detail={settings.comfyUrl} />
        <HealthCard label="Ollama" ok={!!health?.ollama} detail={settings.ollamaUrl} />
        <HealthCard label="TTS" ok={!!health?.tts} detail={settings.ttsUrl} />
        <HealthCard
          label="FFmpeg"
          ok={!!health?.ffmpeg}
          detail={settings.ffmpegEnabled ? "enabled" : "disabled"}
        />
      </div>
      <p className="text-sm text-zinc-500">
        Effective mode:{" "}
        <span className="text-[#e77ae6]">{health?.effectiveMode || "…"}</span>
      </p>
      {health?.netbirdHint ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {health.netbirdHint}
        </p>
      ) : null}

      <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <Field label="Generation mode">
          <select
            className="flex h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm"
            value={settings.generationMode}
            onChange={(e) =>
              setSettings({
                ...settings,
                generationMode: e.target.value as GenerationMode,
              })
            }
          >
            <option value="auto">auto (Local Studio → Comfy → mock)</option>
            <option value="local-studio">local-studio</option>
            <option value="comfyui">comfyui</option>
            <option value="mock">mock</option>
          </select>
        </Field>
        <Field
          label="Local Studio URL"
          hint="Prefer Netbird peer DNS, e.g. http://studio.netbird.selfhosted:18088 — avoid leftover Tailscale 100.x hosts"
        >
          <Input
            value={settings.studioUrl}
            onChange={(e) =>
              setSettings({ ...settings, studioUrl: e.target.value })
            }
            className="border-white/10 bg-black/40"
          />
        </Field>
        <Field
          label="Local Studio API key"
          hint="Bearer for POST /v1/images/generations (same key Local Dream Studio uses)"
        >
          <Input
            type="password"
            value={settings.studioApiKey}
            onChange={(e) =>
              setSettings({ ...settings, studioApiKey: e.target.value })
            }
            className="border-white/10 bg-black/40"
            autoComplete="off"
          />
        </Field>
        <Field label="ComfyUI URL" hint="http://GPU-BOX:8188">
          <Input
            value={settings.comfyUrl}
            onChange={(e) =>
              setSettings({ ...settings, comfyUrl: e.target.value })
            }
            className="border-white/10 bg-black/40"
          />
        </Field>
        <Field label="Comfy checkpoint (optional)">
          <Input
            value={settings.comfyCheckpoint}
            onChange={(e) =>
              setSettings({ ...settings, comfyCheckpoint: e.target.value })
            }
            placeholder="flux1-dev.safetensors"
            className="border-white/10 bg-black/40"
          />
        </Field>
        <Field label="Ollama URL">
          <Input
            value={settings.ollamaUrl}
            onChange={(e) =>
              setSettings({ ...settings, ollamaUrl: e.target.value })
            }
            className="border-white/10 bg-black/40"
          />
        </Field>
        <Field label="Ollama model">
          <Input
            value={settings.ollamaModel}
            onChange={(e) =>
              setSettings({ ...settings, ollamaModel: e.target.value })
            }
            className="border-white/10 bg-black/40"
          />
        </Field>
        <Field label="TTS URL" hint="Piper HTTP or OpenAI-compatible speech">
          <Input
            value={settings.ttsUrl}
            onChange={(e) =>
              setSettings({ ...settings, ttsUrl: e.target.value })
            }
            className="border-white/10 bg-black/40"
          />
        </Field>
        <Field label="TTS voice">
          <Input
            value={settings.ttsVoice}
            onChange={(e) =>
              setSettings({ ...settings, ttsVoice: e.target.value })
            }
            className="border-white/10 bg-black/40"
          />
        </Field>
        <label className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-3 text-sm">
          <span>
            FFmpeg assemble
            <span className="mt-1 block text-xs text-zinc-500">
              Stitch explainer beats + VO when ffmpeg is on PATH
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.ffmpegEnabled}
            onChange={(e) =>
              setSettings({ ...settings, ffmpegEnabled: e.target.checked })
            }
            className="size-4 accent-[#e77ae6]"
          />
        </label>
        <Button
          onClick={save}
          disabled={saving}
          className="bg-[#e77ae6] font-semibold text-black hover:bg-[#f2a1ed]"
        >
          {saving ? "Saving…" : "Save adapters"}
        </Button>
        {message ? <p className="text-sm text-zinc-400">{message}</p> : null}
      </div>

      <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div>
          <h2 className="text-white">Prompt improvement</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Powers the <strong>Improve prompt</strong> button on the Create
            workbench. Pick Local to use the Ollama server above — or API key
            to use any OpenAI-compatible chat endpoint.
          </p>
        </div>
        <Field label="Improvement provider">
          <select
            className="flex h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm"
            value={settings.improveProvider}
            onChange={(e) =>
              setSettings({
                ...settings,
                improveProvider: e.target.value as "local" | "api",
              })
            }
          >
            <option value="local">Local (Ollama on this mesh)</option>
            <option value="api">API key (OpenAI-compatible)</option>
          </select>
        </Field>
        <Field
          label="API base URL"
          hint="OpenAI-compatible, e.g. https://api.openai.com/v1"
        >
          <Input
            value={settings.improveApiBase}
            onChange={(e) =>
              setSettings({ ...settings, improveApiBase: e.target.value })
            }
            className="border-white/10 bg-black/40"
          />
        </Field>
        <Field label="API key" hint="Only used when provider is API key">
          <Input
            type="password"
            value={settings.improveApiKey}
            onChange={(e) =>
              setSettings({ ...settings, improveApiKey: e.target.value })
            }
            className="border-white/10 bg-black/40"
            autoComplete="off"
          />
        </Field>
        <Field label="API model">
          <Input
            value={settings.improveApiModel}
            onChange={(e) =>
              setSettings({ ...settings, improveApiModel: e.target.value })
            }
            className="border-white/10 bg-black/40"
          />
        </Field>
      </div>

      <div className="rounded-2xl border border-white/10 p-5 text-sm text-zinc-400">
        <h2 className="mb-2 text-white">Recommended self-host stack</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-zinc-200">Local Studio controller</strong>{" "}
            — Image generations via{" "}
            <code className="text-[#e77ae6]">/v1/images/generations</code>{" "}
            (same contract as Local Dream Studio)
          </li>
          <li>
            <strong className="text-zinc-200">ComfyUI</strong> — fallback
            subjects when Local Studio is down
          </li>
          <li>
            <strong className="text-zinc-200">Ollama</strong> — wrapper copy +
            explainer scripts
          </li>
          <li>
            <strong className="text-zinc-200">Piper TTS</strong> (or
            OpenAI-compatible speech) — explainer VO
          </li>
          <li>
            <strong className="text-zinc-200">FFmpeg</strong> — slideshow / VO
            mux
          </li>
        </ul>
        <p className="mt-3">
          Mesh: use <strong className="text-zinc-200">Netbird</strong> peer DNS
          or current peer IP. Dream Studio&apos;s old Tailscale{" "}
          <code className="text-[#e77ae6]">100.x</code> defaults are not assumed.
        </p>
        <p className="mt-3">
          See <code className="text-[#e77ae6]">docker-compose.yml</code>. Mock
          mode always works without a GPU.
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
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function HealthCard({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white">{label}</span>
        <span className={ok ? "text-emerald-400" : "text-zinc-500"}>
          {ok ? "up" : "down"}
        </span>
      </div>
      <p className="mt-2 truncate text-xs text-zinc-500">{detail}</p>
    </div>
  );
}
