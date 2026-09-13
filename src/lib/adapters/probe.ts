/**
 * Honest probes for local adapters.
 * A process answering on the port is not enough — the generate path must exist
 * and (for Ollama) at least one model has to be pulled. A 404 is a miss.
 */

export type ServiceKind = "studio" | "comfy" | "ollama" | "tts" | "music";

export type ProbeResult = {
  kind: ServiceKind;
  url: string;
  reachable: boolean;
  ok: boolean;
  status?: number;
  detail: string;
  models?: string[];
  dialect?: "ollama" | "openai";
};

export function normalizeBase(url: string): string {
  return (url || "").trim().replace(/\/$/, "");
}

type FetchOutcome =
  | { status: number; text: string; json?: unknown }
  | { error: string };

export async function fetchStatus(
  url: string,
  timeoutMs = 900,
  init?: RequestInit,
): Promise<FetchOutcome> {
  try {
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text().catch(() => "");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, text, json };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "offline" };
  }
}

/** HTTP answered, and the route is actually mounted (404 = wrong app). */
export function routeExists(status: number): boolean {
  return status > 0 && status !== 404;
}

function asRecord(json: unknown): Record<string, unknown> | null {
  return json && typeof json === "object" && !Array.isArray(json)
    ? (json as Record<string, unknown>)
    : null;
}

function ollamaTagNames(json: unknown): string[] {
  const rec = asRecord(json);
  const models = rec?.models;
  if (!Array.isArray(models)) return [];
  return models
    .map((m) =>
      typeof m === "string"
        ? m
        : typeof (m as { name?: string })?.name === "string"
          ? (m as { name: string }).name
          : "",
    )
    .filter(Boolean);
}

function openaiModelNames(json: unknown): string[] {
  const rec = asRecord(json);
  const data = rec?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((m) => (typeof (m as { id?: string })?.id === "string" ? (m as { id: string }).id : ""))
    .filter(Boolean);
}

export async function probeStudio(
  url: string,
  apiKey?: string,
): Promise<ProbeResult> {
  const base = normalizeBase(url);
  if (!base) {
    return {
      kind: "studio",
      url: "",
      reachable: false,
      ok: false,
      detail: "No address set",
    };
  }
  const headers: HeadersInit = {};
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const health = await fetchStatus(`${base}/health`, 1800, { headers });
  if ("error" in health) {
    return {
      kind: "studio",
      url: base,
      reachable: false,
      ok: false,
      detail: "Not listening",
    };
  }

  const healthRec = asRecord(health.json);
  const looksHealth =
    health.status >= 200 &&
    health.status < 300 &&
    !!(healthRec && (healthRec.status === "ok" || healthRec.running === true));

  if (!looksHealth) {
    return {
      kind: "studio",
      url: base,
      reachable: true,
      ok: false,
      status: health.status,
      detail:
        health.status === 401 || health.status === 403
          ? "Something answered, but /health is locked — not the Studio controller"
          : `HTTP ${health.status} on /health — not a Studio controller`,
    };
  }

  let generate = await fetchStatus(`${base}/v1/images/generations`, 1800, {
    headers,
  });
  let generateStatus = "status" in generate ? generate.status : 0;

  // Official / house controllers mount POST only. GET is often 404.
  if (generateStatus === 404 || generateStatus === 405) {
    const posted = await fetchStatus(`${base}/v1/images/generations`, 2500, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: "{}",
    });
    if ("status" in posted && posted.status !== 404) {
      generate = posted;
      generateStatus = posted.status;
    }
  }

  if (!routeExists(generateStatus)) {
    return {
      kind: "studio",
      url: base,
      reachable: true,
      ok: false,
      status: generateStatus || health.status,
      detail: `Reached /health (${health.status}) but /v1/images/generations returned ${generateStatus || "nothing"} — not a Studio controller`,
    };
  }

  const ready = health.status < 500 && routeExists(health.status);
  const generateDetail =
    generateStatus >= 500
      ? `Studio is up; image POST answered ${generateStatus}`
      : apiKey
        ? "Studio generate path is live"
        : "Found — add the Studio key to use it";

  return {
    kind: "studio",
    url: base,
    reachable: true,
    ok: ready,
    status: health.status,
    detail: generateDetail,
  };
}

