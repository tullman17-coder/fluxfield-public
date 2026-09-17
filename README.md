# Fluxfield

Local Higgsfield/Maestro-style studio — **marketing wrappers**, **Explainer**, a **Director** for long-form pieces, and a **Music** desk — talking to offline models on another machine, including a **Local Studio / Local Dream Studio** controller over **Private-LAN**.

## What you get

1. **superComputer** (`/supercomputer`) — Zermobrands × Dream Studio variant tool. One brief in → improved prompt (Local Ollama or your API key) → generated key art → campaign copy out, with a live pipeline panel.
2. **Create workbench** (`/create`) — the Local Dream Studio surface, merged in: prompt-first editor, **AI prompt improvement** (Local Ollama or your own API key), deterministic prompt assist with live preview, preset ribbon, framing, ratios, batch count, seed/steps/CFG, live job strip, and results with Reuse / Vary.
3. **Image-2 wrapper gallery** — masonry of mini-app containers (streetwear drop, editorial catalog, event poster, ecommerce banner, virtual try-on, sports lockup). Each card shows a **real example made by that layout** — the layout is run for real with the example copy from its own form, cached under `.data/card-bg/`.
4. **Explainer** — left-rail topic + aspect/duration/voice/subtitles, preset grid (editorial motion, stickman, watercolor, fairy tale, paper diorama, pastel flat), then script → beats → VO → optional MP4.
5. **Director** (`/director`) — long-form planning instead of single clips. Two modes:
   - **Music video** writes the track first, then cuts every shot to the beat of its section map.
   - **Short film** walks six acts, tightening framing and shortening holds as tension rises.

   Runtimes go from 1 minute to **60 minutes**. Output is a timecoded shot list (size, camera move, action, a direction note per section), a score, key frames for the important moments, and a **window plan** that splits anything over two minutes into 2-minute render windows. Long lists are downloadable as plain text.
6. **Music** (`/music`) — writes a real arrangement (intro, verses, pre, hook, break, outro) in a chosen key and tempo across 8 styles, then renders it to a 16-bit stereo WAV. Uses a local music server when you point at one; otherwise the built-in composer runs with no GPU.

   **Lyrics**: choose no words, have them written, or paste your own. Either way they get timed to the section map — the hook repeats, instrumental parts are marked, and every line carries a timecode. When a music server is connected the words go to it alongside the style prompt (the `lyrics` field ACE-Step and similar servers expect).
7. **Marketing desk** — classic product / ads / UGC / motion / marketplace / poster workflows.
8. **Dream style + framing** — prompt suffixes ported from Local Dream Studio (photo, cinematic, noir, macro, etc.), available on every generate form.
9. **Connections** — Local Studio controller (`/v1/images/generations`), ComfyUI, Ollama, Piper/OpenAI-TTS, a music server, FFmpeg. **Preview mode** always works with no GPU: it paints real raster art (procedural noise fields, composition archetypes, film grain) rather than flat gradients, and synthesizes audio from scratch.

The UI is a **milky swirled glass** theme: creamy base, slow iridescent swirl blobs (transform-only, reduced-motion safe), frosted glass rail and panels — and **no horizontal scrollbars** at any width.

## Openweight models

Settings → Connections has **Take prompts as written**. Turn it on when the
machine you generate on runs uncensored/openweight weights. It:

- stops Fluxfield adding content terms of its own to negative prompts, and
  removes the ones the layout catalog carries
- sends `safety_checker: false` and `allow_nsfw: true` to the Local Studio
  controller (a controller that does not know those fields ignores them)
- tells the prompt rewriter to keep your subject exactly as given instead of
  softening or declining it
- adds a set of adult looks to the style list — Boudoir, Figure study, Pin-up,
  Grindhouse, Body horror

Off by default. `FLUXFIELD_UNRESTRICTED=1` turns it on without the UI.

## Prompt improvement

The Create workbench **Improve prompt** button rewrites your idea into a full generation prompt:

- **Local** — uses the Ollama server set under Connections (any model you pulled, e.g. `llama3.2`). Nothing leaves your mesh.
- **API key** — uses any OpenAI-compatible chat endpoint (`API base URL` + `API key` + `API model` under Connections → Rewrite with).

Pick the provider per-click on the workbench, or set the default under Connections. Env overrides: `IMPROVE_API_BASE`, `IMPROVE_API_KEY`, `IMPROVE_API_MODEL`.

## Zermo owner API connection

Set `ZERMO_API_BASE` (default `https://api.zermo.org`) and either `ZERMO_API_KEY` or `ZERMO_API_KEY_FILE` on the **server**, then select **Zermo** under Settings → Connections. The UI receives only configuration/health status, not this credential. Never use a `NEXT_PUBLIC_` key, commit a real `.env`, or publish a credential file.

