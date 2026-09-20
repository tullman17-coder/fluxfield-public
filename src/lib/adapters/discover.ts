import { writeSettings } from "@/lib/settings";
import type { StudioSettings } from "@/lib/adapters/types";
import {
  type ProbeResult,
  type ServiceKind,
  normalizeBase,
  pickPreferredModel,
  probeComfy,
  probeOllama,
  probeStudio,
  probeTts,
} from "@/lib/adapters/probe";
import {
  allowsImageVideo,
  defaultFactoryStudioUrl,
  factoryMeshHosts,
  hostnameOf,
  isFactoryHost,
  isPersonalHost,
  rememberMeshRoles,
} from "@/lib/mesh/factory";
import {
  listMeshPeers,
  meshHosts,
  type MeshSnapshot,
} from "@/lib/mesh/peers";

const CANDIDATE_PORTS: Record<Exclude<ServiceKind, "music">, number[]> = {
  studio: [18088, 8088, 8888],
  comfy: [8188, 8000],
  ollama: [11434, 11435, 1234],
  tts: [5500, 10200],
};

function endpointKey(url: string): string {
  try {
    const parsed = new URL(normalizeBase(url));
    const host =
      parsed.hostname === "localhost" ? "127.0.0.1" : parsed.hostname;
    const port =
      parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    return `${host}:${port}`;
  } catch {
    return normalizeBase(url);
  }
}

