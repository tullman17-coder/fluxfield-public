# Fieldbench

Local Higgsfield-style **marketing wrappers** (GPT Image-2 style) and **Explainer** studio that talk to offline models on another machine — including a **Local Studio / Local Dream Studio** controller over **Netbird**.

## What you get

1. **superComputer** (`/supercomputer`) — Zermobrands × Dream Studio variant tool. One brief in → improved prompt (Local Ollama or your API key) → generated key art → campaign copy out, with a live pipeline panel.
2. **Create workbench** (`/create`) — the Local Dream Studio surface, merged in: prompt-first editor, **AI prompt improvement** (Local Ollama or your own API key), deterministic prompt assist with live preview, preset ribbon, framing, ratios, batch count, seed/steps/CFG, live job strip, and results with Reuse / Vary.
3. **Image-2 wrapper gallery** — masonry of mini-app containers (streetwear drop, editorial catalog, event poster, ecommerce banner, virtual try-on, sports lockup). Cards render **generated key art** (cached per wrapper) behind frosted strips.
4. **Explainer** — left-rail topic + aspect/duration/voice/subtitles, preset grid (editorial motion, stickman, watercolor, fairy tale, paper diorama, pastel flat), then script → beats → VO → optional MP4.
5. **Marketing desk** — classic product / ads / UGC / motion / marketplace / poster workflows.
6. **Dream style + framing** — prompt suffixes ported from Local Dream Studio (photo, cinematic, noir, macro, etc.), available on every generate form.
7. **Adapters** — Local Studio controller (`/v1/images/generations`), ComfyUI, Ollama, Piper/OpenAI-TTS, FFmpeg. **Mock mode** always works with no GPU.

The UI is a **milky swirled glass** theme: creamy base, slow iridescent swirl blobs (transform-only, reduced-motion safe), frosted glass rail and panels — and **no horizontal scrollbars** at any width.

## Prompt improvement

The Create workbench **Improve prompt** button rewrites your idea into a full generation prompt:

- **Local** — uses the Ollama server configured in Adapters (any model you pulled, e.g. `llama3.2`). Nothing leaves your mesh.
- **API key** — uses any OpenAI-compatible chat endpoint (`API base URL` + `API key` + `API model` in Adapters → Prompt improvement).

Pick the provider per-click on the workbench, or set the default in Adapters. Env overrides: `IMPROVE_API_BASE`, `IMPROVE_API_KEY`, `IMPROVE_API_MODEL`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

Go to **Adapters** and set:

| Setting | Typical value on your model box |
|---|---|
| Local Studio URL | `http://<netbird-peer>:18088` (peer DNS preferred) |
| Local Studio API key | Bearer key for the controller |
| ComfyUI URL | `http://<netbird-peer>:8188` |
| Ollama URL | `http://<netbird-peer>:11434` |
| TTS URL | `http://<netbird-peer>:5500` |
| Mode | `auto` (Local Studio → Comfy → mock) |

Env overrides (optional):

```bash
export FIELD_BENCH_STUDIO_URL="http://studio.netbird.selfhosted:18088"
export LOCAL_STUDIO_API_KEY="…"
```

## Netbird vs Tailscale 100.x

Local Dream Studio historically hard-coded Tailscale CGNAT hosts (`100.x`). This mesh is **Netbird** now.

- Prefer Netbird **peer DNS** or the **current Netbird IP** for Local Studio / Comfy / Ollama.
- Fieldbench warns in Adapters if a URL still looks like a Tailscale `100.64.0.0/10` address.
- Do not assume `http://100.115.190.105:18088` still reaches your controller.

## Self-host helper stack

```bash
docker compose up -d
ollama pull llama3.2   # on the ollama host
```

Run **Local Studio controller** and/or **ComfyUI** on the GPU machine separately. Fieldbench does not vendor weights.

### Adapter map

| Higgsfield-ish surface | Local path |
|---|---|
| Image-2 composed ads | Local Studio or Comfy + SVG wrapper compositor |
| Explainer script | Ollama |
| Explainer frames | Local Studio, Comfy, or mock beats |
| Explainer voice | Piper / OpenAI-compatible `/v1/audio/speech` |
| Explainer cut | FFmpeg slideshow mux |

### Local Studio contract

Same as Local Dream Studio:

- `POST /v1/images/generations` with bearer auth
- Body: `{ prompt, negative_prompt?, n, size, seed?, steps?, cfg_scale? }`
- Response: `{ created, prompt_id, data: [{ url, revised_prompt }] }`
- Asset URLs stay under `/v1/images/files/` on the same origin

## Optimizations baked in

- **Mock compositor** so UI/workflows are usable before GPUs are online
- **Auto mode** health-probes Local Studio (with key), then Comfy, else mock
- Soft-fail TTS/FFmpeg (still returns storyboard + frames)
- Job store on disk under `.data/`
- Wrapper chrome is local SVG compose (typography/CTA/layout) — not baked into the diffusion prompt

## Notes

This is a steal-the-UX local studio, not a pixel-perfect Higgsfield clone and not affiliated with Higgsfield. Connect your own models; no cloud API keys required.
