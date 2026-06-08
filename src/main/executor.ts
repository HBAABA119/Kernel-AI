/**
 * KernelAI - Sandboxed Shell Executor
 * Implements Windows System Restore Point creation and rollback ledger management
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { app } from 'electron';
import { AIActionPlan, ExecutionLogEntry } from '../shared/types';

const execAsync = promisify(exec);

// ============================================================================
// Configuration & Constants
// ============================================================================

const LEDGER_FILE = 'rollback_ledger.json';
const LOGS_DIR = 'execution_logs';

// Destructive pattern blacklist for safety filtering
const DESTRUCTIVE_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /del\s+\/s\s+\/q\s+c:\\windows/i,
  /format\s+/i,
  /diskpart/i,
  /reg\s+delete.*HKLM\\SYSTEM/i,
  /sc\s+delete.*[Bb]oot/i,
  /taskkill.*explorer\.exe/i,
  /rmdir\s+\/s\s+\/q\s+c:\\$/i,
  /Remove-Item\s+-Recurse\s+-Force\s+C:\\$/i,
];

// Safe command prefixes
const SAFE_COMMAND_PREFIXES = [
  'del /q',
  'rmdir /s /q',
  'cleanmgr',
  'dism',
  'sfc',
  'chkdsk',
  'powershell -command',
  'cmd /c',
  'reg add',
  'reg delete',
  'sc config',
  'sc stop',
  'taskkill /im',
  'net stop',
  'net start',
];

// ============================================================================
// Types
// ============================================================================

interface LedgerEntry {
  planId: string;
  timestamp: string;
  actions: Array<{
    actionId: string;
    script: string;
    rollbackScript: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  }>;
  restorePointCreated: boolean;
  restorePointId?: string;
}

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getLedgerPath(): string {
  const appData = app.getPath('appData');
  const kernelAIDir = join(appData, 'KernelAI');
  return join(kernelAIDir, LEDGER_FILE);
}

function getLogsDir(): string {
  const appData = app.getPath('appData');
  const kernelAIDir = join(appData, 'KernelAI');
  const logsDir = join(kernelAIDir, LOGS_DIR);
  return logsDir;
}

async function ensureDirectories(): Promise<void> {
  const ledgerPath = getLedgerPath();
  const logsDir = getLogsDir();
  
  await fs.mkdir(dirname(ledgerPath), { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
}

function sanitizeCommand(command: string): string {
  // Remove dangerous characters
  let sanitized = command.replace(/[&|;`$(){}]/g, '');
  
  // Normalize whitespace
  sanitized = sanitized.trim().replace(/\s+/g, ' ');
  
  return sanitized;
}

function isCommandSafe(command: string): boolean {
  const normalizedCommand = command.toLowerCase();
  
  // Check against destructive patterns
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(normalizedCommand)) {
      return false;
    }
  }
  
  // Check if starts with safe prefix
  for (const prefix of SAFE_COMMAND_PREFIXES) {
    if (normalizedCommand.startsWith(prefix.toLowerCase())) {
      return true;
    }
  }
  
  // Allow PowerShell commands that don't match destructive patterns
  if (normalizedCommand.startsWith('powershell')) {
    return true;
  }
  
  return false;
}

// ============================================================================
// System Restore Point Creation
// ============================================================================

async function createSystemRestorePoint(): Promise<{ success: boolean; restorePointId?: string }> {
  const description = `KernelAI Optimization - ${new Date().toISOString()}`;
  
  const powershellCommand = `
    $description = "${description}"
    Enable-ComputerRestore -Drive "C:"
    Checkpoint-Computer -Description $description -RestorePointType "MODIFY_SETTINGS"
  `.replace(/\n/g, ' ').trim();
  
  try {
    const { stdout, stderr } = await execAsync(powershellCommand, {
      timeout: 60000,
      windowsHide: true,
    });
    
    // Extract restore point ID if available
    const idMatch = stdout.match(/ID\s*[:=]\s*(\d+)/i);
    const restorePointId = idMatch ? idMatch[1] : undefined;
    
    return {
      success: !stderr || stderr.trim() === '',
      restorePointId,
    };
  } catch (error: any) {
    console.error('Failed to create restore point:', error.message);
    // Continue anyway - restore point is best-effort
    return {
      success: false,
      restorePointId: undefined,
    };
  }
}

// ============================================================================
// Command Execution Engine
// ============================================================================

async function executeCommand(
  command: string,
  timeoutMs: number = 30000
): Promise<ExecutionResult> {
  const sanitized = sanitizeCommand(command);
  
  if (!isCommandSafe(sanitized)) {
    return {
      success: false,
      output: '',
      error: 'Command blocked by safety filter: potentially destructive operation detected',
    };
  }
  
  return new Promise((resolve) => {
    const child = exec(sanitized, {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('exit', (code) => {
      resolve({
        success: code === 0,
        output: stdout.trim(),
        error: stderr.trim() || undefined,
        exitCode: code ?? undefined,
      });
    });
    
    child.on('error', (err) => {
      resolve({
        success: false,
        output: '',
        error: err.message,
      });
    });
    
    child.on('timeout', () => {
      child.kill();
      resolve({
        success: false,
        output: '',
        error: 'Command execution timed out',
      });
    });
  });
}

// ============================================================================
// Ledger Management
// ============================================================================

async function readLedger(): Promise<LedgerEntry[]> {
  try {
    const ledgerPath = getLedgerPath();
    const content = await fs.readFile(ledgerPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}

async function writeLedger(entries: LedgerEntry[]): Promise<void> {
  const ledgerPath = getLedgerPath();
  await fs.writeFile(ledgerPath, JSON.stringify(entries, null, 2), 'utf-8');
}

async function addToLedger(entry: LedgerEntry): Promise<void> {
  const entries = await readLedger();
  entries.push(entry);
  await writeLedger(entries);
}



// ============================================================================
// Executor Class
// ============================================================================

export class ShellExecutor {
  private currentPlan: AIActionPlan | null = null;
  private executionLogs: Map<string, ExecutionLogEntry> = new Map();
  
  async executePlan(plan: AIActionPlan): Promise<ExecutionLogEntry[]> {
    await ensureDirectories();
    
    this.currentPlan = plan;
    const results: ExecutionLogEntry[] = [];
    
    // Step 1: Create System Restore Point
    const restoreResult = await createSystemRestorePoint();
    
    // Step 2: Create ledger entry
    const ledgerEntry: LedgerEntry = {
      planId: plan.planId,
      timestamp: new Date().toISOString(),
      actions: plan.actions.map((action) => ({
        actionId: action.id,
        script: action.script,
        rollbackScript: action.rollbackScript,
        status: 'pending',
      })),
      restorePointCreated: restoreResult.success,
      restorePointId: restoreResult.restorePointId,
    };
    
    await addToLedger(ledgerEntry);
    
    // Step 3: Execute actions in recommended order
    const actionOrder = plan.recommendedOrder.length > 0 
      ? plan.recommendedOrder 
      : plan.actions.map((a) => a.id);
    
    for (const actionId of actionOrder) {
      const action = plan.actions.find((a) => a.id === actionId);
      
      if (!action) continue;
      
      const logEntry: ExecutionLogEntry = {
        id: `exec_${Date.now()}_${actionId}`,
        timestamp: new Date().toISOString(),
        actionId: action.id,
        status: 'running',
        output: '',
      };
      
      const startTime = Date.now();
      
      try {
        // Update ledger
        await this.updateActionStatus(plan.planId, actionId, 'running');
        
        // Execute the script
        const result = await executeCommand(action.script);
        
        logEntry.output = result.output;
        logEntry.status = result.success ? 'completed' : 'failed';
        logEntry.error = result.error;
        logEntry.durationMs = Date.now() - startTime;
        
        // Update ledger
        await this.updateActionStatus(
          plan.planId,
          actionId,
          result.success ? 'completed' : 'failed'
        );
        
      } catch (error: any) {
        logEntry.status = 'failed';
        logEntry.error = error.message;
        logEntry.durationMs = Date.now() - startTime;
        
        await this.updateActionStatus(plan.planId, actionId, 'failed');
      }
      
      this.executionLogs.set(logEntry.id, logEntry);
      results.push(logEntry);
      
      // Small delay between actions
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    
    return results;
  }
  
  async rollbackLastPlan(): Promise<boolean> {
    const entries = await readLedger();
    
    if (entries.length === 0) {
      return false;
    }
    
    // Get the last entry
    const lastEntry = entries[entries.length - 1];
    
    // Reverse the actions array for rollback
    const reversedActions = [...lastEntry.actions].reverse();
    
    let allSuccessful = true;
    
    for (const action of reversedActions) {
      if (action.status !== 'completed') {
        continue; // Skip actions that weren't completed
      }
      
      try {
        const result = await executeCommand(action.rollbackScript);
        
        if (!result.success) {
          allSuccessful = false;
          console.error(`Rollback failed for action ${action.actionId}:`, result.error);
        }
        
        // Mark as rolled back in ledger
        await this.updateActionStatus(lastEntry.planId, action.actionId, 'rolled_back');
        
      } catch (error: any) {
        allSuccessful = false;
        console.error(`Rollback error for action ${action.actionId}:`, error.message);
      }
      
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    
    return allSuccessful;
  }
  
  getExecutionLogs(): ExecutionLogEntry[] {
    return Array.from(this.executionLogs.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
  
  clearExecutionLogs(): void {
    this.executionLogs.clear();
  }
  
  getCurrentPlan(): AIActionPlan | null {
    return this.currentPlan;
  }
  
  private async updateActionStatus(
    planId: string,
    actionId: string,
    status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back'
  ): Promise<void> {
    const entries = await readLedger();
    const entryIndex = entries.findIndex((e) => e.planId === planId);
    
    if (entryIndex !== -1) {
      const actionIndex = entries[entryIndex].actions.findIndex((a) => a.actionId === actionId);
      
      if (actionIndex !== -1) {
        entries[entryIndex].actions[actionIndex].status = status;
        await writeLedger(entries);
      }
    }
  }
}

// Singleton instance
export const executor = new ShellExecutor();

// Default export
export default executor;
