/**
 * KernelAI - Main Application Page
 * Master desktop app layout with hardware specs, treemap, and terminal
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Treemap } from './components/Treemap';
import { ChatSidebar } from './components/ChatSidebar';
import { useAgentStore, selectSpecs, selectScanData, selectChatLogs, selectExecutionLogs, selectCurrentPlan, selectIsExecuting } from './hooks/useAgentStore';
import { FlaggedFolder, AIActionPlan, ExecutionLogEntry } from '../../shared/types';

// ============================================================================
// Types
// ============================================================================

interface TerminalLine {
  id: string;
  timestamp: string;
  content: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'command';
}

// ============================================================================
// Sub-Components
// ============================================================================

const HardwareSpecStrip: React.FC = () => {
  const specs = useAgentStore(selectSpecs);
  
  if (!specs) {
    return (
      <div className="h-16 bg-gradient-to-r from-gray-900/80 to-black/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-center">
        <div className="flex items-center gap-2 text-white/40">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading system information...</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-16 bg-gradient-to-r from-gray-900/80 to-black/80 backdrop-blur-xl border-b border-white/10 flex items-center px-6 gap-8">
      {/* CPU */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
          <span className="text-white text-sm">🖥️</span>
        </div>
        <div>
          <div className="text-xs text-white/50">CPU</div>
          <div className="text-sm font-medium text-white truncate max-w-[200px]">
            {specs.cpu.model}
          </div>
        </div>
      </div>
      
      {/* GPU */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center">
          <span className="text-white text-sm">🎮</span>
        </div>
        <div>
          <div className="text-xs text-white/50">GPU</div>
          <div className="text-sm font-medium text-white truncate max-w-[200px]">
            {specs.gpu[0]?.name || 'Unknown'}
          </div>
        </div>
      </div>
      
      {/* RAM */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center">
          <span className="text-white text-sm">💾</span>
        </div>
        <div>
          <div className="text-xs text-white/50">RAM</div>
          <div className="text-sm font-medium text-white">
            {specs.ram.usedGB} / {specs.ram.totalGB} GB
          </div>
        </div>
      </div>
      
      {/* OS */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center">
          <span className="text-white text-sm">🪟</span>
        </div>
        <div>
          <div className="text-xs text-white/50">OS</div>
          <div className="text-sm font-medium text-white">
            {specs.osVersion}
          </div>
        </div>
      </div>
      
      {/* Uptime */}
      <div className="ml-auto flex items-center gap-2 text-white/40">
        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        <span className="text-xs">
          Uptime: {Math.floor(specs.uptimeSeconds / 3600)}h {Math.floor((specs.uptimeSeconds % 3600) / 60)}m
        </span>
      </div>
    </div>
  );
};

const TerminalPanel: React.FC<{ logs: ExecutionLogEntry[] }> = ({ logs }) => {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  
  useEffect(() => {
    const newLines: TerminalLine[] = logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      content: log.output || log.error || '',
      type: log.status === 'completed' ? 'success' : 
            log.status === 'failed' ? 'error' : 
            log.status === 'running' ? 'command' : 'info',
    }));
    
    setLines(newLines.slice(-100)); // Keep last 100 lines
  }, [logs]);
  
  const getLineColor = (type: TerminalLine['type']): string => {
    switch (type) {
      case 'success': return 'text-emerald-400';
      case 'error': return 'text-rose-400';
      case 'warning': return 'text-amber-400';
      case 'command': return 'text-indigo-400';
      default: return 'text-white/70';
    }
  };
  
  return (
    <div className="h-full bg-black/80 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs text-white/50 ml-2">Execution Terminal</span>
        </div>
        <div className="text-xs text-white/40">{lines.length} entries</div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {lines.length === 0 ? (
          <div className="text-white/30 italic">No execution logs yet. Run an optimization plan to see output here.</div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="mb-2">
              <span className="text-white/30 mr-2">
                [{new Date(line.timestamp).toLocaleTimeString()}]
              </span>
              <span className={getLineColor(line.type)}>
                {line.content}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ScanControls: React.FC<{
  onScan: () => void;
  isScanning: boolean;
  scanData: any;
}> = ({ onScan, isScanning, scanData }) => {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onScan}
        disabled={isScanning}
        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-500 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm"
      >
        {isScanning ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Scanning...
          </>
        ) : (
          <>
            <span>🔍</span>
            Run Storage Scan
          </>
        )}
      </button>
      
      {scanData && (
        <div className="text-xs text-white/50">
          Last scan: {new Date(scanData.timestamp).toLocaleTimeString()} • 
          {scanData.flaggedFolders.length} folders analyzed
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Page Component
// ============================================================================

export default function KernelAIPage() {
  const [treemapSize, setTreemapSize] = useState({ width: 800, height: 500 });
  const treemapRef = React.useRef<HTMLDivElement>(null);
  
  const { actions } = useAgentStore();
  const specs = useAgentStore(selectSpecs);
  const scanData = useAgentStore(selectScanData);
  const chatLogs = useAgentStore(selectChatLogs);
  const executionLogs = useAgentStore(selectExecutionLogs);
  const currentPlan = useAgentStore(selectCurrentPlan);
  const isExecuting = useAgentStore(selectIsExecuting);
  
  const [isScanning, setIsScanning] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FlaggedFolder | null>(null);
  
  // Initialize: Fetch system specs and run initial scan
  useEffect(() => {
    actions.fetchSystemSpecs();
    actions.executeScan('C:');
  }, []);
  
  // Handle treemap resize
  useEffect(() => {
    const updateSize = () => {
      if (treemapRef.current) {
        const rect = treemapRef.current.getBoundingClientRect();
        setTreemapSize({
          width: rect.width,
          height: rect.height,
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  // Handle scan
  const handleScan = useCallback(async () => {
    setIsScanning(true);
    await actions.executeScan('C:');
    setIsScanning(false);
  }, [actions]);
  
  // Handle deploy plan
  const handleDeployPlan = useCallback(async (plan: AIActionPlan) => {
    await actions.runOptimizationPlan(plan);
  }, [actions]);
  
  // Handle rollback
  const handleRollback = useCallback(async () => {
    await actions.rollbackLastPlan();
  }, [actions]);
  
  // Handle message send from chat
  useEffect(() => {
    const handleMessage = (event: CustomEvent<string>) => {
      actions.submitAgentPrompt(event.detail);
    };
    
    window.addEventListener('send-message' as any, handleMessage as any);
    return () => window.removeEventListener('send-message' as any, handleMessage as any);
  }, [actions]);
  
  return (
    <div className="h-screen w-screen bg-[#05070B] text-white overflow-hidden flex flex-col">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-transparent to-purple-900/10 pointer-events-none" />
      
      {/* Hardware Spec Strip */}
      <HardwareSpecStrip />
      
      {/* Main Content Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Treemap & Terminal */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          {/* Treemap Section */}
          <div className="flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Storage Intelligence Map</h2>
                <p className="text-xs text-white/50">Visual breakdown of disk usage by folder</p>
              </div>
              <ScanControls
                onScan={handleScan}
                isScanning={isScanning}
                scanData={scanData}
              />
            </div>
            
            <div
              ref={treemapRef}
              className="bg-[#080C14] rounded-xl border border-white/10 overflow-hidden"
              style={{ height: '500px' }}
            >
              {scanData?.flaggedFolders && scanData.flaggedFolders.length > 0 ? (
                <Treemap
                  folders={scanData.flaggedFolders}
                  width={treemapSize.width}
                  height={treemapSize.height}
                  onFolderClick={setSelectedFolder}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-white/40">
                  <div className="text-center">
                    <div className="text-4xl mb-3">📊</div>
                    <p className="text-sm">Run a storage scan to visualize your disk usage</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Terminal Section */}
          <div className="flex-1 min-h-0">
            <TerminalPanel logs={executionLogs} />
          </div>
        </div>
        
        {/* Right Panel - Chat Sidebar */}
        <div className="w-[450px] flex-shrink-0">
          <ChatSidebar
            messages={chatLogs}
            isLoading={false}
            onDeployPlan={handleDeployPlan}
            onRollback={handleRollback}
          />
        </div>
      </div>
      
      {/* Selected Folder Detail Modal */}
      {selectedFolder && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setSelectedFolder(null)}
        >
          <div
            className="bg-[#080C14] rounded-2xl border border-white/20 p-6 max-w-lg w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Folder Details</h3>
              <button
                onClick={() => setSelectedFolder(null)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="text-xs text-white/50 mb-1">Path</div>
                <div className="text-sm text-white font-mono bg-white/5 px-3 py-2 rounded-lg break-all">
                  {selectedFolder.path}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-white/50 mb-1">Size</div>
                  <div className="text-sm text-white">{selectedFolder.sizeGB.toFixed(3)} GB</div>
                </div>
                <div>
                  <div className="text-xs text-white/50 mb-1">File Count</div>
                  <div className="text-sm text-white">{selectedFolder.fileCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50 mb-1">Category</div>
                  <div className="text-sm text-white capitalize">{selectedFolder.category}</div>
                </div>
                <div>
                  <div className="text-xs text-white/50 mb-1">Risk Level</div>
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    selectedFolder.riskLevel === 'low' ? 'bg-emerald-500/20 text-emerald-400' :
                    selectedFolder.riskLevel === 'medium' ? 'bg-indigo-500/20 text-indigo-400' :
                    selectedFolder.riskLevel === 'high' ? 'bg-rose-500/20 text-rose-400' :
                    'bg-red-600/20 text-red-400'
                  }`}>
                    {selectedFolder.riskLevel.toUpperCase()}
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-xs text-white/50 mb-1">Analysis</div>
                <div className="text-sm text-white/80 bg-white/5 px-3 py-2 rounded-lg">
                  {selectedFolder.reasoning}
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setSelectedFolder(null);
                  actions.submitAgentPrompt(`Analyze and optimize the folder at ${selectedFolder.path}`);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Ask AI to Analyze
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
