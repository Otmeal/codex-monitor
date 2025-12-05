import * as vscode from "vscode";

/**
 * Heuristic to detect large insertions that are likely from Codex.
 * This is not perfect, but good enough for a first version.
 */
function isLikelyFromCodex(event: vscode.TextDocumentChangeEvent): boolean {
  // Skip if document is not a file (for example untitled)
  if (event.document.uri.scheme !== "file") {
    return false;
  }

  // You can restrict to certain languages if you want
  // Example: only TypeScript and JavaScript
  const languageId = event.document.languageId;
  const allowedLanguages = ["typescript", "javascript", "typescriptreact", "javascriptreact"];
  if (!allowedLanguages.includes(languageId)) {
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
    .get<number>("minInsertedLength", 200);

  return insertedLength >= threshold;
}

/**
 * Triggered when we think Codex has finished a large edit.
 * You can customize this to play sound, show notification, or call external scripts.
 */
function handleCodexLikeEdit(document: vscode.TextDocument): void {
  // Simple VS Code notification
  vscode.window.showInformationMessage(
    `Codex-like edit detected in: ${document.fileName}`
  );

  // Simple bell character in the status bar message
  vscode.window.setStatusBarMessage("Codex-like edit finished \u0007", 3000);

  // If you want to call external script:
  // const terminal = vscode.window.createTerminal("CodexMonitor");
  // terminal.sendText("bash ./scripts/notify.sh");
  // terminal.dispose();
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
    try {
      if (isLikelyFromCodex(event)) {
        handleCodexLikeEdit(event.document);
      }
    } catch (error) {
      console.error("Codex monitor error:", error);
    }
  });

  context.subscriptions.push(disposable);

  vscode.window.showInformationMessage("Codex monitor extension activated.");
}

export function deactivate() {
  // Nothing specific to clean up for now
}
