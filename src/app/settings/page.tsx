"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GenerationMode, StudioSettings } from "@/lib/adapters/types";

function load() {
  return Promise.all([
    fetch("/api/settings").then((r) => r.json()),
    fetch("/api/health").then((r) => r.json()),
    fetch("/api/ollama-models")
      .then((r) => r.json())
      .catch(() => null),
  ]);
}

const ENGINE_LABEL: Record<string, string> = {
  "local-studio": "Studio",
  comfyui: "Comfy",
  mock: "Preview art",
};

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
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const [s, h, m] = await load();
    setSettings(s.settings);
    setHealth(h.health);
    setOllamaModels(m?.models || []);
  }

  useEffect(() => {
    let alive = true;
    load().then(([s, h, m]) => {
      if (!alive) return;
      setSettings(s.settings);
      setHealth(h.health);
      setOllamaModels(m?.models || []);
    });
    return () => {
      alive = false;
    };
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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-[#e77ae6]">
          Connections
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white md:text-4xl">
          Where your work gets made
        </h1>
        <p className="mt-2 text-[#b8aebb]">
          Fieldbench hands image, writing, and voice work to the machines you
          point it at here. Fill in what you have running and leave the rest
          blank.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <HealthCard
          label="Studio"
          ok={!!health?.studio}
          detail={settings.studioUrl}
        />
        <HealthCard label="Comfy" ok={!!health?.comfy} detail={settings.comfyUrl} />
        <HealthCard label="Ollama" ok={!!health?.ollama} detail={settings.ollamaUrl} />
        <HealthCard label="Voice" ok={!!health?.tts} detail={settings.ttsUrl} />
        <HealthCard
          label="FFmpeg"
          ok={!!health?.ffmpeg}
          detail={settings.ffmpegEnabled ? "On" : "Off"}
        />
      </div>
      <p className="text-sm text-[#8d838f]">
        Making images with{" "}
        <span className="text-[#e77ae6]">
          {health ? (ENGINE_LABEL[health.effectiveMode] ?? health.effectiveMode) : "…"}
        </span>
      </p>
      {health?.netbirdHint ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {health.netbirdHint}
        </p>
      ) : null}

      <div className="space-y-5 rounded-2xl border border-white/10 glass p-5">
        <Field label="Image source">
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
            <option value="auto">Automatic — use whatever is reachable</option>
            <option value="local-studio">Studio only</option>
            <option value="comfyui">Comfy only</option>
            <option value="mock">Preview art — no graphics card needed</option>
          </select>
        </Field>
        <Field
          label="Studio address"
          hint="Use the Netbird name for that machine, like http://studio.netbird.selfhosted:18088. Old 100.x addresses will not reach it."
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
            value={settings.studioApiKey}
            onChange={(e) =>
              setSettings({ ...settings, studioApiKey: e.target.value })
            }
            className="border-white/10 bg-white/10"
            autoComplete="off"
          />
        </Field>
        <Field label="Comfy address" hint="For example http://gpu-box:8188">
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
        <Field label="Ollama address">
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
              For openweight models. Stops Fieldbench adding blocks of its own,
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
        <Button
          onClick={save}
          disabled={saving}
          className="bg-[#d565d6] font-semibold text-black hover:bg-[#e77ae6]"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
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
            value={settings.improveApiKey}
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
            <strong className="text-zinc-200">Studio</strong> — makes your
            images. This is the one worth setting up first.
          </li>
          <li>
            <strong className="text-zinc-200">Comfy</strong> — picks up image
            work when Studio is offline.
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
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 glass p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#f5eff6]">{label}</span>
        <span className={ok ? "text-emerald-400" : "text-[#8d838f]"}>
          {ok ? "Connected" : "Not found"}
        </span>
      </div>
      <p className="mt-2 truncate text-xs text-[#8d838f]">{detail}</p>
    </div>
  );
}
