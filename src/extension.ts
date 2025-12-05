import { execFile } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";

const wavPlayer = require("node-wav-player") as {
  play(options: { path: string }): Promise<void>;
};

const execFileAsync = promisify(execFile);

let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Codex Monitor");
  }
  return outputChannel;
}

function getChimePath(context: vscode.ExtensionContext): string {
  return context.asAbsolutePath(path.join("media", "chime.wav"));
}

function isWSL(): boolean {
  if (process.platform !== "linux") {
    return false;
  }

  if ("WSL_DISTRO_NAME" in process.env || "WSL_INTEROP" in process.env) {
    return true;
  }

  return os.release().toLowerCase().includes("microsoft");
}

async function playViaWslPowerShell(
  context: vscode.ExtensionContext
): Promise<boolean> {
  if (!isWSL()) {
    return false;
  }

  const chimePath = getChimePath(context);
  let windowsPath = chimePath;

  try {
    const { stdout } = await execFileAsync("wslpath", ["-w", chimePath]);
    windowsPath = stdout.trim();
  } catch (error) {
    getOutputChannel().appendLine(
      `Failed to convert path with wslpath: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const escapedPath = windowsPath.replace(/'/g, "''");
  const powershellScript = [
    "$ErrorActionPreference = 'Stop'",
    `$path = '${escapedPath}'`,
    "[System.Reflection.Assembly]::LoadWithPartialName('System.Media') | Out-Null",
    "$player = New-Object System.Media.SoundPlayer",
    "$player.SoundLocation = $path",
    "$player.PlaySync()"
  ].join("; ");

  const candidates = [
    { command: "powershell.exe", label: "powershell.exe (PATH)" },
    {
      command: "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
      label: "powershell.exe (absolute)"
    },
    { command: "pwsh.exe", label: "pwsh.exe (PATH)" },
    {
      command: "/mnt/c/Program Files/PowerShell/7/pwsh.exe",
      label: "pwsh.exe (absolute)"
    }
  ];

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate.command, [
        "-NoProfile",
        "-Command",
        powershellScript
      ]);
      return true;
    } catch (error) {
      getOutputChannel().appendLine(
        `WSL PowerShell fallback failed (${candidate.label}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return false;
}

/**
 * Heuristic to detect large insertions that are likely from Codex.
 * This is not perfect, but good enough for a first version.
 */
function isLikelyFromCodex(event: vscode.TextDocumentChangeEvent): boolean {
  // Skip if document is not a file (for example untitled)
  if (event.document.uri.scheme !== "file") {
    return false;
  }

  if (event.contentChanges.length === 0) {
    return false;
  }

  // Calculate total inserted characters
  const insertedLength = event.contentChanges
    .map((change) => change.text.length)
    .reduce((sum, length) => sum + length, 0);

  // Threshold: if a single edit inserts a lot of text, we assume it may be Codex
  const threshold = vscode.workspace.getConfiguration("codexMonitor")
    .get<number>("minInsertedLength", 10);

  return insertedLength >= threshold;
}

async function playCompletionSound(
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    await wavPlayer.play({ path: getChimePath(context) });
    return;
  } catch (error) {
    getOutputChannel().appendLine(
      `Sound playback failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const playedWithFallback = await playViaWslPowerShell(context);
  if (!playedWithFallback) {
    getOutputChannel().appendLine("Sound playback failed after fallbacks.");
  }
}

/**
 * Triggered when we think Codex has finished a large edit.
 * You can customize this to play sound, show notification, or call external scripts.
 */
function handleCodexLikeEdit(
  document: vscode.TextDocument,
  context: vscode.ExtensionContext
): void {
  void playCompletionSound(context);

  // Simple VS Code notification
  vscode.window.showInformationMessage(
    `Codex-like edit detected in: ${document.fileName}`
  );

  vscode.window.setStatusBarMessage("Codex-like edit finished", 3000);

  // If you want to call external script:
  // const terminal = vscode.window.createTerminal("CodexMonitor");
  // terminal.sendText("bash ./scripts/notify.sh");
  // terminal.dispose();
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
    try {
      if (isLikelyFromCodex(event)) {
        handleCodexLikeEdit(event.document, context);
      }
    } catch (error) {
      console.error("Codex monitor error:", error);
    }
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(getOutputChannel());

  vscode.window.showInformationMessage("Codex monitor extension activated.");
}

export function deactivate() {
  // Nothing specific to clean up for now
}
