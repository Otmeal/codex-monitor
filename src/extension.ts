import { execFile } from "node:child_process";
import * as os from "node:os";
import { promisify } from "node:util";
import * as vscode from "vscode";

const execFileAsync = promisify(execFile);

let outputChannel: vscode.OutputChannel | undefined;

type CodexEditInfo = {
  insertedLength: number;
  threshold: number;
};

type SoundPlaybackMethod = {
  id: "powershell-beep";
  label: string;
  command?: string;
};

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Codex Monitor");
  }
  return outputChannel;
}

function quoteArgForLog(arg: string): string {
  if (/[\s'"]/.test(arg)) {
    const escaped = arg.replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return arg;
}

function formatCommandForLog(command: string, args: string[]): string {
  return [command, ...args].map(quoteArgForLog).join(" ");
}

async function toWslPath(windowsPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("wslpath", ["-u", windowsPath]);
    return stdout.trim();
  } catch (error) {
    getOutputChannel().appendLine(
      `Failed to convert Windows path with wslpath (${windowsPath}): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return undefined;
  }
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

async function getWslPowerShellCandidates(): Promise<
  Array<{ command: string; label: string }>
> {
  if (!isWSL()) {
    return [];
  }

  const powershellWslPath = await toWslPath(
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
  );
  const pwsh7WslPath = await toWslPath(
    "C:\\Program Files\\PowerShell\\7\\pwsh.exe"
  );

  return [
    {
      command: "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
      label: "powershell.exe (absolute /mnt/c)",
    },
    powershellWslPath
      ? { command: powershellWslPath, label: "powershell.exe (wslpath)" }
      : undefined,
    { command: "pwsh.exe", label: "pwsh.exe (PATH)" },
    {
      command: "/mnt/c/Program Files/PowerShell/7/pwsh.exe",
      label: "pwsh.exe (absolute /mnt/c)",
    },
    pwsh7WslPath
      ? { command: pwsh7WslPath, label: "pwsh.exe (wslpath)" }
      : undefined,
  ].filter(
    (candidate): candidate is { command: string; label: string } =>
      candidate !== undefined
  );
}

function formatPlaybackMethod(method: SoundPlaybackMethod): string {
  return `PowerShell beep (${method.label})`;
}

function logSoundPlaybackSuccess(method: SoundPlaybackMethod): void {
  const commandInfo = method.command ? ` Command: ${method.command}` : "";
  getOutputChannel().appendLine(
    `Sound playback succeeded via ${formatPlaybackMethod(
      method
    )}.${commandInfo}`
  );
}

async function playViaPowerShellBeep(): Promise<
  SoundPlaybackMethod | undefined
> {
  const powershellScript = [
    '$ErrorActionPreference = "Stop"',
    "[System.Media.SystemSounds]::Beep.Play()",
  ].join("; ");
  const args = ["-NoProfile", "-Command", powershellScript];

  const candidates = isWSL()
    ? await getWslPowerShellCandidates()
    : [
        { command: "powershell.exe", label: "powershell.exe (PATH)" },
        { command: "pwsh.exe", label: "pwsh.exe (PATH)" },
      ];

  if (candidates.length === 0) {
    getOutputChannel().appendLine(
      "No PowerShell candidates found for beep playback."
    );
    return undefined;
  }

  for (const candidate of candidates) {
    const fullCommand = formatCommandForLog(candidate.command, args);
    getOutputChannel().appendLine(
      `Attempting sound playback with command: ${fullCommand}`
    );
    try {
      await execFileAsync(candidate.command, args);
      return {
        id: "powershell-beep",
        label: candidate.label,
        command: fullCommand,
      };
    } catch (error) {
      getOutputChannel().appendLine(
        `PowerShell beep fallback failed (${
          candidate.label
        }) with command ${fullCommand}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return undefined;
}
/**
 * Heuristic to detect large insertions that are likely from Codex and return
 * the relevant info for downstream logging.
 */
function getCodexLikeEditInfo(
  event: vscode.TextDocumentChangeEvent
): CodexEditInfo | undefined {
  // Skip if document is not a file (for example untitled)
  if (event.document.uri.scheme !== "file") {
    return undefined;
  }

  if (event.contentChanges.length === 0) {
    return undefined;
  }

  // Calculate total inserted characters
  const insertedLength = event.contentChanges
    .map((change) => change.text.length)
    .reduce((sum, length) => sum + length, 0);

  // Threshold: if a single edit inserts a lot of text, we assume it may be Codex
  const threshold = vscode.workspace
    .getConfiguration("codexMonitor")
    .get<number>("minInsertedLength", 10);

  if (insertedLength < threshold) {
    return undefined;
  }

  return { insertedLength, threshold };
}

async function playCompletionSound(): Promise<void> {
  const played = await playViaPowerShellBeep();
  if (played) {
    logSoundPlaybackSuccess(played);
    return;
  }

  getOutputChannel().appendLine(
    "Sound playback failed while attempting the PowerShell beep."
  );
}

/**
 * Triggered when we think Codex has finished a large edit.
 * You can customize this to play sound, show notification, or call external scripts.
 */
function handleCodexLikeEdit(
  document: vscode.TextDocument,
  info: CodexEditInfo
): void {
  const timestamp = new Date().toLocaleTimeString();
  getOutputChannel().appendLine(
    `[${timestamp}] Codex-like edit: ${info.insertedLength} chars (threshold ${info.threshold}) in ${document.fileName}`
  );

  void playCompletionSound();

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
  const playTestSound = vscode.commands.registerCommand(
    "codexMonitor.playTestSound",
    async () => {
      getOutputChannel().appendLine("Manual beep test triggered.");
      await playCompletionSound();
      void vscode.window.showInformationMessage(
        "Codex Monitor test beep requested."
      );
    }
  );

  const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
    try {
      const info = getCodexLikeEditInfo(event);
      if (info) {
        handleCodexLikeEdit(event.document, info);
      }
    } catch (error) {
      console.error("Codex monitor error:", error);
    }
  });

  context.subscriptions.push(playTestSound);
  context.subscriptions.push(disposable);
  context.subscriptions.push(getOutputChannel());

  vscode.window.showInformationMessage("Codex monitor extension activated.");
}

export function deactivate() {
  // Nothing specific to clean up for now
}