function isLoopback(url: string): boolean {
  try {
    const host = new URL(normalizeBase(url)).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

function isIpHost(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function prefersFqdn(url: string): boolean {
  try {
    const host = new URL(normalizeBase(url)).hostname;
    return !isIpHost(host) && host !== "localhost" && host !== "127.0.0.1";
  } catch {
    return false;
  }
}

function candidateUrls(
  kind: Exclude<ServiceKind, "music">,
  hosts: string[],
): string[] {
  const urls: string[] = [];
  for (const host of hosts) {
    for (const port of CANDIDATE_PORTS[kind]) {
      urls.push(`http://${host}:${port}`);
    }
  }
  return urls;
}

function rankHits(hits: ProbeResult[]): ProbeResult[] {
  return [...hits].sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    if (prefersFqdn(a.url) !== prefersFqdn(b.url)) {
      return prefersFqdn(a.url) ? -1 : 1;
    }
    return a.url.localeCompare(b.url);
  });
}

async function probeAll(
  kind: Exclude<ServiceKind, "music">,
  urls: string[],
  apiKey?: string,
): Promise<ProbeResult[]> {
  const unique = [...new Set(urls.map(normalizeBase).filter(Boolean))];
  const results = await Promise.all(
    unique.map((url) => {
      if (kind === "studio") return probeStudio(url, apiKey);
      if (kind === "comfy") return probeComfy(url);
      if (kind === "tts") return probeTts(url);
      return probeOllama(url);
    }),
  );
  return rankHits(results.filter((r) => r.ok || r.reachable));
}

function portOf(url: string): string {
  try {
    return new URL(normalizeBase(url)).port;
  } catch {
    return "";
  }
}

function shouldAdopt(
  current: ProbeResult,
  extra: ProbeResult | undefined,
  currentUrl: string,
  opts: { generation?: boolean } = {},
) {
  if (!extra?.ok) return false;
  if (opts.generation && !allowsImageVideo(extra.url)) return false;
  if (!current.ok) return true;
  return (
    prefersFqdn(extra.url) &&
    !prefersFqdn(currentUrl) &&
    portOf(extra.url) === portOf(currentUrl)
  );
}

function emptyComfy(detail: string): ProbeResult {
  return {
    kind: "comfy",
    url: "",
    reachable: false,
    ok: false,
    detail,
  };
}

export type Discovery = {
  settings: StudioSettings;
  studio: ProbeResult;
  comfy: ProbeResult;
  ollama: ProbeResult;
  tts: ProbeResult;
  applied: string[];
  found: ProbeResult[];
  mesh: MeshSnapshot;
};

let cache: { at: number; key: string; value: Discovery } | null = null;
const CACHE_MS = 20_000;

function cacheKey(settings: StudioSettings): string {
  return [
    settings.studioUrl,
    settings.comfyUrl,
    settings.ollamaUrl,
    settings.ollamaModel,
    settings.ttsUrl,
    settings.studioApiKey ? "k" : "",
  ].join("|");
}

/**
 * Probe the saved addresses, then the factory box (DGX) on the usual
 * Studio / Comfy / Ollama ports. Personal peers are never adopted.
 */
export async function discoverAndHeal(
  settings: StudioSettings,
  opts: { force?: boolean } = {},
): Promise<Discovery> {
  const key = cacheKey(settings);
  if (
    !opts.force &&
    cache &&
    cache.key === key &&
    Date.now() - cache.at < CACHE_MS
  ) {
    return cache.value;
  }

  const mesh = await listMeshPeers(opts.force);
  rememberMeshRoles(mesh);
  const factoryHosts = factoryMeshHosts(mesh);
  const applied: string[] = [];
  let next = { ...settings };

  if (next.comfyUrl && !allowsImageVideo(next.comfyUrl)) {
    const left = hostnameOf(next.comfyUrl);
    next.comfyUrl = "";
    applied.push(
      `Comfy left ${left} — that machine is not the factory`,
    );
  }
  if (next.studioUrl && !allowsImageVideo(next.studioUrl)) {
    next.studioUrl = defaultFactoryStudioUrl();
    applied.push(`Studio → ${next.studioUrl}`);
  }

  const [studioNow, comfyNow, ollamaNow, ttsNow] = await Promise.all([
    probeStudio(next.studioUrl, next.studioApiKey),
    next.comfyUrl
      ? probeComfy(next.comfyUrl)
      : Promise.resolve(emptyComfy("No Comfy on the factory box yet")),
    probeOllama(next.ollamaUrl),
    probeTts(next.ttsUrl),
  ]);

  let studio = studioNow;
  let comfy =
    next.comfyUrl && !allowsImageVideo(next.comfyUrl)
      ? emptyComfy("Personal Comfy is not used")
      : comfyNow;
  let ollama = ollamaNow;
  let tts = ttsNow;

  const skip = (url: string) => (u: string) => endpointKey(u) !== endpointKey(url);

  const scanKind = (ok: boolean, url: string) =>
    !ok || !prefersFqdn(url);

  const ttsHosts = meshHosts(mesh, { connectedOnly: true }).filter(
    (host) => !isPersonalHost(host),
  );

  const [studioHits, comfyHits, ollamaHits, ttsHits] = await Promise.all([
    factoryHosts.length && scanKind(studio.ok, next.studioUrl)
      ? probeAll(
          "studio",
          candidateUrls("studio", factoryHosts).filter(skip(next.studioUrl)),
          next.studioApiKey,
        )
      : Promise.resolve([] as ProbeResult[]),
    factoryHosts.length && scanKind(comfy.ok, next.comfyUrl)
      ? probeAll(
          "comfy",
          candidateUrls("comfy", factoryHosts).filter(skip(next.comfyUrl)),
        )
      : Promise.resolve([] as ProbeResult[]),
    factoryHosts.length && scanKind(ollama.ok, next.ollamaUrl)
      ? probeAll(
          "ollama",
          candidateUrls("ollama", factoryHosts).filter(skip(next.ollamaUrl)),
        )
      : Promise.resolve([] as ProbeResult[]),
    scanKind(tts.ok, next.ttsUrl)
      ? probeAll("tts", candidateUrls("tts", ttsHosts).filter(skip(next.ttsUrl)))
      : Promise.resolve([] as ProbeResult[]),
  ]);

  const found = rankHits(
    [...studioHits, ...comfyHits, ...ollamaHits, ...ttsHits].filter((hit) => {
      if (hit.kind === "tts") return true;
      return isFactoryHost(hit.url);
    }),
  );

  const adoptStudio = studioHits.find((h) => h.ok && allowsImageVideo(h.url));
  if (shouldAdopt(studio, adoptStudio, next.studioUrl, { generation: true }) && adoptStudio) {
    next.studioUrl = adoptStudio.url;
    studio = adoptStudio;
    applied.push(`Studio → ${adoptStudio.url}`);
  }

  const adoptComfy = comfyHits.find((h) => h.ok && allowsImageVideo(h.url));
  if (shouldAdopt(comfy, adoptComfy, next.comfyUrl, { generation: true }) && adoptComfy) {
    next.comfyUrl = adoptComfy.url;
    comfy = adoptComfy;
    applied.push(`Comfy → ${adoptComfy.url}`);
  }

  const adoptOllama = ollamaHits.find((h) => h.ok && isFactoryHost(h.url));
  if (shouldAdopt(ollama, adoptOllama, next.ollamaUrl) && adoptOllama) {
    next.ollamaUrl = adoptOllama.url;
    ollama = adoptOllama;
    applied.push(`Ollama → ${adoptOllama.url}`);
  } else if (adoptOllama?.ok && adoptOllama.models?.length && !ollama.ok) {
    ollama = adoptOllama;
  }

  const adoptTts = ttsHits.find((h) => h.ok && !isPersonalHost(h.url));
  if (shouldAdopt(tts, adoptTts, next.ttsUrl) && adoptTts) {
    next.ttsUrl = adoptTts.url;
    tts = adoptTts;
    applied.push(`Voice → ${adoptTts.url}`);
  }

  const model = pickPreferredModel(ollama.models || [], next.ollamaModel);
  if (model && model !== next.ollamaModel) {
    next.ollamaModel = model;
    applied.push(`Writing model → ${model}`);
  }

  if (applied.length) {
    next = await writeSettings({
      studioUrl: next.studioUrl,
      comfyUrl: next.comfyUrl,
      ollamaUrl: next.ollamaUrl,
      ollamaModel: next.ollamaModel,
      ttsUrl: next.ttsUrl,
    });
  }

  const value: Discovery = {
    settings: next,
    studio,
    comfy,
    ollama,
    tts,
    applied,
    found,
    mesh,
  };
  cache = { at: Date.now(), key: cacheKey(next), value };
  return value;
}

export function isLoopbackUrl(url: string): boolean {
  return isLoopback(url);
}
