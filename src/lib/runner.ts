import type { ProtocolStep } from "@/lib/protocols";
import { useApp } from "@/lib/store";
import { logger } from "@/lib/logger";

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
      logger.debug('RUNNER', `Executing command: ${cmd}`);
      const result = await window.electronAPI!.executeCommand(cmd);
      
      if (result.success) {
        logger.info('RUNNER', `Command executed successfully: ${cmd}`);
      } else {
        logger.error('RUNNER', `Command failed: ${cmd}`, { error: result.error });
      }
      
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error('RUNNER', `Command execution error: ${cmd}`, { error: errorMsg });
      return {
        success: false,
        error: errorMsg,
      };
    }
  } else {
    // Fallback: simulate execution for development/browser mode
    logger.warn('RUNNER', `Electron API not available, simulating command: ${cmd}`);
    console.warn("[Runner] Electron API not available, simulating command execution");
    await sleep(70);
    return { success: true };
  }
}

/**
 * Fast execution for DNS operations using batch commands
 */
export async function runProtocolFast(steps: ProtocolStep[], doneMessage?: string): Promise<boolean> {
  const { lang, busy, setBusy, log, setLastOp } = useApp.getState();
  if (busy) return false;
  
  logger.info('RUNNER', `Starting fast protocol execution with ${steps.length} steps`);
  setBusy(true);

  try {
    const commands = steps.map(step => step.cmd);
    logger.debug('RUNNER', 'Fast mode commands prepared', { commands });
    
    // Use batch execution for better performance
    if (typeof window !== "undefined" && window.electronAPI?.executeBatchCommands) {
      log(lang === "fa" ? "اعمال سریع DNS..." : "Fast DNS execution...", "info");
      logger.info('RUNNER', 'Executing batch commands via Electron API');
      
      const result = await window.electronAPI.executeBatchCommands(commands);
      
      if (result.success) {
        log(lang === "fa" ? "DNS با موفقیت اعمال شد." : "DNS applied successfully.", "ok");
        logger.info('RUNNER', 'Fast protocol execution completed successfully', { doneMessage });
        if (doneMessage) {
          setLastOp(doneMessage);
        }
        return true;
      } else {
        console.error("Fast DNS execution failed:", result.error);
        logger.error('RUNNER', 'Fast protocol execution failed, falling back to regular mode', { error: result.error });
        log(lang === "fa" ? "خطا در اعمال سریع، تلاش با روش عادی..." : "Fast mode failed, falling back...", "info");
        // Fallback to regular execution
      }
    } else {
      logger.warn('RUNNER', 'Batch commands API not available, falling back to regular mode');
    }
    
    // Fallback to regular execution if batch API not available or failed
    setBusy(false); // Reset busy state for regular execution
    return await runProtocol(steps, doneMessage);
    
  } catch (error) {
    console.error("Fast DNS execution error:", error);
    logger.error('RUNNER', 'Fast protocol execution encountered an error', { error });
    const errorMsg = lang === "fa" ? "خطا در اعمال سریع DNS." : "Fast DNS execution failed.";
    log(errorMsg, "err");
    setBusy(false); // Reset busy state for fallback
    return await runProtocol(steps, doneMessage);
  } finally {
    setBusy(false);
  }
}

export async function runProtocol(steps: ProtocolStep[], doneMessage?: string) {
  const { lang, busy, setBusy, log, setLastOp } = useApp.getState();
  if (busy) return false;
  
  logger.info('RUNNER', `Starting regular protocol execution with ${steps.length} steps`);
  setBusy(true);

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      logger.debug('RUNNER', `Executing step ${i + 1}/${steps.length}: ${step.cmd}`);
      
      // Log the step message
      log(lang === "fa" ? step.messageFa : step.message, "info");
      
      // Log the command being executed
      log(step.cmd, "cmd");

      // Wait before execution if specified
      if (step.waitMs) {
        logger.debug('RUNNER', `Waiting ${step.waitMs}ms before execution`);
        await sleep(step.waitMs);
      }

      // Execute the command
      const result = await executeCommand(step.cmd);

      if (!result.success) {
        // Command failed
        const errorMsg = result.error || (lang === "fa" ? "خطا در اجرا" : "Execution failed");
        log(errorMsg, "err");
        logger.error('RUNNER', `Protocol execution failed at step ${i + 1}`, { 
          step: step.cmd, 
          error: result.error 
        });
        
        // Log detailed error for debugging
        if (result.error) {
          console.error(`[Runner] Command failed: ${step.cmd}`, result.error);
        }
        
        return false;
      }

      // Command succeeded
      log(lang === "fa" ? "انجام شد." : "Done.", "ok");
      logger.debug('RUNNER', `Step ${i + 1} completed successfully`);
      
      // Wait after execution if specified
      if (step.waitAfterMs) {
        logger.debug('RUNNER', `Waiting ${step.waitAfterMs}ms after execution`);
        await sleep(step.waitAfterMs);
      }
    }

    // All steps completed successfully
    if (doneMessage) {
      log(doneMessage, "ok");
      setLastOp(doneMessage);
    }
    logger.info('RUNNER', 'Protocol execution completed successfully', { doneMessage });
    return true;
  } catch (error) {
    // Unexpected error during protocol execution
    const errorMsg = lang === "fa" ? "خطا در اجرای پروتکل." : "Protocol failed.";
    log(errorMsg, "err");
    logger.error('RUNNER', 'Protocol execution encountered an unexpected error', { error });
    console.error("[Runner] Protocol execution error:", error);
    return false;
  } finally {
    setBusy(false);
  }
}