This branch connects the existing image flows and Music desk to durable `/v1/media/jobs`. Explicit Zermo mode does **not** fall back to preview art, Comfy, Local Studio or synthesized music when a request fails. The remote job ID, effective settings and idempotent request are saved with the local job. Reconnect/resume keeps that request identity instead of submitting a new creative attempt. The existing local library receives authenticated output downloads; ACE audio remains `.flac` with its correct MIME type.

Current slice: Chroma text-to-image and ACE music (10–90 seconds). Director can use generated keyframes but does not fabricate a soundtrack or claim native long-form video in Zermo mode. References/edit masks, native video integration and full storyboard lifecycle are not yet wired into this provider. The underlying Zermo API supports more operations than this initial app integration. Chroma's workbench displays aspect-fitted dimensions, Detail (8-step default) / Fast (4-step draft) profiles and fixed CFG1. Both profiles retain the selected resolution; fewer steps change the image, not just latency. Explicit unsupported steps/CFG/dimensions are rejected rather than silently changed; valid explicit image sizes are honored. Saved remote effective settings remain attached to the job. Downloads enforce one output and a streaming byte cap; resumed music displays the original saved lyrics. Zermo never calls legacy TTS, and any retained FFmpeg assembly is labeled as a local slideshow.

Run `npm run test:zermo` for the explicit mocked-transport contract tests, and `npm run build` for the production build. Live app acceptance and review are tracked separately; a mocked test is not a generated asset. This remains an owner-only studio integration, not a tenant-isolated paid signup service.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

To try it on your phone while you work, bind the dev server to the network and
open the machine's address instead:

```bash
HOST=0.0.0.0 npm run dev     # then http://<your-laptop-ip>:43127 on the phone
```

Private ranges and Netbird peer names are already accepted. Anything else goes
in `FLUXFIELD_DEV_ORIGINS`, comma separated.

Go to **Settings → Connections** and set:

| Setting | Typical value on your model box |
|---|---|
| Local Studio URL | `http://<netbird-peer>:18088` (peer DNS preferred) |
| Local Studio API key | Bearer key for the controller |
| ComfyUI URL | `http://<netbird-peer>:8188` |
| Ollama URL | `http://<netbird-peer>:11434` |
| TTS URL | `http://<netbird-peer>:5500` |
| Music URL | `http://<netbird-peer>:8020` (optional, blank uses the built-in composer) |
| Mode | `auto` (Local Studio → Comfy → preview) |

Env overrides (optional):

```bash
export FLUXFIELD_STUDIO_URL="http://studio.netbird.selfhosted:18088"
export LOCAL_STUDIO_API_KEY="…"
```

## On your phone

Fluxfield works in mobile Safari and Chrome as a normal site, and installs to
the home screen as a standalone app.

- **iPhone/iPad** — open the site in Safari, tap Share, then **Add to Home
  Screen**. It opens without browser chrome, sized around the notch and the home
  indicator.
- **Android** — Chrome offers **Install app** from the menu.

Install only shows up over HTTPS, so it needs a real domain rather than an IP.

A render keeps going on the machine doing the work even if you lock the phone or
switch apps. Fluxfield stops asking for progress while the screen is off, picks
straight back up when you return, and remembers which piece was in progress so a
tab the phone threw away still comes back to it.

## Host it on a domain

It needs a machine, not a serverless platform: jobs, settings and finished pieces
live on disk under `.data/`, and that directory has to survive a restart. The
same machine has to be able to reach your model boxes, so run it on a peer inside
the Netbird mesh.

```bash
npm ci
npm run build
PORT=43127 npm start
```

`npm start` listens on every interface. Set `HOST` to pin it to one — worth doing
if the box has a public NIC and you only want the proxy talking to it:

```bash
HOST=127.0.0.1 PORT=43127 npm start
```

Keep it up with whatever you already use. A systemd unit is enough:

```ini
[Unit]
Description=Fluxfield
After=network-online.target

[Service]
WorkingDirectory=/srv/fluxfield
Environment=NODE_ENV=production HOST=127.0.0.1 PORT=43127
ExecStart=/usr/bin/npm start
Restart=always
User=fluxfield

[Install]
WantedBy=multi-user.target
```

Then put the domain in front of it. Caddy gets a certificate on its own, which is
what makes the home-screen install offer appear:

```caddyfile
studio.example.com {
	reverse_proxy 127.0.0.1:43127
	request_body {
		max_size 64MB
	}
}
```

The body limit matters — reference images and audio go up through normal form
posts, and a 1MB default will reject them. On nginx that is
`client_max_body_size 64m;` plus a `proxy_read_timeout` long enough for your
slowest render.

Nothing in Fluxfield asks who you are. Put it behind your mesh, a VPN, or your
proxy's own auth before pointing a public domain at it.

## Netbird vs Tailscale 100.x

Local Dream Studio historically hard-coded Tailscale CGNAT hosts (`100.x`). This mesh is **Netbird** now.

- Prefer Netbird **peer DNS** or the **current Netbird IP** for Local Studio / Comfy / Ollama.
- Fluxfield warns under Connections if a URL still looks like a Tailscale `100.64.0.0/10` address.
- Do not assume an old Tailscale `100.x` address still reaches your controller.

