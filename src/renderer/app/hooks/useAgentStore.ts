/**
 * KernelAI - Zustand Agent Store
 * Universal state machine for AI agent interactions, scans, and execution
 */

import { create } from 'zustand';import { 
  SystemSpecs, 
  DiskScanResult, 
  ChatMessage, 
  AIActionPlan, 
  ExecutionLogEntry, 
  SkillFile, 
  SkillCheckResult 
} from '../../../shared/types';

// ============================================================================
// Store State Interface
// ============================================================================

interface AgentStoreState {
  // System State
  specs: SystemSpecs | null;
  specsLoading: boolean;
  specsError: string | null;
  
  // Scan State
  scanData: DiskScanResult | null;
  scanLoading: boolean;
  scanError: string | null;
  
  // Chat State
  chatLogs: ChatMessage[];
  chatLoading: boolean;
  
  // Execution State
  executionOutputLog: ExecutionLogEntry[];
  executionRunning: boolean;
  currentPlan: AIActionPlan | null;
  
  // Skills State
  cachedSkills: Map<string, SkillFile>;
  
  // Actions
  actions: AgentStoreActions;
}

interface AgentStoreActions {
  // System Specs
  fetchSystemSpecs: () => Promise<void>;
  
  // Scanning
  executeScan: (driveLetter?: string) => Promise<void>;
  clearScanData: () => void;
  
  // Chat & AI
  submitAgentPrompt: (prompt: string) => Promise<void>;
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChatLogs: () => void;
  
  // Execution
  runOptimizationPlan: (plan: AIActionPlan) => Promise<void>;
  rollbackLastPlan: () => Promise<void>;
  appendExecutionLog: (log: ExecutionLogEntry) => void;
  clearExecutionLogs: () => void;
  
  // Skills
  checkAndLoadSkill: (context: string) => Promise<SkillFile | null>;
  saveSkillToCache: (skill: SkillFile) => void;
}

type AgentStore = AgentStoreState;

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function normalizePrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ');
}

