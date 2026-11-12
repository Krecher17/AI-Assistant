# Grim voice and face

Say **Hey Grim, open Calculator**, or say **Hey Grim**, wait for the greeting, then give a command. Each completed turn returns to local wake listening. A dedicated, vocabulary-constrained Vosk wake recognizer runs locally alongside general transcription; only an awakened command is submitted for assistant processing. Ordinary standby speech is not sent to Gemini. The latest local transcript is shown transiently in the dashboard to diagnose missed wake words; it is not saved. After a wake-only greeting, commands are recorded until a pause (up to 15 seconds) and transcribed with Gemini when a key is configured. These command clips are sent only after waking and are not stored. Without a key, local command transcription remains available.

There is no voice enrollment, speaker matching, or voice-based access gate. Previously stored voice templates are removed from the active migrated profile. Face recognition is optional and changes only the greeting. Without a face match Grim says “Yes? I’m here.”

In **Face & devices**, select the laptop Microphone Array and Integrated Webcam. Phone, virtual and IR cameras are excluded. Test microphone shows the actual incoming signal. Enroll my face saves three local descriptors, then stops the camera. Recognize me enables periodic matching until Stop camera. Check face on wake if you want a brief camera check for each greeting; this can add latency, especially on the first model load. Camera frames stay in the renderer and descriptors are compared through the localhost service.

In Electron, wake listening starts unless previously paused. Close hides the dashboard but keeps the listener running. Use the tray Wake listening checkbox, dashboard Pause button, Escape, or “Hey Grim, stop listening” to pause. Quit Grim stops the app. The laptop must be awake. The microphone indicator and tray tooltip show listening state. Native microphone errors produce a notification.

**Voice & speech** controls reply voice, speed, volume and optional ElevenLabs voice ID. Save and preview plays a sample. Native Windows speech is default and works while the dashboard is hidden.

Verification uses real Vosk recognition with synthetic speech fed through the microphone-processing pipeline. It does not establish accuracy for Akshay’s accent, room noise or microphone placement. Face matching is a convenience feature without liveness detection, not authentication.
