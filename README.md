# Codex Monitor

Codex Monitor is a local-only VS Code extension that alerts you when a single edit inserts a large chunk of text—useful for spotting AI-generated completions that just landed in your file.

## What it does

- Watches all file edits and sums the number of inserted characters for each change event.
- If an edit exceeds a configurable threshold, it emits a system beep through PowerShell, posts a notification, and shows a temporary status bar message.
- Runs entirely locally; no data leaves your machine, and sound is emitted using Windows PowerShell (or PowerShell 7).

## Quick start

1. Install from `codex-monitor-0.0.1.vsix` via the VS Code command palette (`Extensions: Install from VSIX...`).
2. Reload VS Code if prompted.
3. Make a large paste or completion; when it crosses the threshold, you’ll hear a PowerShell beep and see a notification.

## Configuration

- `codexMonitor.minInsertedLength` (number, default `200`): Minimum characters inserted in a single edit before Codex Monitor fires.
- Tip: set this lower (e.g., 50–100) if you want more frequent alerts while testing; raise it (e.g., 400–800) to only catch very large AI completions.

## How detection works

The extension listens to `onDidChangeTextDocument`, totals the inserted characters for that edit, and compares it against your configured threshold. When triggered, it emits a PowerShell beep, pops an info notification naming the file, and briefly shows a status bar message. Errors are logged to the “Codex Monitor” output channel.
Each trigger also writes a timestamped line to the “Codex Monitor” output channel with the inserted character count and the threshold that was used.

## Notes and limitations

- The heuristic is intentionally simple; it flags any large insert, regardless of source.
- Sound playback uses Windows PowerShell/PowerShell 7 to issue a system beep. On WSL, it relies on interop to reach Windows PowerShell instances; if you do not hear anything, verify that PowerShell is reachable and the “Codex Monitor” output channel for errors.

## Behavior at a glance

- Edit size < threshold: no action.
- Edit size ≥ threshold: a PowerShell beep sounds, notification appears, status bar message shows briefly.
- Playback errors: logged in “Codex Monitor” output.

## Tuning

- Want a quick sanity check? Temporarily drop `codexMonitor.minInsertedLength` to something small and paste a few sentences; restore it after.
- Too many beeps while coding? Increase the threshold until it only fires on bulk insertions.
- Need silence but still want notifications? Mute system audio or disable sounds at the OS level; the extension will still post notifications and status messages.

## Troubleshooting sound

- Open “View → Output → Codex Monitor” to see any playback errors.
- Verify PowerShell commands work outside VS Code (e.g., run `powershell.exe` or `pwsh.exe`). On WSL, make sure interop is enabled so the Linux host can reach Windows PowerShell; run the extension on the Windows host if that is not possible. Check the “Codex Monitor” output channel for errors.
- Common error messages:
  - `spawn powershell.exe ENOENT`: Windows PowerShell isn’t reachable from the current environment; ensure interop is enabled and `powershell.exe` is on PATH or installed at the usual location.
  - `spawn pwsh.exe ENOENT`: PowerShell 7 isn’t reachable from the current environment; ensure it is installed and on the PATH.

## Developing

- Build once: `npm run compile`
- Watch mode: `npm run watch`
- Lint: `npm run lint`
- Tests: `npm test`
