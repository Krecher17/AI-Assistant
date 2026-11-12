# Grim desktop companion

The dashboard opens from Start Grim.cmd or the tray Open dashboard command. Closing it keeps the app at your cursor. Windows sign-in launch, when enabled, starts in background mode.

A transparent, non-focusable, click-through native window follows the cursor while idle. “Hey Grim” expands it onto the desktop. Its sprite poses cover sleeping, idle/peek, waking/wave, listening, seated thinking, clipboard work, speaking/presentation and success/jump. It shrinks and returns toward the current cursor after completion. Pending reviewed actions keep it visible. The tray can hide the companion independently of listening.

The supplied reaper-butler character was adapted with the built-in ImageGen tool into **public/assets/grim-atlas.png** (transparent PNG, 1774×887, 8 columns × 4 rows). Canvas animates four-frame cycles and respects reduced-motion settings. These are 2D character animations, not a rigged 3D model. No ChatGPT Pet installation is involved.

Asset prompt specification: Use the supplied chibi grim-reaper butler as the character reference: black hood and cape, sunglasses, white shirt, black bow tie, gold trim and scythe. Create a transparent animation sprite atlas with exactly eight columns and four rows, consistent character size and placement, no labels or text. Four adjacent frames per action: row one sleeping then idle/peek; row two greeting wave then attentive listening/handshake; row three seated thinking then clipboard analysis/work; row four speaking/presentation then happy success jump. Keep each character fully inside its cell with padding, no background, preserve the recognizable costume and proportions, make small readable motion changes between frames. Mode: built-in ImageGen, transparent background, supplied image reference.

Verification: npm test, npm run check, npm run test:desktop, npm run test:voice and npm run test:companion. Generate synthetic fixture WAV files first with npm run test:fixtures. Desktop tests use isolated profiles. Native companion verification checks transparency, no keyboard focus, emergence, work pose and return to cursor. No live Gemini or ElevenLabs access is implied.

Data migration copies the old local profile into the new Grim profile on first start, preserving chats, memories, images and encrypted credentials. The old profile remains as a backup; its historical name is retained only in migration code. The project directory path stays unchanged.

## Voice and performance update

Standby uses only the constrained local Hey Grim recognizer when Gemini is configured. Awakened commands use Gemini 3.5 Flash-Lite transcription; raw command clips remain in memory and are not saved. Wake-only and combined wake-plus-command paths are tested, with ordinary speech rejected. Transcription model can be overridden with GEMINI_TRANSCRIBE_MODEL. Routine chat now defaults to gemini-3.5-flash-lite; select a larger model in Settings for more demanding work. Flash-Lite supports low-latency tasks: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite .

Rendering is capped at 448 pixels, uses timers rather than a continuous animation-frame loop, and stops for a hidden dashboard through native visibility events. Audio stays active independently. Idle cursor-window bounds are updated only when the cursor moves. Unchanged dashboard state is not rendered again. Tests check hidden drawing pauses/resumes and both command audio paths. Live synthetic Gemini transcription measured 2,268 ms in one run; network/provider latency varies.
