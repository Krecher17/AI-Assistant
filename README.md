# Grim

A working first version of Akshay's Windows personal assistant, with a localhost dashboard and local SQLite memory. Chat now defaults to free local Ollama (Qwen3 1.7B), and command transcription uses offline Whisper. Gemini remains an explicitly selectable cloud option. No keys are included.

Grim is a black, gold, and white desktop companion. A tiny animated reaper rests beside your cursor, emerges when you say **Hey Grim**, shows task animations, and returns after the task. Closing the dashboard leaves the companion and local wake listener running in the tray. Open the dashboard explicitly through the launcher or tray.

**Change its voice:** open **Grim Systems → Voice & speech**. Select Windows, browser, or ElevenLabs, choose a voice, set speed/volume, then Save and preview. No speaker enrollment or voice matching is required. Optional laptop face recognition personalizes the greeting with “Yes, Akshay”; it never blocks commands. See [IDENTITY.md](IDENTITY.md) and [GRIM_COMPANION.md](GRIM_COMPANION.md).

## Start on this laptop

Double-click **Start Grim.cmd**, or run:

```powershell
npm install
npm run desktop
```

Node.js 24+ is required. The desktop startup script installs the Electron runtime if it is absent. The app opens its authenticated localhost dashboard automatically. Close the window to keep the assistant in the system tray; use **Quit Grim** from its tray menu to stop it. The tray menu also offers **Keep window on top** and an opt-in Windows sign-in setting. `Ctrl+Shift+Space` brings it forward and toggles voice-command recording. Keep the project folder in place while using this development build.

For a browser-only session:

```powershell
npm start
```

Open the private pairing link printed in the terminal. Keep that terminal running. The normal address without its pairing fragment does not unlock a fresh browser session. Do not publish or share the pairing link.

## Local model update

The local runtime and models are installed on this laptop. No AI API key is needed for local chat or voice commands. Start Grim normally: its backend starts the loopback Ollama server and warms local speech. See [LOCAL_AI.md](LOCAL_AI.md) for locations, versions, limitations and checks.

Commands such as **open Brave and search for YouTube**, **search for GitHub in Brave**, **open github**, and **search YouTube for JavaScript tutorials** execute through the local browser router without asking a language model. Regular installed apps still use Windows discovery. Model-generated file changes still need approval.

In Settings, choose **Local Ollama** and model **qwen3:1.7b**. Use Test connection to check it. The Gemini settings below apply only if you explicitly select Gemini.

## First setup

1. Open **Settings & connections** and enter your own Gemini API key. It is sent only to the local backend. With **Remember** enabled, Windows DPAPI protects it for your current Windows account. Otherwise it stays in backend memory until exit.
2. Choose a model available to your API project; the default is `gemini-3.5-flash-lite`. Saving a key does not validate billing or model access; the first request reports provider errors.
3. Add specific folders in **Files you choose**, one absolute path per line. No file folders are enabled by default.
4. Add projects, preferences, learning goals, or corrections in **Memory**. These persist across restarts and are included with AI chat requests. You can edit or forget them.

Alternatively copy `.env.example` to `.env` and fill in provider configuration locally. A running process must restart after `.env` changes. Never put a real key in source control or paste one into chat.

## Implemented

| Capability | Current behavior |
| --- | --- |
| Chat and coding help | Gemini Generate Content API, recent chat, explicit memory, bounded function calls, optional web search and citations |
| Voice | Record a command, transcribe with Gemini, review, then send; spoken replies through browser/Windows speech, or optional ElevenLabs |
| Personal wake word | Local Vosk recognition with no speaker gate; wake commands can be sent hands-free |
| Face recognition | Local camera descriptors, encrypted enrollment, on-demand continuous matching, visible camera control |
| Files | Bounded filename search and small text/code-file reading in enabled folders; approved opening, single-file moving, and Recycle Bin deletion |
| Apps | Dynamic Windows app discovery; explicit app commands launch locally, while model-generated proposals remain reviewed |
| Screen understanding | Explicit one-time screen/window snapshot, visible preview, sent with next chat request; screenshot bytes are not persisted |
| Memory | SQLite CRUD for projects, preferences, goals, and corrections; no model retraining |
| Reminders | Durable local reminders; tray notifications in desktop mode, optional browser notifications in browser mode; overdue items surface on restart |
| Images | Gemini image generation, local image library, image downloads |
| Gmail | Read-only OAuth connection and on-demand message search after Google setup |
| WhatsApp knowledge | Import an exported text chat, search source excerpts, and open original local source by ID |
| Recordings | Microphone recording or audio upload, transcription, schema-validated meeting summary, decisions, suggested tasks, and open questions |
| Phone preview | Same responsive dashboard over an authenticated USB-forwarded localhost connection; shared desktop data, not an installed native app |
| Review/history | One-shot action approvals, result receipts, local activity log, and text-data export |