## Self-host helper stack

```bash
docker compose up -d
ollama pull llama3.2   # on the ollama host
```

Run **Local Studio controller** and/or **ComfyUI** on the GPU machine separately. Fluxfield does not vendor weights.

### Adapter map

| Higgsfield-ish surface | Local path |
|---|---|
| Image-2 composed ads | Local Studio or Comfy + SVG wrapper compositor |
| Explainer script | Ollama |
| Explainer frames | Local Studio, Comfy, or mock beats |
| Explainer voice | Piper / OpenAI-compatible `/v1/audio/speech` |
| Explainer cut | FFmpeg slideshow mux |
| Music tracks | Local music server `POST /generate`, else the built-in composer |
| Director frames | Local Studio, Comfy, or the built-in painter |

### Music server contract

Optional. Point **Music address** at anything that accepts:

- `POST /generate` with `{ prompt, duration, model, lyrics? }`
- Response: raw audio bytes, `{ audio: "<base64>" }`, or `{ url }`

ACE-Step and MusicGen-style servers both fit. With the field blank, Fluxfield
writes the arrangement and renders the WAV itself — no GPU, no network.

### Local Studio contract

Same as Local Dream Studio:

- `POST /v1/images/generations` with bearer auth
- Body: `{ prompt, negative_prompt?, n, size, seed?, steps?, cfg_scale? }`
- Response: `{ created, prompt_id, data: [{ url, revised_prompt }] }`
- Asset URLs stay under `/v1/images/files/` on the same origin

## Optimizations baked in

- **Preview painter** so every surface is usable before GPUs are online — PNGs encoded from scratch, no image libraries
- **Auto mode** health-probes Local Studio (with key), then Comfy, else preview — and keeps walking the chain when a machine answers a probe but fails the job
- Soft-fail TTS/FFmpeg (still returns storyboard + frames)
- Job store on disk under `.data/jobs/<date>/<id>/`, with a browsable `.data/library/` and rebuildable indexes — not a capped JSON ledger
- Long runtimes are split into 2-minute render windows rather than one enormous job
- Wrapper chrome is local SVG compose (typography/CTA/layout) — not baked into the diffusion prompt

## On-disk layout

```
.data/
  jobs/YYYY-MM-DD/<jobId>/job.json
  jobs/YYYY-MM-DD/<jobId>/outputs/
  library/image|audio|video/YYYY/MM/<file>   # hard links into job outputs
  indexes/jobs.json
  indexes/library.json
  settings.json
  outputs/          # flat compatibility links for /api/outputs/*
```

Migrate an older single-file ledger with:

```bash
npm run data:migrate
```

Gallery sorts through `GET /api/library?sort=createdAt|name|tool|kind|mtime&order=desc&kind=image`.

## Authelia (bring your own)

Fluxfield is an OIDC client. Authelia stays on your box; register a client and point the app at it:

```yaml
# Authelia identity_providers.oidc.clients entry
- client_id: 'fluxfield'
  client_name: 'Fluxfield'
  client_secret: 'your-secret'   # use a hash in Authelia
  public: false
  authorization_policy: 'two_factor'
  redirect_uris:
    - 'https://fluxfield.example.com/api/auth/callback/authelia'
  scopes: ['openid', 'profile', 'email']
  response_types: ['code']
  grant_types: ['authorization_code']
  userinfo_signed_response_alg: 'none'
```

App env (see `.env.example`):

```bash
AUTH_SECRET=...
AUTH_TRUST_HOST=true
AUTHELIA_ISSUER=https://auth.example.com
AUTHELIA_CLIENT_ID=fluxfield
AUTHELIA_CLIENT_SECRET=...
# AUTH_DISABLED=true   # only for local / mesh-only testing
```

Anyone Authelia authenticates for this client may use the studio. `/api/health` stays reachable without a session.

## Notes

This is a steal-the-UX local studio, not a pixel-perfect Higgsfield clone and not affiliated with Higgsfield. Connect your own models; no cloud API keys required.


Managed Zermo mode also routes rewriting, copy, lyrics and scripts through the authenticated `local-auto` writing route; Connections displays the served model identity separately from Chroma and ACE. No text fallback is fabricated on failure. Legacy endpoint setup is under Advanced, and browser settings contain only credential-presence flags.

Explainer cards use six generated WebP still samples in `public/examples/explainer/`, with their prompts, remote job IDs and hashes in `provenance.json`. They are not GIFs or video demos. Adult / NSFW style selection is a separate 18+ opt-in gated by the owner setting, not a claim of universal non-refusal.

Media output and library routes stream private responses and support single byte ranges and HEAD. Exact seeds travel as decimal strings; unsafe numeric seeds are rejected. Run `npx tsx scripts/test-server-release.ts` and `npx tsx scripts/test-studio-ui.ts` alongside the provider/copy checks before release.
