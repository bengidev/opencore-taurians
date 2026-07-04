# OpenCore Taurians

A desktop application that brings frontier AI capabilities into a unified workspace. OpenCore Taurians combines an **editor**, **chat**, and **terminal** so you can plan, build, and ship without switching tools.

## Why OpenCore Taurians

Modern AI workflows are fragmented: you write code in one app, talk to models in another, and run commands in a third. OpenCore Taurians keeps all three in one native desktop shell—fast, local, and designed for real work.

| Mode | Purpose |
|------|---------|
| **Editor** | Read and edit project files with AI-aware context |
| **Chat** | Converse with frontier models about your codebase and tasks |
| **Terminal** | Run builds, scripts, and shell commands alongside your work |

## Tech Stack

- **[Tauri 2](https://tauri.app/)** — lightweight, secure desktop runtime (Rust)
- **[React 19](https://react.dev/)** — UI with TypeScript
- **[Vite](https://vite.dev/)** — fast frontend tooling

## Prerequisites

- [Bun](https://bun.sh/) (package manager and scripts)
- [Rust](https://www.rust-lang.org/tools/install) (Tauri backend)
- Platform dependencies for [Tauri](https://tauri.app/start/prerequisites/)

## Getting Started

```bash
# Install dependencies
bun install

# Run the desktop app in development
bun run tauri dev
```

### Other Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Frontend only (Vite dev server) |
| `bun run build` | Build the React frontend |
| `bun run tauri build` | Production desktop bundle |

## Configuration

Copy the example environment file and add your API keys when AI providers are wired in:

```bash
cp .env.example .env
```

Never commit `.env` or other secrets.

## Project Status

Early development. The three-mode workspace (editor, chat, terminal) and AI integrations are actively being built on top of the Tauri + React foundation.

## Contributing

Contributions are welcome. Please open an issue to discuss larger changes before submitting a pull request.

## License

[MIT](LICENSE) © Bengi
