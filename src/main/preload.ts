/**
 * KernelAI - Electron Preload Script
 * Securely exposes IPC methods to the renderer process via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';
import { 
  DiskScanResult, 
  SystemSpecs, 
  AIActionPlan, 
  ExecutionLogEntry,
  SkillFile,
  SkillCheckResult,
  IpcBridge 
} from '../shared/types';

// ============================================================================
// Type-safe IPC Bridge Implementation
// ============================================================================

const kernelAIBridge: IpcBridge = {
  // System Information
  async getSystemSpecs(): Promise<SystemSpecs> {
    return ipcRenderer.invoke('getSystemSpecs');
  },

  // Disk Scanning
  async executeScan(driveLetter: string): Promise<DiskScanResult> {
    return ipcRenderer.invoke('executeScan', driveLetter);
  },

  // AI & Optimization
  async runOptimizationPlan(plan: AIActionPlan): Promise<ExecutionLogEntry[]> {
    return ipcRenderer.invoke('runOptimizationPlan', plan);
  },

  async rollbackLastPlan(): Promise<boolean> {
    return ipcRenderer.invoke('rollbackLastPlan');
  },

  // Skill Management
  async saveSkillFile(context: string, plan: AIActionPlan): Promise<SkillFile> {
    return ipcRenderer.invoke('saveSkillFile', context, plan);
  },

  async checkSkillFile(context: string): Promise<SkillCheckResult> {
    return ipcRenderer.invoke('checkSkillFile', context);
  },

  // Execution Logs
  async getExecutionLogs(): Promise<ExecutionLogEntry[]> {
    return ipcRenderer.invoke('getExecutionLogs');
  },

  async clearExecutionLogs(): Promise<void> {
    return ipcRenderer.invoke('clearExecutionLogs');
  },
};

// ============================================================================
// Expose to Renderer Process
// ============================================================================

contextBridge.exposeInMainWorld('kernelAI', kernelAIBridge);

// ============================================================================
// Console logging for development
// ============================================================================

console.log('[KernelAI] Preload script loaded - IPC bridge exposed');