Example requests:

- “Search my enabled folders for invoice.”
- “Read C:\\Users\\Akshay\\Documents\\Projects\\app\\server.ts and explain likely bugs.”
- “Open Calculator.”
- “Remember that I prefer TypeScript for this project.”
- “What did the imported WhatsApp project chat say about the deadline?”
- “Search Gmail for newer_than:7d subject:meeting and summarize the results.”
- “Remind me to revise networking tomorrow at 7 PM India time.”
- “Create an image of a calm futuristic study room.”

File/app changes proposed by the model require clicking **Approve**. Direct user app-launch commands execute immediately against the Windows catalog. Proposals expire after ten minutes and do not survive restart. The app rechecks paths, permissions, file identity, and destination existence at approval. It cannot permanently delete files or recursively delete folders. Executable/script file opening is blocked to avoid executing source files through Windows associations. Use your editor to open those files directly.

Filename search is bounded to seven levels, 12,000 inspected entries, and sixty results; it is not a full filesystem index. Text reads are capped at 256 KB. Credential folders and common private configuration files are excluded. Source retrieval is lexical excerpt search, not a semantic index; returned excerpts may omit relevant material in a large export.

## Gmail setup

The supplied email address is a sign-in hint, not permission to read that account. Grim never asks for your Gmail password.

1. In Google Cloud, enable **Gmail API** for your project.
2. Configure the OAuth consent screen. For a personal app in testing, add your own Gmail address as a test user.
3. Create an OAuth client of type **Desktop app**.
4. Put its client ID and client secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Restart Grim, then choose **Connect Gmail** in Settings. Finish Google's authorization in your browser yourself.

The redirect address is `http://127.0.0.1:4317/oauth/google/callback` at the default port, using the installed-app loopback flow with PKCE and a short-lived random state. Only `gmail.readonly` is requested. Tokens are DPAPI protected in the local database. Search retrieves up to eight emails per request, excludes attachments, and prefers plain-text bodies (HTML-only messages fall back to Gmail snippets). Requested excerpts are sent to Gemini to answer your question. Search results may remain in your local chat history. Disconnecting removes local token access and attempts to revoke Google access; it does not delete old chat history.

Google consent, testing-token expiry, restricted-scope requirements, API quotas, and account policy can affect access. Errors appear in the UI. Do not treat the connection as verified until a real sign-in and query succeed.

## WhatsApp and phone recordings

For this version, export an individual WhatsApp chat **without media**, then import its `.txt` file under **Knowledge → WhatsApp export**. An imported copy is searchable local context. Live WhatsApp sync, sending messages, and automatic history scraping are not implemented.

For recordings, use **Knowledge → Start recording** or **Upload audio**. Maximum payload is 12 MB. Audio goes to Gemini on stop/upload; raw audio is not stored by the backend. The transcript is saved before summarization, so it remains available if summarization fails. Tasks are suggestions, not scheduled actions; choose a task's reminder button and supply a time to create a reminder. Failed microphone uploads are offered as a local download while the page remains open. This is not crash-safe audio capture.

Current transcripts do not identify speakers. Speaker diarization, robust long-session chunking, offline phone queues, and native Android capture are future work.

## USB phone browser preview

This does not install an Android APK. Once an authorized Android device is connected, select its serial and run:

```powershell
adb devices -l
adb -s YOUR_DEVICE_SERIAL reverse tcp:4317 tcp:4317
```

