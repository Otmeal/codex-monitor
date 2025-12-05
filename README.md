# Codex Monitor

Codex Monitor is a local-only VS Code extension that alerts you when a single edit inserts a large chunk of text—useful for spotting AI-generated completions that just landed in your file.

## What it does
- Watches all file edits and sums the number of inserted characters for each change event.
- If an edit exceeds a configurable threshold, it plays a bundled chime, posts a notification, and shows a temporary status bar message.
- Runs entirely locally; no data leaves your machine, and sound is played through the extension via `node-wav-player`.

## Quick start
1. Install from `codex-monitor-0.0.1.vsix` via the VS Code command palette (`Extensions: Install from VSIX...`).
2. Reload VS Code if prompted.
3. Make a large paste or completion; when it crosses the threshold, you’ll hear a chime and see a notification.

## Configuration
- `codexMonitor.minInsertedLength` (number, default `200`): Minimum characters inserted in a single edit before Codex Monitor fires.

## How detection works
The extension listens to `onDidChangeTextDocument`, totals the inserted characters for that edit, and compares it against your configured threshold. When triggered, it plays the bundled `media/chime.wav` via `node-wav-player`, pops an info notification naming the file, and briefly shows a status bar message. Errors are logged to the “Codex Monitor” output channel.

## Notes and limitations
- The heuristic is intentionally simple; it flags any large insert, regardless of source.
- Sound playback uses the bundled `media/chime.wav` via `node-wav-player`, and on WSL will fall back to Windows PowerShell/PowerShell 7 if the Linux player (`aplay`/`paplay`) is missing. If you do not hear anything, verify that your environment can play audio (WSL may need WSLg audio support or to run the extension in the Windows host). Check the “Codex Monitor” output channel for errors.

## Behavior at a glance
- Edit size < threshold: no action.
- Edit size ≥ threshold: chime plays, notification appears, status bar message shows briefly.
- Playback errors: logged in “Codex Monitor” output.

## Troubleshooting sound
- Open “View → Output → Codex Monitor” to see any playback errors.
- Verify your OS can play audio outside VS Code (e.g., run a media player). On WSL, make sure audio is supported/enabled; if not, run the extension on the Windows host. If you see `aplay`/`paplay` errors, the PowerShell fallback tries both PATH and absolute Windows locations (including PowerShell 7); ensure Windows PowerShell/PowerShell 7 is installed.
- If you rebuilt the extension, ensure `media/chime.wav` is present in the packaged VSIX.

## Developing
- Build once: `npm run compile`
- Watch mode: `npm run watch`
- Lint: `npm run lint`
- Tests: `npm test`
