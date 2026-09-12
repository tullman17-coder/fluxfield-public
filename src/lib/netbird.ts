/**
 * Netbird / mesh networking helpers.
 * local-dream-studio previously hard-locked Tailscale CGNAT 100.x hosts.
 * Fluxfield prefers Netbird DNS / peer names (or LAN IPs), and only warns on 100.x leftovers.
 */

const TAILSCALE_CGNAT =
  /^(100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3})$/;

export function isLegacyTailscaleHost(hostname: string): boolean {
  return TAILSCALE_CGNAT.test(hostname.trim());
}

export function urlUsesLegacyTailscale(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return isLegacyTailscaleHost(host);
  } catch {
    return false;
  }
}

/** Suggest a Netbird-style default when env is unset. */
export function defaultStudioUrlFromEnv(): string {
  return (
    process.env.FLUXFIELD_STUDIO_URL ||
    process.env.LOCAL_STUDIO_URL ||
    "http://127.0.0.1:18088"
  );
}

export function netbirdHint(url: string): string | null {
  if (!urlUsesLegacyTailscale(url)) return null;
  return "This looks like a Tailscale 100.x address. If your mesh is Netbird now, switch to the peer DNS name (e.g. http://studio.netbird.selfhosted:18088) or the current Netbird IP.";
}