On the phone, open `http://127.0.0.1:4317/` with the **same private `#pair=...` fragment** from the running desktop server. In desktop mode the pairing URL is intentionally not logged; use browser-only `npm start` to obtain a pairing link for this preview. Stop the desktop instance first to free the port. The server remains loopback-only. Both clients use the same database, with periodic refresh. USB disconnection interrupts access; this version has no offline queue or internet relay. Browser microphone behavior depends on the phone/browser and must be verified on the actual device. No phone was explored, tested, or installed as part of the desktop build.

Before authoring Android tests, explore the target application and verify device interactions with ARTEMIS as required by this project's mobile rules.

## ElevenLabs

Set `ELEVENLABS_API_KEY` in `.env` and restart. In **Voice & speech**, select ElevenLabs and enter its voice ID, then Save and preview. Windows speech is the default. Playback is limited to the first 1,000 characters of a reply.

## Storage and boundaries

Default data location: `%LOCALAPPDATA%\\Grim` on Windows. Override with `GRIM_DATA_DIR` if needed. The code lives in the current OneDrive project folder, but the default database does not.

- `grim.sqlite` plus SQLite WAL/SHM files: chat, memory, reminders, source text, settings, and activity.
- `images/`: generated images.
- API keys and Gmail tokens: encrypted for the current Windows account with DPAPI. Other database content and images are **not encrypted at rest**.
- `.env`, if used: plaintext local configuration excluded from source control. Protect it through your OS account controls.

The HTTP service binds to `127.0.0.1`, validates Host/Origin, uses random pairing and HttpOnly SameSite cookies, has no permissive CORS, enforces request-size limits, and requires a same-origin custom header for writes. This is intended for a trusted single-user laptop, not a multi-user or internet-hosted deployment. The pairing token is a bearer credential. Local processes running as your Windows account remain within the trust boundary.

AI receives the question, recent chat, saved memory, and any requested tool results. Screen captures are sent only with the next message. Imported messages and files are treated as untrusted source data, not new permissions. The model does not receive a raw shell execution tool. Requests use Google’s Gemini API; this is not a claim of zero provider retention. Review your provider's data settings and your account's usage charges.

Forgetting a memory/source removes that item from the active app store; it does not redact earlier chat messages or guarantee forensic erasure of SQLite pages/backups. Clear chat separately to remove saved conversation records. Text-data export excludes secrets and image binaries. Keep the server running and laptop awake for reminders. Missed reminders are marked due on the next running session; this version does not schedule Windows wake timers.

## Still planned

- Low-latency conversational streaming voice and robust interruption handling.
- Full Windows UI navigation/clicking/typing and robust interruption handling.
- Native Android installation, offline audio capture, speaker-segmented transcripts, authenticated offline synchronization, and background queues.
- Calendar synchronization, meeting invitations, Spotify account playback and taste, live WhatsApp access where supported.
- Stronger liveness checks, calibrated recognition, and a richer project/semantic memory model.
- Signed installer, packaged updates, migration/backup tooling, and production hardening.

## Verification

```powershell
npm run check
npm test
```

Automated tests cover persistent memory, scope-limited deletion, path traversal and junction escapes, credential-file exclusion, approval replay and stale-file prevention, tool-result round trips, authentication/CSRF/Host boundaries, secret redaction, source CRUD/search, and transcript preservation after summary failure. Provider responses are mocked in tests; no live Gemini, Gmail, ElevenLabs, Spotify playback, or Android result is implied.

Official implementation references: [Gemini API](https://ai.google.dev/api/generate-content), [function calling](https://ai.google.dev/gemini-api/docs/function-calling), [image generation](https://ai.google.dev/gemini-api/docs/image-generation), [audio understanding](https://ai.google.dev/gemini-api/docs/audio), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), and [Google installed-app OAuth](https://developers.google.com/identity/protocols/oauth2/native-app).

Migrating from the initial OpenAI build: restart Grim and enter a Gemini key in Settings. Old OpenAI keys and chat-model settings are never reused for Gemini. Chats, memories, sources, reminders, Gmail access, and existing images are preserved. Gemini model access, billing, and limits depend on your Google project. Get a key from [Google AI Studio](https://aistudio.google.com/apikey). The inline audio limit is now 12 MB to stay within Gemini request-size limits after base64 encoding.
