/**
 * KernelAI - Electron Main Process
 * Initializes the application window and IPC handlers
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { scanner } from './scanner';
import { executor } from './executor';
import { memoryManager } from './memory';
import { 
  DiskScanResult, 
  SystemSpecs, 
  AIActionPlan, 
  ExecutionLogEntry,
  SkillFile,
  SkillCheckResult 
} from '../shared/types';

// ============================================================================
// Window Management
// ============================================================================

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    show: false,
    backgroundColor: '#05070B',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
      sandbox: true,
      webSecurity: true,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
  });

  // Load the Next.js static export
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // In development, load from the dev server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the static files
    mainWindow.loadFile(join(__dirname, '../renderer/out/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// System Specs Collection
// ============================================================================

async function getSystemSpecs(): Promise<SystemSpecs> {
  const os = await import('os');
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  // CPU Info
  const cpus = os.cpus();
  const cpuInfo = cpus[0];
  
  // GPU Info (Windows-specific via PowerShell)
  let gpuInfo: any[] = [];
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(
        'Get-WmiObject Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json'
      );
      const gpuData = JSON.parse(stdout);
      gpuInfo = Array.isArray(gpuData) ? gpuData : [gpuData];
    }
  } catch (error) {
    console.error('Failed to get GPU info:', error);
  }

  // RAM Info
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  // Process Info (top consumers)
  const processes: any[] = [];
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(
        'Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 10 Id,Name,CPU,WorkingSet,Path | ConvertTo-Json'
      );
      const procData = JSON.parse(stdout);
      processes.push(...(Array.isArray(procData) ? procData : [procData]));
    }
  } catch (error) {
    console.error('Failed to get process info:', error);
  }

  return {
    cpu: {
      model: cpuInfo.model,
      cores: cpus.length,
      logicalProcessors: cpus.length,
      baseSpeedGHz: cpuInfo.speed / 1000,
      manufacturer: cpuInfo.model.split(' ')[0] || 'Unknown',
    },
    gpu: gpuInfo.map((g: any) => ({
      name: g.Name || 'Unknown GPU',
      vramGB: g.AdapterRAM ? Math.round(g.AdapterRAM / (1024 ** 3)) : 0,
      driverVersion: g.DriverVersion || 'Unknown',
      isDedicated: true,
    })),
    ram: {
      totalGB: Math.round(totalMem / (1024 ** 3)),
      availableGB: Math.round(freeMem / (1024 ** 3)),
      usedGB: Math.round((totalMem - freeMem) / (1024 ** 3)),
      speedMHz: 0, // Would need WMI query for accurate value
      type: 'DDR4', // Default assumption
    },
    osVersion: `${os.type()} ${os.release()}`,
    osBuild: os.arch(),
    activeProcesses: processes.map((p: any) => ({
      pid: p.Id,
      name: p.Name,
      cpuUsage: p.CPU || 0,
      memoryMB: Math.round(p.WorkingSet / (1024 * 1024)),
      path: p.Path || '',
    })),
    bootTime: new Date(Date.now() - os.uptime() * 1000).toISOString(),
    uptimeSeconds: os.uptime(),
    hostname: os.hostname(),
    username: os.userInfo().username,
  };
}

// ============================================================================
// IPC Handlers Registration
// ============================================================================

function registerIpcHandlers(): void {
  // System Specs
  ipcMain.handle('getSystemSpecs', async (): Promise<SystemSpecs> => {
    return getSystemSpecs();
  });

  // Disk Scanning
  ipcMain.handle(
    'executeScan',
    async (_event, driveLetter: string): Promise<DiskScanResult> => {
      return scanner.scan(driveLetter);
    }
  );

  // Optimization Plan Execution
  ipcMain.handle(
    'runOptimizationPlan',
    async (_event, plan: AIActionPlan): Promise<ExecutionLogEntry[]> => {
      const results = await executor.executePlan(plan);
      
      // Track optimization in profile
      await memoryManager.trackOptimization(plan.totalEstimatedFPSGain);
      
      return results;
    }
  );

  // Rollback
  ipcMain.handle('rollbackLastPlan', async (): Promise<boolean> => {
    return executor.rollbackLastPlan();
  });

  // Skill File Management
  ipcMain.handle(
    'saveSkillFile',
    async (_event, context: string, plan: AIActionPlan): Promise<SkillFile> => {
      return memoryManager.saveSkill(context, plan);
    }
  );

  ipcMain.handle(
    'checkSkillFile',
    async (_event, context: string): Promise<SkillCheckResult> => {
      return memoryManager.checkSkill(context);
    }
  );

  // Execution Logs
  ipcMain.handle('getExecutionLogs', async (): Promise<ExecutionLogEntry[]> => {
    return executor.getExecutionLogs();
  });

  ipcMain.handle('clearExecutionLogs', async (): Promise<void> => {
    executor.clearExecutionLogs();
  });
}

// ============================================================================
// Application Lifecycle
// ============================================================================

app.whenReady().then(async () => {
  // Initialize memory manager
  await memoryManager.initialize();
  
  // Register IPC handlers
  registerIpcHandlers();
  
  // Create main window
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Export for testing
export { mainWindow, getSystemSpecs };
