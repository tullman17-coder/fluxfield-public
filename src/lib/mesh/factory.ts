/**
 * Image and video generate on one factory box (DGX Spark).
 * Other mesh peers are visible; personal machines (boop) are never a target.
 */

import type { MeshPeer, MeshSnapshot } from "@/lib/mesh/peers";

export type HostRole = "factory" | "personal" | "other" | "self" | "loopback";

const DEFAULT_FACTORY = ["dgx-spark", "dgx"];
const DEFAULT_PERSONAL = ["boop"];

type Remembered = {
  personal: Set<string>;
  factory: Set<string>;
  selfFactory: boolean;
};

const remembered: Remembered = {
  personal: new Set(),
  factory: new Set(),
  selfFactory: false,
};

function csvNames(value: string | undefined, fallback: string[]): string[] {
  const raw = (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return raw.length ? raw : fallback;
}

export function factoryNames(): string[] {
  return csvNames(process.env.FLUXFIELD_FACTORY_HOSTS, DEFAULT_FACTORY);
}

export function personalNames(): string[] {
  return csvNames(process.env.FLUXFIELD_PERSONAL_HOSTS, DEFAULT_PERSONAL);
}

export function hostnameOf(urlOrHost: string): string {
  const raw = (urlOrHost || "").trim();
  if (!raw) return "";
  try {
    if (raw.includes("://")) return new URL(raw).hostname.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
  return raw.replace(/\/.*$/, "").split(":")[0]?.toLowerCase() || "";
}

export function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function shortName(host: string): string {
  return host.split(".")[0] || host;
}

function nameMatches(host: string, names: string[]): boolean {
  const full = host.toLowerCase();
  const short = shortName(full);
  return names.some((name) => {
    const needle = name.toLowerCase().trim();
    if (!needle) return false;
    return (
      full === needle ||
      short === needle ||
      full.startsWith(`${needle}.`) ||
      short.startsWith(`${needle}-`)
    );
  });
}

function rememberHost(set: Set<string>, value: string) {
  const host = value.trim().toLowerCase();
  if (host) set.add(host);
}

export function rememberMeshRoles(mesh: MeshSnapshot) {
  remembered.personal.clear();
  remembered.factory.clear();
  remembered.selfFactory = nameMatches(mesh.selfName, factoryNames());

  for (const peer of mesh.peers) {
    const personal = nameMatches(peer.name, personalNames()) ||
      nameMatches(peer.fqdn, personalNames());
    const factory =
      !personal &&
      (nameMatches(peer.name, factoryNames()) ||
        nameMatches(peer.fqdn, factoryNames()));
    if (personal) {
      rememberHost(remembered.personal, peer.name);
      rememberHost(remembered.personal, peer.fqdn);
      rememberHost(remembered.personal, peer.ip);
    }
    if (factory) {
      rememberHost(remembered.factory, peer.name);
      rememberHost(remembered.factory, peer.fqdn);
      rememberHost(remembered.factory, peer.ip);
    }
  }
}

export function isPersonalHost(urlOrHost: string): boolean {
  const host = hostnameOf(urlOrHost);
  if (!host) return false;
  if (nameMatches(host, personalNames())) return true;
  return (
    remembered.personal.has(host) ||
    remembered.personal.has(shortName(host))
  );
}

export function isFactoryHost(urlOrHost: string): boolean {
  const host = hostnameOf(urlOrHost);
  if (!host || isPersonalHost(host)) return false;
  if (nameMatches(host, factoryNames())) return true;
  return (
    remembered.factory.has(host) || remembered.factory.has(shortName(host))
  );
}

export function peerRole(peer: MeshPeer): HostRole {
  if (peer.self) return "self";
  if (nameMatches(peer.name, personalNames()) || nameMatches(peer.fqdn, personalNames())) {
    return "personal";
  }
  if (nameMatches(peer.name, factoryNames()) || nameMatches(peer.fqdn, factoryNames())) {
    return "factory";
  }
  return "other";
}

export function urlRole(url: string): HostRole {
  const host = hostnameOf(url);
  if (!host) return "other";
  if (isLoopbackHost(host)) return "loopback";
  if (isPersonalHost(host)) return "personal";
  if (isFactoryHost(host)) return "factory";
  return "other";
}

/** Image and video generate only on the factory box. */
export function allowsImageVideo(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  if (isPersonalHost(host)) return false;
  if (isFactoryHost(host)) return true;
  return isLoopbackHost(host) && remembered.selfFactory;
}

export function refuseImageVideo(url: string, label: string): void {
  if (allowsImageVideo(url)) return;
  if (isPersonalHost(url)) {
    throw new Error(
      `${label} is on a personal machine. Fluxfield only generates on the factory box (DGX).`,
    );
  }
  const host = hostnameOf(url) || "this address";
  throw new Error(
    `${label} must be the factory machine (DGX Spark), not ${host}.`,
  );
}

export function factoryMeshHosts(mesh: MeshSnapshot): string[] {
  return mesh.peers
    .filter((peer) => peerRole(peer) === "factory")
    .flatMap((peer) => [peer.fqdn, peer.ip].filter(Boolean));
}

export function defaultFactoryStudioUrl(): string {
  return (
    process.env.FLUXFIELD_STUDIO_URL ||
    process.env.LOCAL_STUDIO_URL ||
    "http://dgx-spark.netbird.selfhosted:18088"
  );
}

export function defaultFactoryOllamaUrl(): string {
  return (
    process.env.FLUXFIELD_OLLAMA_URL ||
    "http://dgx-spark.netbird.selfhosted:11434"
  );
}

export function sanitizeGenerationUrl(url: string): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (isPersonalHost(trimmed)) return "";
  return trimmed;
}
