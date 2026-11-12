💀 GRIM — Your Personal AI Assistant

Your AI. Your Desktop. Your Rules.

Grim is a local-first, intelligent personal AI assistant built for Windows. It combines conversational AI, voice recognition, desktop automation, persistent memory, and an animated desktop companion into one application.

Designed to feel like a personal digital companion rather than just another chatbot, Grim can understand commands, launch applications, manage reminders, help with coding, and interact with selected personal information.

With support for Ollama, Google Gemini, offline speech recognition, and optional cloud integrations, Grim gives users control over how their AI assistant operates.

---

✨ Key Features

🧠 Intelligent AI Chat

- Conversational AI for everyday questions and assistance.
- Local AI powered by Ollama and Qwen3.
- Optional Google Gemini integration.
- Coding assistance, explanations, and problem-solving.
- Persistent conversation history and user-defined memory.
- Configurable AI models.

🎙️ Voice Assistant

- Wake-word activation using "Hey Grim".
- Offline wake-word detection with Vosk.
- Offline speech transcription using Whisper.
- Natural voice responses using Windows speech.
- Optional ElevenLabs voice integration.
- Hands-free voice commands.
- Microphone and listening controls.

💀 Animated Desktop Companion

Grim isn't limited to a traditional chat window.

An animated grim-reaper companion can appear near your mouse cursor and respond visually to different activities.

Animations include:

- Sleeping and idle states.
- Greeting and listening.
- Thinking and processing.
- Performing tasks.
- Speaking and celebrating successful actions.

The companion can continue running in the Windows system tray even when the main dashboard is closed.

🖥️ Desktop Integration

- Launch installed Windows applications.
- Open websites and perform browser searches.
- Discover registered Windows applications.
- Search files inside approved directories.
- Read supported text and code files.
- Move files with user approval.
- Send supported files to the Recycle Bin.
- Capture selected screen content for AI analysis.

Sensitive file operations proposed by the AI require explicit user approval.

🧩 Persistent Memory

Grim can remember information explicitly saved by the user, including:

- Personal preferences.
- Ongoing projects.
- Learning goals.
- Important notes.
- User corrections.

Memory is stored locally using SQLite and can be viewed, edited, or deleted.

⏰ Reminders and Productivity

- Create reminders using natural-language commands.
- Receive desktop notifications.
- Store reminders across application restarts.
- Review overdue reminders when Grim starts again.
- Generate meeting summaries and suggested tasks.

Reminders require Grim to be running and do not wake a sleeping computer.

📧 Gmail Integration

Grim supports optional read-only Gmail access through Google OAuth.

Supported functionality includes:

- Connecting a Gmail account securely.
- Searching emails.
- Reading selected message content.
- Answering questions based on retrieved emails.

Grim does not currently send, delete, or modify emails.

💬 WhatsApp Knowledge

- Import exported WhatsApp text conversations.
- Search imported conversation history.
- Retrieve relevant excerpts.
- Ask questions about imported discussions.

Live WhatsApp synchronization and message sending are not currently supported.

🎨 AI Image Generation

With a compatible Gemini configuration, Grim can generate images from text prompts and maintain a local image library.

Image generation is not supported by the default local Qwen text model.

📱 Mobile Browser Preview

Grim provides an experimental mobile-friendly dashboard accessible from an Android device through USB port forwarding.

This is currently a browser-based preview, not a native Android application.

---

🛠️ Technology Stack

Component| Technology
Programming language| JavaScript / Node.js
Desktop application| Electron
Backend| Node.js
Frontend| HTML, CSS, JavaScript
Local AI| Ollama + Qwen3 1.7B
Cloud AI| Google Gemini
Speech recognition| Vosk + faster-whisper
Voice output| Windows Speech / ElevenLabs
Database| SQLite
Authentication| Local pairing and session authentication
Desktop platform| Windows
Email integration| Gmail API + OAuth 2.0
Mobile preview| Android + ADB

---

🚀 Getting Started

Prerequisites

Before installing Grim, ensure you have:

- Windows operating system.
- Node.js version 24 or newer.
- npm.
- Git.
- A working microphone for voice commands.
- Internet access for initial dependency and model downloads.

