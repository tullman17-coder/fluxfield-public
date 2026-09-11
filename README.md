# Fieldbench

Local Higgsfield-style **marketing wrappers** (GPT Image-2 style) and **Explainer** studio that talk to offline models on another machine.

## What you get

1. **Image-2 wrapper gallery** — masonry of mini-app containers (streetwear drop, editorial catalog, event poster, ecommerce banner, virtual try-on, sports lockup). Each wrapper is a customized dashboard: fixed inputs, presets, compose → outputs.
2. **Explainer** — left-rail topic + aspect/duration/voice/subtitles, preset grid (editorial motion, stickman, watercolor, fairy tale, paper diorama, pastel flat), then script → beats → VO → optional MP4.
3. **Marketing desk** — classic product / ads / UGC / motion / marketplace / poster workflows.
4. **Adapters** — ComfyUI (images), Ollama (copy/scripts), Piper/OpenAI-TTS (voice), FFmpeg (assemble). **Mock mode** always works with no GPU.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

Go to **Adapters** and set:

| Setting | Typical value on your model box |
|---|---|
| ComfyUI URL | `http://192.168.x.x:8188` |
| Ollama URL | `http://192.168.x.x:11434` |
| TTS URL | `http://192.168.x.x:5500` |
| Mode | `auto` (Comfy when up, else mock) |

## Self-host helper stack

```bash
docker compose up -d
ollama pull llama3.2   # on the ollama host
```

Run **ComfyUI** on the GPU machine separately (official install). Fieldbench does not vendor Comfy weights.

### Adapter map

| Higgsfield-ish surface | Local path |
|---|---|
| Image-2 composed ads | Comfy txt2img/img2img + SVG wrapper compositor |
| Explainer script | Ollama |
| Explainer frames | Comfy or mock beats |
| Explainer voice | Piper / OpenAI-compatible `/v1/audio/speech` |
| Explainer cut | FFmpeg slideshow mux |

## Optimizations baked in

- **Mock compositor** so UI/workflows are usable before GPUs are online
- **Auto mode** health-probes Comfy and falls back
- Soft-fail TTS/FFmpeg (still returns storyboard + frames)
- Job store on disk under `.data/`
- Wrapper chrome is local SVG compose (typography/CTA/layout) — not baked into the diffusion prompt

## Notes

This is a steal-the-UX local studio, not a pixel-perfect Higgsfield clone and not affiliated with Higgsfield. Connect your own models; no cloud API keys required.
