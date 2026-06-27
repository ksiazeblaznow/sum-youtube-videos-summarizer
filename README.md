# Sum. — Summarize AI videos on YouTube

A lightweight Chromium / Opera GX (Manifest V3) extension that adds a native-looking
**Summarize** button to the YouTube action bar and renders a structured, AI-generated
summary of the video's transcript in an injected side panel. You can also ask
follow-up questions grounded in the transcript.

Bring your own API key — the extension talks **directly** to the AI provider you
choose. There is no middle-man server, no account, and no telemetry.

## Features

- One-click **Summarize** button next to Share / Download / Clip.
- Structured Markdown summary in a collapsible side panel.
- **Ask follow-up questions** about the video, answered from the transcript.
- Five interchangeable backends — pick one in Settings:
  - **Local (LM Studio)** — runs entirely on your machine, no key, no data leaves the device.
  - **Google Gemini**
  - **Anthropic (Claude)**
  - **OpenAI (ChatGPT)**
  - **OpenRouter** (one key, many models)
- Configurable language (default Polski), soft word limit, and editable system prompt.
- Summaries cached in memory per video; **Regenerate** to refresh.

## Getting an API key

You only need a key for the **cloud** backend you pick (the Local backend needs none):

- Google Gemini — https://aistudio.google.com/apikey
- Anthropic — https://console.anthropic.com/settings/keys
- OpenAI — https://platform.openai.com/api-keys
- OpenRouter — https://openrouter.ai/keys

Paste it into the extension's **Settings** (toolbar icon). Keys are stored locally
(`chrome.storage.local`) and sent only to the matching provider. We recommend
restricting your cloud key (referrer / app limits) in the provider's console.

## Install (unpacked, for development)

1. Clone or download this folder.
2. Open `chrome://extensions` (or `opera://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this folder.
5. Open any YouTube watch page and click **Summarize**.

## How it works

Standard MV3 split. The **service worker is the only component that touches API
keys or makes AI calls** — keys never enter the page or content-script context.

- `content/inject-button.js` — injects the button, orchestrates transcript fetch, mounts the panel.
- `content/transcript-bridge.js` — MAIN-world reader for caption tracks.
- `content/panel.js` + `panel.css` — the result panel.
- `background.js` — settings, prompt building, backend dispatch.
- `backends/*` — one module per provider behind a common `generate()` interface.

YouTube no longer serves caption text to extension fetches, so the reliable path
is scraping YouTube's own transcript panel. See `CLAUDE.md` for the gory details.

## Privacy

No servers, no analytics, no tracking. The only data leaving your browser is the
transcript (and your questions), sent directly to the provider you selected with
your own key. See [PRIVACY.md](./PRIVACY.md).

## Known limitations

- Depends on YouTube's DOM; layout changes can break transcript scraping until updated.
- Videos with no transcript/captions cannot be summarized.
- Local-model quality varies; the prompt is written to be robust to weaker models.

## License

[PolyForm Noncommercial License 1.0.0](./LICENSE).

Free to use, modify, and share for **noncommercial** purposes — personal use,
hobby projects, education, research, nonprofits, and government are all permitted.
**Commercial use is not granted** (you may not sell it, or use it for commercial
advantage, without separate permission). The extension itself is free to install
on the Chrome Web Store; this license governs the source code.
