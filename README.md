# AgentJob

AgentJob is a private desktop workspace for reviewing job listings, generating truthful cover letters, attaching role-specific resumes, sending applications over SMTP, and tracking outcomes.

## Stack

- Tauri 2 + Rust
- React 19 + TypeScript + Vite
- Tailwind CSS 4
- Zustand local state
- `reqwest` for configurable AI providers
- `lettre` for SMTP delivery

## Run locally

```powershell
npm install
npm run tauri dev
```

Use `npm run dev` for a browser-only UI preview. Native features such as PDF import, OS credential storage, endpoint calls, SMTP delivery, and CSV export require the Tauri desktop runtime.

## Verify

```powershell
npm run lint
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml
```

## Privacy model

- No identity, credentials, resumes, or tracker records are copied from the legacy bot.
- Profile and application state are stored in the operating system's AgentJob app-data directory as `memory.json`.
- API keys and the SMTP password are stored in the operating system credential vault and represented only by a sentinel in `memory.json`.
- Job text is sent off-device only when an active AI endpoint is configured and the user explicitly runs a reviewer or adaptive creator action.
- Email is sent only after the user explicitly clicks **Send application**.

## Provider protocols

- OpenAI-compatible chat completions and model discovery
- Anthropic Messages API
- Google Gemini native generate-content API
- Ollama's OpenAI-compatible API

Deterministic templates and the local job reviewer remain available without an AI endpoint.
