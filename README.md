# Codex Monitor

Minimal VS Code extension that detects large text insertions and alerts locally.

## Build `.vsix` from a fresh clone

```bash
cd codex-monitor
npm ci
npm exec -- vsce package
```

The package is created in the repo root as `codex-monitor-<version>.vsix`.
