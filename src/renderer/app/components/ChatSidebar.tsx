/**
 * KernelAI - Chat Sidebar Component
 * Premium dark-themed streaming chat layout with AI action plan rendering
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AIActionPlan, RiskLevel, AIActionItem } from '../../../shared/types';

// ============================================================================
// Configuration & Constants
// ============================================================================

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  medium: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  high: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  critical: 'bg-red-600/20 text-red-400 border-red-600/30',
};

const ACTION_TYPE_ICONS: Record<string, string> = {
  disk_cleanup: '🗑️',
  registry_optimize: '⚙️',
  service_disable: '🛑',
  startup_optimize: '🚀',
  power_plan_adjust: '⚡',
  network_optimize: '🌐',
  game_optimize: '🎮',
  driver_update: '📦',
  memory_optimize: '💾',
  custom_script: '📜',
};

// ============================================================================
// Types
// ============================================================================

interface ChatSidebarProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onDeployPlan: (plan: AIActionPlan) => void;
  onRollback: () => void;
  className?: string;
}

// ============================================================================
// Sub-Components
// ============================================================================

const RiskBadge: React.FC<{ riskLevel: RiskLevel }> = ({ riskLevel }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${RISK_COLORS[riskLevel]}`}
  >
    {riskLevel.toUpperCase()}
  </span>
);

const ActionItemCard: React.FC<{
  action: AIActionItem;
  index: number;
}> = ({ action, index }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-lg">{ACTION_TYPE_ICONS[action.actionType] || '🔧'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-white truncate">
              {action.title}
            </h4>
            <RiskBadge riskLevel={action.riskLevel} />
          </div>
          <p className="text-xs text-white/60 truncate">{action.description}</p>
        </div>
        <div className="flex items-center gap-3">
          {action.estimatedFPSGain && (
            <span className="text-xs text-emerald-400 font-medium">
              +{action.estimatedFPSGain} FPS
            </span>
          )}
          <svg
            className={`w-4 h-4 text-white/40 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {expanded && (
        <div className="px-3 pb-3 border-t border-white/10 pt-3">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-black/30 rounded p-2">
              <div className="text-xs text-white/50">Impact Score</div>
              <div className="text-sm font-medium text-white">
                {(action.estimatedImpactScore * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-black/30 rounded p-2">
              <div className="text-xs text-white/50">Requires Reboot</div>
              <div className="text-sm font-medium text-white">
                {action.requiresReboot ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
          
          <div className="text-xs text-white/70 mb-2">Script Preview:</div>
          <pre className="bg-black/50 rounded p-2 text-xs text-white/80 overflow-x-auto max-h-32 overflow-y-auto font-mono">
            {action.script}
          </pre>
          
          {action.targetPaths && action.targetPaths.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-white/50 mb-1">Target Paths:</div>
              <div className="flex flex-wrap gap-1">
                {action.targetPaths.map((path, i) => (
                  <span key={i} className="text-xs bg-white/10 px-2 py-0.5 rounded text-white/70">
                    {path.split('\\').pop()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ActionPlanCard: React.FC<{
  plan: AIActionPlan;
  onDeploy: () => void;
  onRollback: () => void;
}> = ({ plan, onDeploy, onRollback }) => {
  const [deploying, setDeploying] = useState(false);
  
  const handleDeploy = async () => {
    setDeploying(true);
    await onDeploy();
    setDeploying(false);
  };
  
  // Calculate stability color
  const stabilityColor =
    plan.stabilityIndex >= 0.8
      ? 'text-emerald-400'
      : plan.stabilityIndex >= 0.5
      ? 'text-yellow-400'
      : 'text-rose-400';
  
  return (
    <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 rounded-xl border border-indigo-500/30 overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-900/50 px-4 py-3 border-b border-indigo-500/30">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">
            🎯 AI Optimization Plan
          </h3>
          <span className="text-xs text-white/50">
            {new Date(plan.generatedAt).toLocaleTimeString()}
          </span>
        </div>
      </div>
      
      {/* Summary */}
      <div className="p-4">
        <p className="text-sm text-white/80 mb-4">{plan.summary}</p>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-black/40 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">
              +{plan.totalEstimatedFPSGain}
            </div>
            <div className="text-xs text-white/50">Est. FPS Gain</div>
          </div>
          <div className="bg-black/40 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold ${stabilityColor}`}>
              {(plan.stabilityIndex * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-white/50">Stability Index</div>
          </div>
          <div className="bg-black/40 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-indigo-400">
              {plan.actions.length}
            </div>
            <div className="text-xs text-white/50">Actions</div>
          </div>
        </div>
        
        {/* Warnings */}
        {plan.warnings.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <span className="text-amber-400">⚠️</span>
              <div>
                <div className="text-xs font-medium text-amber-400 mb-1">Warnings</div>
                <ul className="text-xs text-amber-200/80 space-y-1">
                  {plan.warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Prerequisites */}
        {plan.prerequisites.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <span className="text-blue-400">📋</span>
              <div>
                <div className="text-xs font-medium text-blue-400 mb-1">Prerequisites</div>
                <ul className="text-xs text-blue-200/80 space-y-1">
                  {plan.prerequisites.map((prereq, i) => (
                    <li key={i}>• {prereq}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {/* Actions Checklist */}
        <div className="mb-4">
          <div className="text-xs font-medium text-white/70 mb-2">
            Execution Checklist ({plan.actions.length} items)
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            {plan.actions.map((action, index) => (
              <ActionItemCard key={action.id} action={action} index={index} />
            ))}
          </div>
        </div>
        
        {/* Estimated Time */}
        <div className="flex items-center justify-between text-xs text-white/50 mb-4">
          <span>Est. Execution Time:</span>
          <span className="text-white/80">{plan.estimatedExecutionTimeMinutes} minutes</span>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            {deploying ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Deploying...
              </>
            ) : (
              <>
                <span>🚀</span>
                DEPLOY PLAN
              </>
            )}
          </button>
          
          <button
            onClick={onRollback}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors border border-white/20"
          >
            ↩️ Rollback
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatBubble: React.FC<{
  message: ChatMessage;
  onDeployPlan: (plan: AIActionPlan) => void;
  onRollback: () => void;
}> = ({ message, onDeployPlan, onRollback }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-indigo-600 text-white'
            : isSystem
            ? 'bg-white/10 text-white/90 border border-white/20'
            : 'bg-white/5 text-white/90 border border-white/10'
        }`}
      >
        {message.error && (
          <div className="text-rose-400 text-sm mb-2 flex items-center gap-2">
            <span>❌</span>
            {message.error}
          </div>
        )}
        
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        
        {message.actionPlan && (
          <div className="mt-3">
            <ActionPlanCard
              plan={message.actionPlan}
              onDeploy={() => onDeployPlan(message.actionPlan!)}
              onRollback={onRollback}
            />
          </div>
        )}
        
        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-indigo-200' : 'text-white/40'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

const TypingIndicator: React.FC = () => (
  <div className="flex justify-start mb-4">
    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-xs text-white/50">AI is thinking...</span>
      </div>
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  messages,
  isLoading,
  onDeployPlan,
  onRollback,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);
  
  return (
    <div
      className={`flex flex-col h-full bg-gradient-to-b from-gray-900/50 to-black/50 backdrop-blur-xl border-l border-white/10 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-white text-sm">🤖</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">KernelAI Agent</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-white/50">Online</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-white/40">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <span className="text-3xl">💬</span>
            </div>
            <p className="text-sm mb-2">Start a conversation with KernelAI</p>
            <p className="text-xs">Ask for optimization recommendations or system analysis</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} onDeployPlan={onDeployPlan} onRollback={onRollback} />
            ))}
            {isLoading && <TypingIndicator />}
          </>
        )}
      </div>
      
      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inputValue.trim()) {
              // Handle submit via parent
              const event = new CustomEvent('send-message', { detail: inputValue });
              window.dispatchEvent(event);
              setInputValue('');
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask KernelAI to optimize your system..."
            className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 text-white px-4 py-2.5 rounded-xl transition-colors disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatSidebar;