Optional requirements include a webcam for face-based greetings, a Gemini API key for cloud features, and an ElevenLabs API key for optional speech synthesis.

Step 1: Clone the Repository

Open PowerShell or a terminal and run:

git clone https://github.com/Krecher17/AI-Assistant.git

Navigate into the project directory:

cd AI-Assistant

Step 2: Install Dependencies

npm install

This installs the project's Node.js dependencies.

Local Ollama models and the offline speech runtime may require additional installation. See "LOCAL_AI.md" (LOCAL_AI.md) for the documented model versions and runtime locations.

Step 3: Configure Environment Variables

Copy the example configuration file:

Copy-Item .env.example .env

Edit ".env" and add any credentials you want to use.

For example:

GEMINI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
PORT=4317

These integrations are optional. A Gemini API key is not required when using the local Ollama chat model.

Important: Never upload API keys, OAuth credentials, or your ".env" file to GitHub.

Step 4: Start Grim

Run the desktop application:

npm run desktop

Alternatively, double-click:

Start Grim.cmd

The desktop application will open its local dashboard.

To run the browser-only version:

npm start

Open the private pairing URL displayed in the terminal.

Keep the pairing link confidential.

Step 5: Configure Your Assistant

Inside Grim:

1. Open Settings & connections.
2. Select Local Ollama or Gemini.
3. Configure voice and speech preferences.
4. Add folders Grim is allowed to access.
5. Configure optional integrations.
6. Start chatting or say "Hey Grim".

---

💬 Example Commands

Here are some things you can ask Grim:

Desktop control

Hey Grim, open Calculator.

Open Brave and search for YouTube.

Search Google for JavaScript tutorials.

Open GitHub.

AI assistance

Explain object-oriented programming.

Help me debug this JavaScript code.

Summarize this text.

Explain how machine learning works.

Memory

Remember that I prefer TypeScript.

Remember that I am working on an AI project.

What preferences have I saved?

Productivity

Remind me to study tomorrow at 7 PM.

Search my enabled folders for project files.

Summarize this meeting transcript.

Commands requiring optional integrations work only after those integrations are configured.

---

🏗️ Project Structure

AI-Assistant/
│
├── desktop/
│   └── Electron desktop application
│
├── public/
│   └── Dashboard and interface assets
│
├── src/
│   └── Application modules
│
├── scripts/
│   └── Setup and testing utilities
│
├── test/
│   └── Automated tests
│
├── server.mjs
│
├── package.json
│
├── .env.example
│
├── Start Grim.cmd
│
├── LOCAL_AI.md
│
├── GRIM_COMPANION.md
│
├── IDENTITY.md
│
├── PROJECT_PLAN.md
│
└── README.md

---

🔐 Privacy and Security

Grim is designed with a local-first approach.

Local Processing

When configured with local AI, supported chat and voice processing can operate without sending requests to a cloud AI provider.

The local setup uses:

- Ollama for language-model inference.
- Qwen3 for text generation.
- Vosk for wake-word detection.
- Whisper for speech transcription.
- SQLite for persistent application data.

Initial model downloads require internet access.

Controlled File Access

Grim does not automatically have access to every folder on your computer.

Users must explicitly enable directories.

Model-generated sensitive actions require approval before execution.

Credential Protection

On Windows, supported stored credentials are protected using DPAPI.

Other SQLite records and generated images are not encrypted at rest.

Environment files may contain plaintext secrets and should be protected.

Local Server Security

The backend listens on:

127.0.0.1

It uses private pairing and authenticated sessions.

Grim is intended for a trusted, single-user Windows computer.

Do not expose the development server directly to the public internet.

Cloud Services

When Gemini or other cloud services are enabled, relevant requests and selected content may be sent to those providers.

Users should review the privacy policies and pricing of connected services.

---

⚙️ Configuration

AI Models

Grim supports two primary AI options.

Local Ollama

- Runs supported text inference locally.
- Does not require a cloud AI API key.
- Uses Qwen3 1.7B in the documented default configuration.
- May have limited reasoning capability compared with larger models.

Google Gemini

- Optional cloud-based AI.
- Requires an API key.
- Supports additional capabilities such as compatible vision and image-generation workflows.
- Subject to provider quotas and availability.

Voice Settings

Users can configure:

