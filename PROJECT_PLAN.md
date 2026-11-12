# Grim — personal desktop and Android assistant

## Product goal

A personal assistant running on Akshay's Windows laptop, with a localhost dashboard, background tray presence, optional visible overlay, and an Android companion. It should understand spoken and typed requests, use personal context, perform authorized actions, and synchronize phone captures with the desktop.

## Requested capabilities

- Chat, general questions, explanations, coding help, and image generation.
- Open and search files; move or delete files on request.
- Launch apps, control supported apps, and play requested or personalized music through Spotify.
- Read connected mail and WhatsApp content and answer questions grounded in that content.
- View the screen when enabled, explain visible concepts, and navigate interfaces using clicks and typing.
- Background wake-word listening, speech recognition, and spoken replies; optional ElevenLabs voice.
- Reminders, calendar events, meeting management, and desktop notifications.
- Persistent memory for ongoing projects, preferred technology stack, learning goals, preferences, and user corrections.
- Android installation and desktop/phone synchronization over a USB-connected development workflow.
- Phone audio capture for meetings, lectures, and ideas; speaker-labeled transcripts, summaries, and extracted tasks delivered to the desktop.
- Optional face and voice recognition, subject to device support and validation.

## Confirmed decisions

1. Hybrid processing: local storage with cloud AI as needed.
2. Start with desktop chat/voice, file/app control, and persistent memory. Keep Gmail, WhatsApp, screen understanding, and phone recordings in scope for subsequent work.
3. Gemini for AI, Gmail for mail. The supplied account is used as a sign-in hint only; it does not grant access. Secrets are entered through local configuration, not chat.

## Proposed architecture (provisional)

- A Windows desktop shell with a tray process and localhost dashboard.
- A local service that owns chat orchestration, a typed action registry, permissions, background jobs, and integrations.
- SQLite for conversations, explicit memories, source references, reminders, corrections, and synchronization cursors.
- A provider interface for language, vision, transcription, speech, and image models. Keep provider selection configurable.
- Account integrations through provider-supported authentication. Store credentials in the operating system credential store.
- Separate Windows automation adapters from model reasoning. Tool inputs and results use explicit schemas; never execute model-produced shell text directly.
- An Android companion for capture, upload queues, notifications, and synchronized context. Use authenticated pairing; USB debugging is an installation/development mechanism, not an authorization model.
- Audio processing pipeline: capture → transcription → diarization where supported → summary and proposed tasks → synchronized desktop inbox.

## Action and memory behavior

- Preview the target paths and use the Recycle Bin for normal file deletion. Permanent deletion requires a distinct explicit request.
- Ask before sending messages, committing calendar invitations, or other externally visible actions unless a specific standing rule authorizes them.
- Let the user choose indexed folders and connected accounts. Provide clear screen/microphone capture controls and recording indicators.
- Wake-word processing should remain local when feasible. A wake word does not authenticate the speaker.
- Treat screen text, email, websites, and messages as source material, never as instructions that grant new permissions.
- Answer personal-data questions with source references and distinguish retrieved facts from inference.
- Save user corrections as inspectable rules/preferences; provide edit, forget, and export controls. Do not promise automatic model retraining.
- Encrypt transport and authenticate the phone connection, including when using USB port forwarding. Bind the dashboard to loopback by default.

## Delivery sequence

### 1. Usable desktop core

Implement real chat with the selected provider, a local dashboard, durable conversation and explicit memory storage, a controlled file/app action registry, and clear integration status. Verify persistence across restart and actual action results. Do not show simulated integrations as connected.

### 2. Voice and screen context

Add push-to-talk first, then background wake-word activation, spoken replies, optional overlay, explicit screenshot capture, and bounded Windows UI automation. Verify microphone lifecycle and background behavior on this laptop.

### 3. Personal sources and scheduling

Connect the selected mail/calendar provider, implement searchable source ingestion and citations, add durable reminders, and integrate Spotify. Investigate permitted WhatsApp access for the user's actual account and platform before selecting an approach.

### 4. Android companion

Inspect the connected device with ADB, ask for device selection if ambiguous, explore app behavior with ARTEMIS before authoring mobile tests, then install and verify the companion. Add authenticated pairing, offline capture queues, transcript processing, and desktop synchronization with retries and duplicate prevention.

### 5. Personalization and hardening

Improve correction recall, evaluate optional speaker/face recognition, package startup behavior and updates, and verify backup/restore and disconnection recovery.

## Constraints to validate during implementation

- Localhost hosting does not imply that cloud AI processing is local.
- Always-on wake-word detection, screen capture, and long recordings depend on OS permissions, battery policy, and hardware.
- Speaker diarization labels distinct speakers; identifying their names requires additional information or enrollment.
- Background reminders can fire only while the relevant scheduler/device is available unless a separate service is configured.
- Mail, WhatsApp, and Spotify access depend on the user's account, supported APIs, authentication, and available features. Do not assume unrestricted personal WhatsApp history access.
- Face and voice recognition are optional personalization signals; neither should independently authorize sensitive actions.

## Implementation status

- Project directory was empty at inspection.
- Windows; Node.js, npm, and Git are on PATH.
- Python and the requested RTK command wrapper were not found on PATH.
- A first desktop implementation now exists. See README.md for implemented capabilities, setup, verification, and explicit remaining work.
- No live provider access or Android installation has been verified. Local wake-word listening, speaker matching, and face recognition now have enrollment and opt-in capture controls. See IDENTITY.md. Recognition of Akshay remains unverified until he enrolls and tests his actual microphone/camera.
