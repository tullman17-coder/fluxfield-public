import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type MeshPeer = {
  name: string;
  fqdn: string;
  ip: string;
  connected: boolean;
  self: boolean;
};

export type MeshSnapshot = {
  provider: "netbird" | "tailscale" | "none";
  selfName: string;
  selfIp: string;
  peers: MeshPeer[];
};

const EMPTY: MeshSnapshot = {
  provider: "none",
  selfName: "",
  selfIp: "",
  peers: [],
};

let cache: { at: number; value: MeshSnapshot } | null = null;
const CACHE_MS = 45_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function shortName(fqdn: string): string {
  return fqdn.split(".")[0] || fqdn;
}

function stripCidr(ip: string): string {
  return (ip || "").split("/")[0];
}

async function runJson(bin: string, args: string[]): Promise<unknown | null> {
  try {
    const { stdout } = await execFileAsync(bin, args, {
      timeout: 4000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function fromNetbird(raw: unknown): MeshSnapshot | null {
  const root = asRecord(raw);
  if (!root) return null;
  const details = asRecord(root.peers)?.details;
  if (!Array.isArray(details) && !root.fqdn) return null;

  const selfFqdn = String(root.fqdn || "");
  const selfIp = stripCidr(String(root.netbirdIp || ""));
  const peers: MeshPeer[] = [];

  if (selfFqdn || selfIp) {
    peers.push({
      name: shortName(selfFqdn) || "this-machine",
      fqdn: selfFqdn,
      ip: selfIp,
      connected: true,
      self: true,
    });
  }

  if (Array.isArray(details)) {
    for (const item of details) {
      const rec = asRecord(item);
      if (!rec) continue;
      const fqdn = String(rec.fqdn || "");
      const ip = stripCidr(String(rec.netbirdIp || ""));
      if (!fqdn && !ip) continue;
      peers.push({
        name: shortName(fqdn) || ip,
        fqdn,
        ip,
        connected: String(rec.status || "").toLowerCase() === "connected",
        self: false,
      });
    }
  }

  return {
    provider: "netbird",
    selfName: shortName(selfFqdn) || "this-machine",
    selfIp,
    peers,
  };
}

function fromTailscale(raw: unknown): MeshSnapshot | null {
  const root = asRecord(raw);
  if (!root || !asRecord(root.Self)) return null;
  const self = asRecord(root.Self)!;
  const selfFqdn = String(self.DNSName || "").replace(/\.$/, "");
  const selfIps = Array.isArray(self.TailscaleIPs)
    ? self.TailscaleIPs.map(String)
    : [];
  const selfIp = selfIps.find((ip) => ip.includes(".")) || selfIps[0] || "";
  const peers: MeshPeer[] = [
    {
      name: shortName(selfFqdn) || "this-machine",
      fqdn: selfFqdn,
      ip: selfIp,
      connected: true,
      self: true,
    },
  ];

  const peerMap = asRecord(root.Peer) || {};
  for (const item of Object.values(peerMap)) {
    const rec = asRecord(item);
    if (!rec) continue;
    const fqdn = String(rec.DNSName || "").replace(/\.$/, "");
    const ips = Array.isArray(rec.TailscaleIPs)
      ? rec.TailscaleIPs.map(String)
      : [];
    const ip = ips.find((value) => value.includes(".")) || ips[0] || "";
    if (!fqdn && !ip) continue;
    peers.push({
      name: shortName(fqdn) || ip,
      fqdn,
      ip,
      connected: Boolean(rec.Online),
      self: false,
    });
  }

  return {
    provider: "tailscale",
    selfName: shortName(selfFqdn) || "this-machine",
    selfIp,
    peers,
  };
}

async function readLiveSnapshot(): Promise<MeshSnapshot> {
  const netbird =
    fromNetbird(await runJson("netbird", ["status", "--json"])) ||
    fromNetbird(await runJson("/usr/local/bin/netbird", ["status", "--json"]));
  if (netbird) return netbird;

  const tailscale =
    fromTailscale(await runJson("tailscale", ["status", "--json"])) ||
    fromTailscale(
      await runJson("/opt/homebrew/bin/tailscale", ["status", "--json"]),
    );
  if (tailscale) return tailscale;

  return EMPTY;
}

/** Connected Netbird / Tailscale peers. Cached so a health poll is not a CLI storm. */
export async function listMeshPeers(force = false): Promise<MeshSnapshot> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = await readLiveSnapshot();
  cache = { at: Date.now(), value };
  return value;
}

/** One hostname per peer — FQDN preferred. Loopback always first. */
export function meshHosts(
  snapshot: MeshSnapshot,
  opts: { connectedOnly?: boolean } = {},
): string[] {
  const hosts: string[] = ["127.0.0.1"];
  const peers = snapshot.peers.filter((peer) =>
    opts.connectedOnly ? peer.connected || peer.self : true,
  );
  const ordered = [...peers].sort((a, b) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    if (a.self !== b.self) return a.self ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  for (const peer of ordered) {
    if (peer.fqdn) hosts.push(peer.fqdn);
    else if (peer.ip) hosts.push(peer.ip);
  }
  return [...new Set(hosts)];
}
