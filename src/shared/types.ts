/**
 * KernelAI - Unified Shared Type System
 * Strict TypeScript definitions for IPC, AI Plans, and System Data
 */

// ============================================================================
// Disk Scanning Types
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type FolderCategory = 
  | 'system'
  | 'application'
  | 'user_data'
  | 'temporary'
  | 'game_files'
  | 'logs'
  | 'cache'
  | 'downloads'
  | 'unknown';

export interface FlaggedFolder {
  path: string;
  sizeGB: number;
  fileCount: number;
  category: FolderCategory;
  riskLevel: RiskLevel;
  reasoning: string;
  lastModified?: string;
  isExpandable?: boolean;
}

export interface DiskScanResult {
  scanId: string;
  timestamp: string;
  totalScannedSizeGB: number;
  flaggedFolders: FlaggedFolder[];
  skippedPaths: string[];
  scanDurationMs: number;
  driveLetter: string;
}

// ============================================================================
// System Specifications Types
// ============================================================================

export interface CPUInfo {
  model: string;
  cores: number;
  logicalProcessors: number;
  baseSpeedGHz: number;
  currentSpeedGHz?: number;
  manufacturer: string;
}

export interface GPUInfo {
  name: string;
  vramGB: number;
  driverVersion: string;
  isDedicated: boolean;
  temperatureC?: number;
  utilizationPercent?: number;
}

export interface RAMInfo {
  totalGB: number;
  availableGB: number;
  usedGB: number;
  speedMHz: number;
  type: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpuUsage: number;
  memoryMB: number;
  path: string;
}

export interface SystemSpecs {
  cpu: CPUInfo;
  gpu: GPUInfo[];
  ram: RAMInfo;
  osVersion: string;
  osBuild: string;
  activeProcesses: ProcessInfo[];
  bootTime: string;
  uptimeSeconds: number;
  hostname: string;
  username: string;
}

// ============================================================================
// AI Action Plan Types
// ============================================================================

export type ActionType = 
  | 'disk_cleanup'
  | 'registry_optimize'
  | 'service_disable'
  | 'startup_optimize'
  | 'power_plan_adjust'
  | 'network_optimize'
  | 'game_optimize'
  | 'driver_update'
  | 'memory_optimize'
  | 'custom_script';

export interface AIActionItem {
  id: string;
  actionType: ActionType;
  title: string;
  description: string;
  script: string;
  rollbackScript: string;
  estimatedImpactScore: number;
  riskLevel: RiskLevel;
  requiresReboot: boolean;
  estimatedFPSGain?: number;
  estimatedStabilityChange?: number;
  targetPaths?: string[];
  targetServices?: string[];
  targetRegistryKeys?: string[];
}

export interface AIActionPlan {
  planId: string;
  generatedAt: string;
  prompt: string;
  summary: string;
  actions: AIActionItem[];
  totalEstimatedFPSGain: number;
  totalRiskScore: number;
  stabilityIndex: number;
  recommendedOrder: string[];
  warnings: string[];
  prerequisites: string[];
  estimatedExecutionTimeMinutes: number;
}

// ============================================================================
// Chat & Agent Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  actionPlan?: AIActionPlan;
  isLoading?: boolean;
  error?: string;
}

export interface ExecutionLogEntry {
  id: string;
  timestamp: string;
  actionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  output: string;
  error?: string;
  durationMs?: number;
}

// ============================================================================
// Skill File Types
// ============================================================================

export interface SkillFile {
  context: string;
  createdAt: string;
  updatedAt: string;
  actionPlan: AIActionPlan;
  usageCount: number;
  successRate: number;
  tags: string[];
}

export interface SkillCheckResult {
  exists: boolean;
  skill?: SkillFile;
  path?: string;
}

// ============================================================================
// IPC Bridge Interface
// ============================================================================

export interface IpcBridge {
  // System Information
  getSystemSpecs(): Promise<SystemSpecs>;
  
  // Disk Scanning
  executeScan(driveLetter: string): Promise<DiskScanResult>;
  
  // AI & Optimization
  runOptimizationPlan(plan: AIActionPlan): Promise<ExecutionLogEntry[]>;
  rollbackLastPlan(): Promise<boolean>;
  
  // Skill Management
  saveSkillFile(context: string, plan: AIActionPlan): Promise<SkillFile>;
  checkSkillFile(context: string): Promise<SkillCheckResult>;
  
  // Execution Logs
  getExecutionLogs(): Promise<ExecutionLogEntry[]>;
  clearExecutionLogs(): Promise<void>;
}

// ============================================================================
// Window API Extension
// ============================================================================

declare global {
  interface Window {
    kernelAI: IpcBridge;
  }
}

export {};
