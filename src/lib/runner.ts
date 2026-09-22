import type { ProtocolStep } from "@/lib/protocols";
import { useApp } from "@/lib/store";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if running in Electron environment with IPC support
 */
function isElectronAvailable(): boolean {
  return typeof window !== "undefined" && window.electronAPI?.executeCommand !== undefined;
}

/**
 * Execute a single command via Electron IPC or simulate if not available
 */
async function executeCommand(cmd: string): Promise<{ success: boolean; error?: string }> {
  if (isElectronAvailable()) {
    try {
      const result = await window.electronAPI!.executeCommand(cmd);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  } else {
    // Fallback: simulate execution for development/browser mode
    console.warn("[Runner] Electron API not available, simulating command execution");
    await sleep(70);
    return { success: true };
  }
}

export async function runProtocol(steps: ProtocolStep[], doneMessage?: string) {
  const { lang, busy, setBusy, log, setLastOp } = useApp.getState();
  if (busy) return false;
  setBusy(true);

  try {
    for (const step of steps) {
      // Log the step message
      log(lang === "fa" ? step.messageFa : step.message, "info");
      
      // Log the command being executed
      log(step.cmd, "cmd");

      // Wait before execution if specified
      if (step.waitMs) {
        await sleep(step.waitMs);
      }

      // Execute the command
      const result = await executeCommand(step.cmd);

      if (!result.success) {
        // Command failed
        const errorMsg = result.error || (lang === "fa" ? "خطا در اجرا" : "Execution failed");
        log(errorMsg, "err");
        
        // Log detailed error for debugging
        if (result.error) {
          console.error(`[Runner] Command failed: ${step.cmd}`, result.error);
        }
        
        return false;
      }

      // Command succeeded
      log(lang === "fa" ? "انجام شد." : "Done.", "ok");
    }

    // All steps completed successfully
    if (doneMessage) {
      log(doneMessage, "ok");
      setLastOp(doneMessage);
    }
    return true;
  } catch (error) {
    // Unexpected error during protocol execution
    const errorMsg = lang === "fa" ? "خطا در اجرای پروتکل." : "Protocol failed.";
    log(errorMsg, "err");
    console.error("[Runner] Protocol execution error:", error);
    return false;
  } finally {
    setBusy(false);
  }
}
