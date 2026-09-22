/** Old Super links remain usable; Create owns the only durable Dream job. */
export function campaignCreateUrl(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams({ mode: "campaign" });
  for (const [key, value] of Object.entries(params)) {
    if (key === "mode" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  for (const [oldKey, key] of [["brief", "prompt"], ["brand", "brandName"], ["style", "preset"]]) {
    if (!query.has(key) && query.has(oldKey)) query.set(key, query.get(oldKey)!);
  }
  return `/create?${query}`;
}
