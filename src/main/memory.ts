/**
 * KernelAI - Persistent Local Management Layer
 * Handles .skill file compilation and user profile management
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { SkillFile, SkillCheckResult, AIActionPlan } from '../shared/types';

// ============================================================================
// Configuration & Constants
// ============================================================================

const SKILLS_DIR = 'skills';
const PROFILE_FILE = 'user_profile.json';
const SETTINGS_FILE = 'settings.json';

// ============================================================================
// Types
// ============================================================================

interface UserProfile {
  userId: string;
  createdAt: string;
  lastActiveAt: string;
  optimizationCount: number;
  totalFPSGain: number;
  preferredSettings: Record<string, any>;
}

interface AppSettings {
  theme: 'dark' | 'light';
  autoCreateRestorePoints: boolean;
  enableNotifications: boolean;
  apiEndpoint?: string;
  geminiApiKey?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getKernelAIDir(): string {
  const appData = app.getPath('appData');
  return join(appData, 'KernelAI');
}

function getSkillsDir(): string {
  return join(getKernelAIDir(), SKILLS_DIR);
}

function getProfilePath(): string {
  return join(getKernelAIDir(), PROFILE_FILE);
}

function getSettingsPath(): string {
  return join(getKernelAIDir(), SETTINGS_FILE);
}

function sanitizeContext(context: string): string {
  // Remove invalid filename characters
  return context
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase()
    .substring(0, 50);
}

async function ensureDirectories(): Promise<void> {
  const kernelAIDir = getKernelAIDir();
  const skillsDir = getSkillsDir();
  
  await fs.mkdir(kernelAIDir, { recursive: true });
  await fs.mkdir(skillsDir, { recursive: true });
}

// ============================================================================
// Profile Management
// ============================================================================

async function getOrCreateProfile(): Promise<UserProfile> {
  await ensureDirectories();
  const profilePath = getProfilePath();
  
  try {
    const content = await fs.readFile(profilePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // Create new profile
    const newProfile: UserProfile = {
      userId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      optimizationCount: 0,
      totalFPSGain: 0,
      preferredSettings: {},
    };
    
    await fs.writeFile(profilePath, JSON.stringify(newProfile, null, 2), 'utf-8');
    return newProfile;
  }
}

async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const profile = await getOrCreateProfile();
  const updatedProfile = { ...profile, ...updates };
  
  if (updates.lastActiveAt === undefined) {
    updatedProfile.lastActiveAt = new Date().toISOString();
  }
  
  await fs.writeFile(getProfilePath(), JSON.stringify(updatedProfile, null, 2), 'utf-8');
  return updatedProfile;
}

async function incrementOptimizationCount(fpsGain: number = 0): Promise<UserProfile> {
  const profile = await getOrCreateProfile();
  return updateProfile({
    optimizationCount: profile.optimizationCount + 1,
    totalFPSGain: profile.totalFPSGain + fpsGain,
  });
}

// ============================================================================
// Settings Management
// ============================================================================

async function getSettings(): Promise<AppSettings> {
  await ensureDirectories();
  const settingsPath = getSettingsPath();
  
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // Create default settings
    const defaultSettings: AppSettings = {
      theme: 'dark',
      autoCreateRestorePoints: true,
      enableNotifications: true,
    };
    
    await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf-8');
    return defaultSettings;
  }
}

async function updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const settings = await getSettings();
  const updatedSettings = { ...settings, ...updates };
  
  await fs.writeFile(getSettingsPath(), JSON.stringify(updatedSettings, null, 2), 'utf-8');
  return updatedSettings;
}

// ============================================================================
// Skill File Management
// ============================================================================

function getSkillFilePath(context: string): string {
  const sanitized = sanitizeContext(context);
  return join(getSkillsDir(), `${sanitized}.skill`);
}

async function saveSkillFile(context: string, plan: AIActionPlan): Promise<SkillFile> {
  await ensureDirectories();
  
  const skillFilePath = getSkillFilePath(context);
  
  const now = new Date().toISOString();
  
  const skillFile: SkillFile = {
    context,
    createdAt: now,
    updatedAt: now,
    actionPlan: plan,
    usageCount: 0,
    successRate: 1.0, // Default to 100% until we have usage data
    tags: extractTagsFromPlan(plan),
  };
  
  await fs.writeFile(skillFilePath, JSON.stringify(skillFile, null, 2), 'utf-8');
  
  return skillFile;
}

async function checkSkillFile(context: string): Promise<SkillCheckResult> {
  const skillFilePath = getSkillFilePath(context);
  
  try {
    await fs.access(skillFilePath);
    const content = await fs.readFile(skillFilePath, 'utf-8');
    const skill: SkillFile = JSON.parse(content);
    
    return {
      exists: true,
      skill,
      path: skillFilePath,
    };
  } catch (error) {
    return {
      exists: false,
    };
  }
}

async function loadSkillFile(context: string): Promise<SkillFile | null> {
  const result = await checkSkillFile(context);
  return result.skill || null;
}

async function updateSkillUsage(context: string, success: boolean): Promise<SkillFile | null> {
  const result = await checkSkillFile(context);
  
  if (!result.exists || !result.skill) {
    return null;
  }
  
  const skill = result.skill;
  skill.usageCount++;
  skill.updatedAt = new Date().toISOString();
  
  // Update success rate with exponential moving average
  const alpha = 0.1; // Weight for new data
  const newSuccessValue = success ? 1 : 0;
  skill.successRate = (1 - alpha) * skill.successRate + alpha * newSuccessValue;
  
  await fs.writeFile(result.path!, JSON.stringify(skill, null, 2), 'utf-8');
  
  return skill;
}

async function listAllSkills(): Promise<SkillFile[]> {
  await ensureDirectories();
  const skillsDir = getSkillsDir();
  
  try {
    const files = await fs.readdir(skillsDir);
    const skillFiles = files.filter((f) => f.endsWith('.skill'));
    
    const skills: SkillFile[] = [];
    
    for (const file of skillFiles) {
      try {
        const content = await fs.readFile(join(skillsDir, file), 'utf-8');
        skills.push(JSON.parse(content));
      } catch (error) {
        // Skip corrupted files
        continue;
      }
    }
    
    return skills.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (error) {
    return [];
  }
}

async function deleteSkillFile(context: string): Promise<boolean> {
  const result = await checkSkillFile(context);
  
  if (!result.exists || !result.path) {
    return false;
  }
  
  try {
    await fs.unlink(result.path);
    return true;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractTagsFromPlan(plan: AIActionPlan): string[] {
  const tags = new Set<string>();
  
  // Extract tags from action types
  for (const action of plan.actions) {
    tags.add(action.actionType);
  }
  
  // Extract tags from summary keywords
  const keywords = plan.summary.toLowerCase().split(/\s+/);
  const relevantKeywords = keywords.filter((word) => 
    word.length > 4 && 
    !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'been'].includes(word)
  );
  
  relevantKeywords.forEach((word) => tags.add(word));
  
  // Add performance-related tags
  if (plan.totalEstimatedFPSGain > 0) {
    tags.add('performance');
    tags.add('fps_boost');
  }
  
  if (plan.stabilityIndex > 0.8) {
    tags.add('stable');
  }
  
  return Array.from(tags).slice(0, 20); // Limit to 20 tags
}

// ============================================================================
// Memory Manager Class
// ============================================================================

export class MemoryManager {
  async initialize(): Promise<void> {
    await ensureDirectories();
    await getOrCreateProfile();
    await getSettings();
  }
  
  async getProfile(): Promise<UserProfile> {
    return getOrCreateProfile();
  }
  
  async updateProfileData(updates: Partial<UserProfile>): Promise<UserProfile> {
    return updateProfile(updates);
  }
  
  async getSettingsData(): Promise<AppSettings> {
    return getSettings();
  }
  
  async updateSettingsData(updates: Partial<AppSettings>): Promise<AppSettings> {
    return updateSettings(updates);
  }
  
  async saveSkill(context: string, plan: AIActionPlan): Promise<SkillFile> {
    return saveSkillFile(context, plan);
  }
  
  async checkSkill(context: string): Promise<SkillCheckResult> {
    return checkSkillFile(context);
  }
  
  async loadSkill(context: string): Promise<SkillFile | null> {
    return loadSkillFile(context);
  }
  
  async recordSkillUsage(context: string, success: boolean): Promise<SkillFile | null> {
    return updateSkillUsage(context, success);
  }
  
  async getAllSkills(): Promise<SkillFile[]> {
    return listAllSkills();
  }
  
  async removeSkill(context: string): Promise<boolean> {
    return deleteSkillFile(context);
  }
  
  async trackOptimization(fpsGain: number = 0): Promise<UserProfile> {
    return incrementOptimizationCount(fpsGain);
  }
}

// Singleton instance
export const memoryManager = new MemoryManager();

// Default export
export default memoryManager;
