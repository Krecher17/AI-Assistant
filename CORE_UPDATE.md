# Grim app launching

The animated companion replaces the earlier 3D initial. See [GRIM_COMPANION.md](GRIM_COMPANION.md) for the current appearance and voice behavior.

## General Windows app launching

The old fixed app list is replaced by Windows AppsFolder discovery. This laptop exposed 130 registered apps during verification. The catalog warms in the background, caches for five minutes, and can be refreshed from Installed apps.

Direct user commands such as “open Calculator” or “launch Example Editor” resolve against this catalog and activate the app immediately, without a Gemini key, model call, or approval click. Unknown and ambiguous names return clear results. Only catalog-resolved targets are passed to Explorer's AppsFolder activation; names are never executed as shell text or command-line arguments. Portable executables not registered with Windows are not discovered by this version. Apps may still show their own setup, sign-in, or UAC prompts.

Model-generated app tool calls keep proposal/approval because external source content can influence them. File changes and external actions retain their review gates. The local fast path applies to the user's explicit app-launch request from authenticated chat or an awakened command turn.