- Voice provider.
- Voice selection.
- Speech speed.
- Playback volume.
- Optional ElevenLabs voice ID.

Data Storage

By default, application data is stored at:

%LOCALAPPDATA%\Grim

The location can be overridden with:

GRIM_DATA_DIR=

Stored information includes conversations, saved memory, reminders, activity history, and generated images.

---

🧪 Testing

Run the automated checks:

npm run check

Run the test suite:

npm test

Additional testing commands include:

npm run test:desktop
npm run test:voice
npm run test:companion
npm run test:voice-local

Some tests require Windows, Electron, audio fixtures, or installed speech models.

Automated tests do not guarantee that external APIs or integrations will work without valid credentials and configuration.

---

🗺️ Development Roadmap

Grim is an evolving project, with several improvements planned for future releases.

Phase 1 — Desktop Assistant

- [x] Electron desktop application.
- [x] Local dashboard.
- [x] AI-powered chat.
- [x] Persistent memory.
- [x] Windows application launching.
- [x] File access with permissions.

Phase 2 — Voice and Companion

- [x] Wake-word recognition.
- [x] Offline speech transcription.
- [x] Voice responses.
- [x] Animated desktop companion.
- [x] System tray integration.
- [x] Optional face-based greetings.
- [ ] More natural real-time voice conversations.
- [ ] Improved interruption handling.

Phase 3 — Productivity

- [x] Local reminders.
- [x] Gmail read-only integration.
- [x] WhatsApp export searching.
- [x] Audio transcription and meeting summaries.
- [ ] Calendar synchronization.
- [ ] Meeting scheduling integrations.
- [ ] Spotify integration.

Phase 4 — Advanced Automation

- [ ] Advanced Windows UI navigation.
- [ ] General-purpose clicking and typing.
- [ ] More sophisticated task workflows.
- [ ] Improved contextual memory.
- [ ] Stronger identity verification.

Phase 5 — Mobile and Distribution

- [x] Experimental Android browser preview.
- [ ] Native Android application.
- [ ] Desktop-mobile synchronization.
- [ ] Offline mobile recording queues.
- [ ] Signed Windows installer.
- [ ] Automatic application updates.
- [ ] Backup and restore tools.

Roadmap items represent development goals, not guaranteed release commitments.

---

⚠️ Current Limitations

Grim is an early development project.

Some important limitations include:

- Windows is the primary supported desktop platform.
- Local AI performance depends on hardware and model size.
- The local Qwen text model does not support image generation or screenshot understanding.
- General Windows UI automation is not yet implemented.
- Gmail access is read-only.
- WhatsApp requires manually exported conversations.
- The Android experience is currently a browser preview.
- Reminders depend on the application running.
- Some features require cloud credentials or additional local models.
- The application is not yet packaged as a signed production installer.

---

🤝 Contributing

Contributions, suggestions, and improvements are welcome.

To contribute:

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test your implementation.
5. Submit a pull request explaining your changes.

Please avoid committing API keys, private data, or credentials.

For bugs or feature suggestions, open a GitHub issue with a clear description.

---

📚 Additional Documentation

For more technical information, see:

- "Local AI Setup" (LOCAL_AI.md)
- "Desktop Companion" (GRIM_COMPANION.md)
- "Voice and Face Recognition" (IDENTITY.md)
- "Desktop App Launching" (CORE_UPDATE.md)
- "Project Plan" (PROJECT_PLAN.md)

---

👨‍💻 Developer

Akshay Shankar

GitHub: "@Krecher17" (https://github.com/Krecher17)

Repository: "AI-Assistant" (https://github.com/Krecher17/AI-Assistant)

---

🌟 Project Vision

The goal of Grim is to create a personal AI assistant that feels like a natural extension of the user's computer.

An assistant that can understand, remember, communicate, and help with everyday tasks while keeping the user in control.

Grim aims to combine the flexibility of modern AI with the convenience of a desktop companion and the privacy advantages of local processing.

The long-term vision is simple:

An intelligent digital companion that works with you, learns from the information you choose to share, and helps make technology more personal.

---

<div align="center">💀 GRIM

More than a chatbot. Your personal desktop companion.

Built with curiosity, code, and AI.

⭐ Star the repository if you find the project interesting!

</div>