export async function probeComfy(url: string): Promise<ProbeResult> {
  const base = normalizeBase(url);
  if (!base) {
    return {
      kind: "comfy",
      url: "",
      reachable: false,
      ok: false,
      detail: "No address set",
    };
  }
  const stats = await fetchStatus(`${base}/system_stats`);
  if ("error" in stats) {
    return {
      kind: "comfy",
      url: base,
      reachable: false,
      ok: false,
      detail: "Not listening",
    };
  }
  const statsRec = asRecord(stats.json);
  const looksStats = !!(statsRec && (statsRec.system || statsRec.devices));
  if (stats.status >= 200 && stats.status < 300 && looksStats) {
    return {
      kind: "comfy",
      url: base,
      reachable: true,
      ok: true,
      status: stats.status,
      detail: "ComfyUI system stats ok",
    };
  }

  const queue = await fetchStatus(`${base}/queue`);
  if (!("error" in queue)) {
    const q = asRecord(queue.json);
    const looksQueue = !!(q && ("queue_running" in q || "queue_pending" in q));
    if (queue.status >= 200 && queue.status < 300 && looksQueue) {
      return {
        kind: "comfy",
        url: base,
        reachable: true,
        ok: true,
        status: queue.status,
        detail: "ComfyUI queue ok",
      };
    }
  }

  if (stats.status === 404) {
    return {
      kind: "comfy",
      url: base,
      reachable: true,
      ok: false,
      status: 404,
      detail: "Something answered, but /system_stats is 404 — not ComfyUI",
    };
  }
  return {
    kind: "comfy",
    url: base,
    reachable: true,
    ok: false,
    status: stats.status,
    detail: `HTTP ${stats.status} on /system_stats, but the body is not ComfyUI`,
  };
}

export async function probeOllama(url: string): Promise<ProbeResult> {
  const base = normalizeBase(url);
  if (!base) {
    return {
      kind: "ollama",
      url: "",
      reachable: false,
      ok: false,
      detail: "No address set",
    };
  }

  const tags = await fetchStatus(`${base}/api/tags`);
  if (!("error" in tags) && tags.status !== 404) {
    const models = ollamaTagNames(tags.json);
    if (tags.status >= 200 && tags.status < 300) {
      return {
        kind: "ollama",
        url: base,
        reachable: true,
        ok: models.length > 0,
        status: tags.status,
        models,
        dialect: "ollama",
        detail: models.length
          ? `${models.length} model${models.length === 1 ? "" : "s"} ready`
          : "Ollama is running, but no models are pulled — generate returns 404",
      };
    }
  }

  const openai = await fetchStatus(`${base}/v1/models`);
  if ("error" in openai && "error" in tags) {
    return {
      kind: "ollama",
      url: base,
      reachable: false,
      ok: false,
      detail: "Not listening",
    };
  }
  if (!("error" in openai) && openai.status !== 404) {
    const models = openaiModelNames(openai.json);
    return {
      kind: "ollama",
      url: base,
      reachable: true,
      ok: models.length > 0,
      status: openai.status,
      models,
      dialect: "openai",
      detail: models.length
        ? `${models.length} OpenAI-style model${models.length === 1 ? "" : "s"} ready`
        : "OpenAI-style /v1/models answered with an empty list",
    };
  }

  const status = "status" in tags ? tags.status : "status" in openai ? openai.status : 0;
  return {
    kind: "ollama",
    url: base,
    reachable: true,
    ok: false,
    status,
    detail: `Reached the host, but /api/tags and /v1/models are not usable (${status})`,
  };
}

