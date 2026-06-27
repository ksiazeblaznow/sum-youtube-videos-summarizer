# Privacy Policy — Sum. (YouTube AI Summarizer)

_Last updated: 2026-06-27_

This extension ("the Extension") summarizes YouTube videos using an AI backend
that **you** choose and configure with **your own** API key. It is a personal,
bring-your-own-key tool. This policy explains exactly what it does with data.

## The short version

- The Extension has **no servers** of its own. The developer does not receive,
  store, or see any of your data.
- There is **no analytics, no telemetry, and no tracking** of any kind.
- The only data that ever leaves your browser is the video transcript (and the
  question you type), sent **directly** to the AI provider **you** selected,
  using **your** API key.

## What data is processed

When you click **Summarize** (or ask a follow-up question), the Extension reads:

- the **transcript** of the current YouTube video (from YouTube's own transcript
  panel / caption data),
- the **video title**, and
- any **follow-up question** you type into the panel.

This content is sent to the AI backend you configured in Settings so it can
generate a summary or answer. The generated summary is shown to you in the panel.

## Where the data goes

Data is sent **only** to the single backend you select, and **directly** from
your browser to that provider — it never passes through any server controlled by
the developer:

| Backend you select | Where the transcript is sent |
|---|---|
| **Local (LM Studio)** | A server running on **your own computer** (`localhost`). Data does not leave your machine. |
| **Google Gemini** | `https://generativelanguage.googleapis.com` |
| **Anthropic (Claude)** | `https://api.anthropic.com` |
| **OpenAI (ChatGPT)** | `https://api.openai.com` |
| **OpenRouter** | `https://openrouter.ai` |

Each provider processes the data under **its own** privacy policy and terms:

- Google Gemini: https://ai.google.dev/gemini-api/terms
- Anthropic: https://www.anthropic.com/legal/privacy
- OpenAI: https://openai.com/policies/privacy-policy
- OpenRouter: https://openrouter.ai/privacy

If you use the **Local (LM Studio)** backend, no third party is involved at all.

## API keys

- Your API key is stored **locally** on your device using `chrome.storage.local`.
- It is **not** synced to your Google account or any other device.
- It is sent **only** to the matching provider in the request header, exactly as
  that provider's API requires. It is never sent anywhere else and is never
  logged to the page or visible to YouTube.

## What is stored, and for how long

- **Settings** (chosen backend, language, word limit, custom prompt) and your
  **API key** are kept in `chrome.storage.local` until you change or remove them,
  or uninstall the Extension.
- The **last generated summary** for a video is cached in memory only, and is
  discarded when you navigate away or close the tab.
- Nothing else is retained.

## Data the developer collects

**None.** The Extension contains no analytics, error reporting, advertising, or
remote code. The developer cannot see your transcripts, questions, API keys, or
usage.

## Children's privacy

The Extension is a general-purpose utility and is not directed at children.

## Changes to this policy

Material changes will be reflected in the "Last updated" date above and in the
extension's store listing.

## Contact

Questions about this policy: **<your-contact-email>**
