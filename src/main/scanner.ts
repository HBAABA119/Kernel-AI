/**
 * KernelAI - High-Speed Directory Scanner
 * Implements Token Economy Math for optimized Gemini context windows
 */

import { promises as fs } from 'fs';
import { join, basename } from 'path';

import { DiskScanResult, FlaggedFolder, FolderCategory, RiskLevel } from '../shared/types';

// ============================================================================
// Configuration Constants
// ============================================================================

const SIZE_THRESHOLD_MB = 150; // Token Economy: Skip folders < 150MB
const MAX_RETURNED_FOLDERS = 45; // Optimize for Gemini's context window
const SIZE_THRESHOLD_BYTES = SIZE_THRESHOLD_MB * 1024 * 1024;

// OS Safety Blacklist - Never scan these paths
const WINDOWS_BLACKLIST = [
  'C:\\Windows',
  'C:\\Windows\\System32',
  'C:\\Windows\\SysWOW64',
  'C:\\Windows\\WinSxS',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
  'System Volume Information',
  '$Recycle.Bin',
  'Recovery',
  'Config.Msi',
  'Documents and Settings',
  'MSOCache',
  'Intel',
  'AMD',
  'NVIDIA Corporation',
];

const LINUX_BLACKLIST = [
  '/bin',
  '/boot',
  '/dev',
  '/etc',
  '/lib',
  '/lib64',
  '/proc',
  '/sys',
  '/usr/bin',
  '/usr/lib',
  '/usr/sbin',
];

const MACOS_BLACKLIST = [
  '/System',
  '/Library',
  '/Applications',
  '/usr/bin',
  '/usr/lib',
  '/usr/sbin',
];