export async function probeTts(url: string): Promise<ProbeResult> {
  const base = normalizeBase(url);
  if (!base) {
    return {
      kind: "tts",
      url: "",
      reachable: false,
      ok: false,
      detail: "No address set",
    };
  }

  for (const path of ["/v1/models", "/health"]) {
    const hit = await fetchStatus(`${base}${path}`);
    if ("error" in hit) continue;
    if (hit.status === 404) continue;
    const ok = hit.status >= 200 && hit.status < 300;
    return {
      kind: "tts",
      url: base,
      reachable: true,
      ok,
      status: hit.status,
      detail: ok
        ? `Voice API ready (${path})`
        : `Voice host answered ${hit.status} on ${path}`,
    };
  }

  const root = await fetchStatus(`${base}/`);
  if ("error" in root) {
    return {
      kind: "tts",
      url: base,
      reachable: false,
      ok: false,
      detail: "Not listening",
    };
  }
  return {
    kind: "tts",
    url: base,
    reachable: true,
    ok: false,
    status: root.status,
    detail:
      root.status === 404
        ? "Host is up, but /v1/models and /health are 404 — not a speech server"
        : `Host answered ${root.status} without a speech API`,
  };
}

export async function probeMusic(url: string): Promise<ProbeResult> {
  const base = normalizeBase(url);
  if (!base) {
    return {
      kind: "music",
      url: "",
      reachable: false,
      ok: false,
      detail: "No address set",
    };
  }
  const health = await fetchStatus(`${base}/health`);
  if ("error" in health) {
    return {
      kind: "music",
      url: base,
      reachable: false,
      ok: false,
      detail: "Not listening",
    };
  }
  return {
    kind: "music",
    url: base,
    reachable: true,
    ok: health.status >= 200 && health.status < 300,
    status: health.status,
    detail:
      health.status === 404
        ? "Host is up, but /health is 404"
        : health.status >= 200 && health.status < 300
          ? "Music server ready"
          : `Music host answered ${health.status}`,
  };
}

export function pickPreferredModel(
  models: string[],
  wanted?: string,
): string | undefined {
  if (!models.length) return undefined;
  const vision = /vision|llava|moondream|bakllava/i;
  if (wanted && models.includes(wanted) && !vision.test(wanted)) {
    return wanted;
  }
  const ranked = [...models].sort((a, b) => {
    const score = (name: string) => {
      const n = name.toLowerCase();
      if (
        n.includes("vision") ||
        n.includes("llava") ||
        n.includes("moondream") ||
        n.includes("bakllava")
      )
        return 5;
      if (n.includes("qwen3.5") || n.includes("qwen3:")) return 0;
      if (n.includes("llama3.2") || n.includes("llama3.1")) return 1;
      if (n.includes("llama") || n.includes("qwen") || n.includes("mistral"))
        return 2;
      return 3;
    };
    return score(a) - score(b) || a.localeCompare(b);
  });
  return ranked[0];
}

const VISION_NAME =
  /vision|llava|moondream|bakllava|minicpm-v|qwen2\.5vl|qwen.*vl/i;

export function isVisionModel(name: string): boolean {
  return VISION_NAME.test(name);
}

/** Prefer a VL model already pulled on the factory box. */
export function pickPreferredVisionModel(
  models: string[],
): string | undefined {
  const vision = models.filter(isVisionModel);
  if (!vision.length) return undefined;
  const ranked = [...vision].sort((a, b) => {
    const score = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes("qwen2.5vl") || n.includes("qwen2.5-vl")) return 0;
      if (n.includes("qwen") && n.includes("vl")) return 1;
      if (n.includes("minicpm")) return 2;
      if (n.includes("llava:13b") || n.includes("llava:7b")) return 3;
      if (n.includes("llava") || n.includes("bakllava")) return 4;
      if (n.includes("granite") && n.includes("vision")) return 5;
      return 6;
    };
    return score(a) - score(b) || a.localeCompare(b);
  });
  return ranked[0];
}