function extractContextFromPrompt(prompt: string): string {
  // Extract key context words for skill matching
  const lowerPrompt = prompt.toLowerCase();
  const gameKeywords = [
    'rocket league', 'valorant', 'csgo', 'fortnite', 'minecraft',
    'cod', 'warzone', 'apex', 'overwatch', 'league of legends'
  ];
  
  for (const keyword of gameKeywords) {
    if (lowerPrompt.includes(keyword)) {
      return keyword.replace(/\s+/g, '_');
    }
  }
  
  // Default to generic optimization context
  return 'general_optimization';
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useAgentStore = create<AgentStore>((set, get) => ({
  // Initial State
  specs: null,
  specsLoading: false,
  specsError: null,
  
  scanData: null,
  scanLoading: false,
  scanError: null,
  
  chatLogs: [],
  chatLoading: false,
  
  executionOutputLog: [],
  executionRunning: false,
  currentPlan: null,
  
  cachedSkills: new Map(),
  
  // Actions Implementation
  actions: {
    fetchSystemSpecs: async () => {
      set({ specsLoading: true, specsError: null });
      
      try {
        const specs = await window.kernelAI.getSystemSpecs();
        set({ specs, specsLoading: false });
      } catch (error: any) {
        set({ 
          specsError: error.message || 'Failed to fetch system specs',
          specsLoading: false 
        });
      }
    },
    
    executeScan: async (driveLetter: string = 'C:') => {
      set({ scanLoading: true, scanError: null });
      
      try {
        const scanResult = await window.kernelAI.executeScan(driveLetter);
        set({ scanData: scanResult, scanLoading: false });
      } catch (error: any) {
        set({ 
          scanError: error.message || 'Failed to execute scan',
          scanLoading: false 
        });
      }
    },
    
    clearScanData: () => {
      set({ scanData: null, scanError: null });
    },
    
    submitAgentPrompt: async (prompt: string) => {
      const normalizedPrompt = normalizePrompt(prompt);
      const context = extractContextFromPrompt(normalizedPrompt);
      
      // Add user message to chat
      get().actions.addChatMessage({
        role: 'user',
        content: normalizedPrompt,
      });
      
      set({ chatLoading: true });
      
      try {
        // Check for existing skill file
        const skillCheck: SkillCheckResult = await window.kernelAI.checkSkillFile(context);
        
        if (skillCheck.exists && skillCheck.skill) {
          // Use cached skill
          const skill = skillCheck.skill;
          
          get().actions.addChatMessage({
            role: 'assistant',
            content: `Found optimized profile for "${context}". Loading saved action plan...`,
            actionPlan: skill.actionPlan,
          });
          
          set({ 
            currentPlan: skill.actionPlan,
            chatLoading: false 
          });
          
          // Update skill usage
          skill.usageCount++;
          get().actions.saveSkillToCache(skill);
          
          return;
        }
        
        // No cached skill - call Gemini API via backend
        // Note: In a real implementation, this would call a backend endpoint
        // that uses the @google/genai SDK
        
        const aiResponse = await callGeminiAPI(normalizedPrompt, get());
        
        if (aiResponse.actionPlan) {
          // Save the new skill
          const savedSkill = await window.kernelAI.saveSkillFile(
            context,
            aiResponse.actionPlan
          );
          
          get().actions.saveSkillToCache(savedSkill);
          
          get().actions.addChatMessage({
            role: 'assistant',
            content: aiResponse.content,
            actionPlan: aiResponse.actionPlan,
          });
          
          set({ 
            currentPlan: aiResponse.actionPlan,
            chatLoading: false 
          });
        } else {
          get().actions.addChatMessage({
            role: 'assistant',
            content: aiResponse.content,
          });
          
          set({ chatLoading: false });
        }
        
      } catch (error: any) {
        get().actions.addChatMessage({
          role: 'assistant',
          content: 'An error occurred while processing your request.',
          error: error.message,
        });
        
        set({ chatLoading: false });
      }
    },
    
    addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      const newMessage: ChatMessage = {
        ...message,
        id: generateId(),
        timestamp: new Date().toISOString(),
      };
      
      set((state) => ({
        chatLogs: [...state.chatLogs, newMessage],
      }));
    },
    
    clearChatLogs: () => {
      set({ chatLogs: [] });
    },
    
    runOptimizationPlan: async (plan: AIActionPlan) => {
      set({ executionRunning: true, currentPlan: plan });
      
      // Add system message
      get().actions.addChatMessage({
        role: 'system',
        content: `Starting optimization plan: ${plan.summary}`,
      });
      
      try {
        const results = await window.kernelAI.runOptimizationPlan(plan);
        
        // Append all execution logs
        results.forEach((log) => {
          get().actions.appendExecutionLog(log);
        });
        
        // Add completion message
        const successCount = results.filter((r) => r.status === 'completed').length;
        const failCount = results.filter((r) => r.status === 'failed').length;
        
        get().actions.addChatMessage({
          role: 'system',
          content: `Optimization complete: ${successCount} succeeded, ${failCount} failed.`,
        });
        
      } catch (error: any) {
        get().actions.addChatMessage({
          role: 'system',
          content: `Optimization failed: ${error.message}`,
          error: error.message,
        });
      } finally {
        set({ executionRunning: false });
      }
    },
    
    rollbackLastPlan: async () => {
      set({ executionRunning: true });
      
      try {
        const success = await window.kernelAI.rollbackLastPlan();
        
        get().actions.addChatMessage({
          role: 'system',
          content: success 
            ? 'Rollback completed successfully. System restored to previous state.' 
            : 'Rollback failed or no plans found to rollback.',
        });
        
      } catch (error: any) {
        get().actions.addChatMessage({
          role: 'system',
          content: `Rollback error: ${error.message}`,
          error: error.message,
        });
      } finally {
        set({ executionRunning: false });
      }
    },
    
    appendExecutionLog: (log: ExecutionLogEntry) => {
      set((state) => ({
        executionOutputLog: [...state.executionOutputLog, log],
      }));
    },
    
    clearExecutionLogs: () => {
      set({ executionOutputLog: [] });
    },
    
    checkAndLoadSkill: async (context: string): Promise<SkillFile | null> => {
      const result = await window.kernelAI.checkSkillFile(context);
      
      if (result.exists && result.skill) {
        get().actions.saveSkillToCache(result.skill);
        return result.skill;
      }
      
      return null;
    },
    
    saveSkillToCache: (skill: SkillFile) => {
      set((state) => {
        const newCache = new Map(state.cachedSkills);
        newCache.set(skill.context, skill);
        return { cachedSkills: newCache };
      });
    },
  },
}));

// ============================================================================
// Gemini API Call Helper
// ============================================================================

async function callGeminiAPI(
  prompt: string, 
  state: Partial<AgentStoreState>
): Promise<{ content: string; actionPlan?: AIActionPlan }> {
  // This is a placeholder for the actual Gemini API call
  // In production, this would be handled by a backend service
  
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      specs: state.specs,
      scanData: state.scanData,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to call Gemini API');
  }
  
  return response.json();
}

// ============================================================================
// Selectors
// ============================================================================

export const selectSpecs = (state: AgentStore) => state.specs;
export const selectScanData = (state: AgentStore) => state.scanData;
export const selectChatLogs = (state: AgentStore) => state.chatLogs;
export const selectExecutionLogs = (state: AgentStore) => state.executionOutputLog;
export const selectCurrentPlan = (state: AgentStore) => state.currentPlan;
export const selectIsExecuting = (state: AgentStore) => state.executionRunning;

export default useAgentStore;