// Category detection patterns
const CATEGORY_PATTERNS: Record<string, FolderCategory> = {
  'temp': 'temporary',
  'tmp': 'temporary',
  'cache': 'cache',
  'logs': 'logs',
  'log': 'logs',
  'downloads': 'downloads',
  'download': 'downloads',
  'game': 'game_files',
  'games': 'game_files',
  'steam': 'game_files',
  'epic': 'game_files',
  'origin': 'game_files',
  'ubisoft': 'game_files',
  'appdata': 'application',
  'program': 'application',
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatBytes(bytes: number): number {
  return bytes / (1024 * 1024 * 1024);
}

function getRiskLevel(sizeGB: number, category: FolderCategory): RiskLevel {
  if (category === 'temporary' || category === 'cache' || category === 'logs') {
    if (sizeGB > 10) return 'high';
    if (sizeGB > 5) return 'medium';
    return 'low';
  }
  
  if (category === 'system') {
    if (sizeGB > 50) return 'critical';
    if (sizeGB > 20) return 'high';
    return 'medium';
  }
  
  if (sizeGB > 30) return 'high';
  if (sizeGB > 10) return 'medium';
  return 'low';
}

function categorizeFolder(path: string): FolderCategory {
  const lowerPath = path.toLowerCase();
  const folderName = basename(lowerPath);
  
  for (const [pattern, category] of Object.entries(CATEGORY_PATTERNS)) {
    if (lowerPath.includes(pattern) || folderName.includes(pattern)) {
      return category;
    }
  }
  
  if (lowerPath.includes('windows') || lowerPath.includes('system')) {
    return 'system';
  }
  
  if (lowerPath.includes('user') || lowerPath.includes('documents')) {
    return 'user_data';
  }
  
  return 'unknown';
}

function generateReasoning(folder: FlaggedFolder): string {
  const reasons: string[] = [];
  
  if (folder.category === 'temporary' || folder.category === 'cache') {
    reasons.push(`Contains ${folder.fileCount} temporary/cache files`);
    reasons.push('Safe to clean with proper tools');
  }
  
  if (folder.category === 'logs') {
    reasons.push(`Accumulated log files totaling ${folder.sizeGB.toFixed(2)}GB`);
    reasons.push('Consider implementing log rotation');
  }
  
  if (folder.category === 'game_files') {
    reasons.push('Large game installation or assets');
    reasons.push('Verify before removal - may affect game functionality');
  }
  
  if (folder.riskLevel === 'high' || folder.riskLevel === 'critical') {
    reasons.push('Requires careful analysis before action');
    reasons.push('May contain critical system or application data');
  }
  
  if (folder.sizeGB > 20) {
    reasons.push(`Significant storage consumer at ${folder.sizeGB.toFixed(2)}GB`);
  }
  
  return reasons.join('. ') + '.';
}

function isBlacklisted(path: string, platform: string): boolean {
  let blacklist: string[] = [];
  
  switch (platform) {
    case 'win32':
      blacklist = WINDOWS_BLACKLIST;
      break;
    case 'linux':
      blacklist = LINUX_BLACKLIST;
      break;
    case 'darwin':
      blacklist = MACOS_BLACKLIST;
      break;
    default:
      blacklist = WINDOWS_BLACKLIST;
  }
  
  const normalizedPath = path.replace(/\\/g, '/').toLowerCase();
  
  for (const blacklisted of blacklist) {
    const normalizedBlacklist = blacklisted.replace(/\\/g, '/').toLowerCase();
    if (normalizedPath.startsWith(normalizedBlacklist) || 
        normalizedPath.includes(normalizedBlacklist)) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// Directory Scanner Class
// ============================================================================

export class DirectoryScanner {
  private scannedCount: number = 0;
  private skippedCount: number = 0;
  private flaggedFolders: Map<string, FlaggedFolder> = new Map();
  
  async scan(driveLetter: string = 'C:'): Promise<DiskScanResult> {
    const startTime = Date.now();
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const platform = process.platform;
    
    this.scannedCount = 0;
    this.skippedCount = 0;
    this.flaggedFolders.clear();
    
    const rootPath = platform === 'win32' ? `${driveLetter}\\` : '/';
    const skippedPaths: string[] = [];
    
    try {
      await this.scanDirectory(rootPath, rootPath, platform, skippedPaths);
    } catch (error) {
      console.error('Scan error:', error);
    }
    
    // Sort by size and take top N folders (Token Economy)
    const sortedFolders = Array.from(this.flaggedFolders.values())
      .sort((a, b) => b.sizeGB - a.sizeGB)
      .slice(0, MAX_RETURNED_FOLDERS);
    
    const totalSize = sortedFolders.reduce((sum, f) => sum + f.sizeGB, 0);
    
    return {
      scanId,
      timestamp: new Date().toISOString(),
      totalScannedSizeGB: parseFloat(totalSize.toFixed(3)),
      flaggedFolders: sortedFolders,
      skippedPaths,
      scanDurationMs: Date.now() - startTime,
      driveLetter,
    };
  }
  
  private async scanDirectory(
    currentPath: string,
    rootPath: string,
    platform: string,
    skippedPaths: string[]
  ): Promise<{ size: number; fileCount: number }> {
    // Check blacklist
    if (isBlacklisted(currentPath, platform)) {
      skippedPaths.push(currentPath);
      this.skippedCount++;
      return { size: 0, fileCount: 0 };
    }
    
    let totalSize = 0;
    let totalFiles = 0;
    
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        
        try {
          if (entry.isDirectory()) {
            // Skip hidden directories and symlinks
            if (entry.name.startsWith('.') || entry.isSymbolicLink()) {
              continue;
            }
            
            const result = await this.scanDirectory(fullPath, rootPath, platform, skippedPaths);
            totalSize += result.size;
            totalFiles += result.fileCount;
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
            totalFiles++;
          }
        } catch (err) {
          // Skip inaccessible files/directories
          continue;
        }
      }
      
      // Token Economy: Only flag folders above threshold
      if (totalSize >= SIZE_THRESHOLD_BYTES) {

        const category = categorizeFolder(currentPath);
        const sizeGB = formatBytes(totalSize);
        const riskLevel = getRiskLevel(sizeGB, category);
        
        const flaggedFolder: FlaggedFolder = {
          path: currentPath,
          sizeGB: parseFloat(sizeGB.toFixed(3)),
          fileCount: totalFiles,
          category,
          riskLevel,
          reasoning: '',
          lastModified: new Date().toISOString(),
          isExpandable: totalFiles > 100,
        };
        
        flaggedFolder.reasoning = generateReasoning(flaggedFolder);
        this.flaggedFolders.set(currentPath, flaggedFolder);
      }
      
      this.scannedCount++;
      
    } catch (error) {
      // Permission denied or other errors - skip silently
      skippedPaths.push(currentPath);
    }
    
    return { size: totalSize, fileCount: totalFiles };
  }
  
  getStats(): { scanned: number; skipped: number; flagged: number } {
    return {
      scanned: this.scannedCount,
      skipped: this.skippedCount,
      flagged: this.flaggedFolders.size,
    };
  }
}

// Singleton instance
export const scanner = new DirectoryScanner();

// Default export for module usage
export default scanner;
