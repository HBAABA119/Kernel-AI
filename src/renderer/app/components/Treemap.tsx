/**
 * KernelAI - Canvas Treemap Component
 * High-performance directory visualization using HTML5 Canvas
 * Implements squashify-style partition geometry with risk-based coloring
 */

'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { FlaggedFolder, RiskLevel } from '../../../shared/types';

// ============================================================================
// Configuration & Constants
// ============================================================================

const COLORS = {
  // Risk level colors with alpha transparency
  low: { r: 16, g: 185, b: 129, a: 0.7 },      // Emerald
  medium: { r: 99, g: 102, b: 241, a: 0.7 },   // Indigo
  high: { r: 244, g: 63, b: 94, a: 0.7 },      // Rose
  critical: { r: 220, g: 38, b: 38, a: 0.8 },  // Red
  
  // Grid and accent colors
  grid: { r: 255, g: 255, b: 255, a: 0.1 },
  text: { r: 255, g: 255, b: 255, a: 0.9 },
  textSecondary: { r: 255, g: 255, b: 255, a: 0.6 },
  background: '#05070B',
};

const PADDING = 4;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 16;

// ============================================================================
// Types
// ============================================================================

interface TreemapNode {
  folder: FlaggedFolder;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}

interface TreemapProps {
  folders: FlaggedFolder[];
  width: number;
  height: number;
  onFolderClick?: (folder: FlaggedFolder) => void;
  className?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getColorForRisk(riskLevel: RiskLevel): string {
  const color = COLORS[riskLevel] || COLORS.low;
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
}

function getTextColorForBackground(riskLevel: RiskLevel): string {
  // Use white text for all backgrounds for contrast
  return 'rgba(255, 255, 255, 0.95)';
}

function formatSize(sizeGB: number): string {
  if (sizeGB >= 100) {
    return `${sizeGB.toFixed(1)}GB`;
  } else if (sizeGB >= 10) {
    return `${sizeGB.toFixed(2)}GB`;
  } else {
    return `${sizeGB.toFixed(3)}GB`;
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 2) + '...';
}

// ============================================================================
// Squarified Treemap Algorithm
// ============================================================================

function squarify(
  folders: FlaggedFolder[],
  x: number,
  y: number,
  width: number,
  height: number
): TreemapNode[] {
  if (folders.length === 0) return [];
  
  // Sort by size descending
  const sorted = [...folders].sort((a, b) => b.sizeGB - a.sizeGB);
  
  const totalSize = sorted.reduce((sum, f) => sum + f.sizeGB, 0);
  
  if (totalSize === 0) return [];
  
  const nodes: TreemapNode[] = [];
  
  function layout(
    items: FlaggedFolder[],
    px: number,
    py: number,
    pw: number,
    ph: number
  ): void {
    if (items.length === 0) return;
    
    if (items.length === 1) {
      const item = items[0];
      nodes.push({
        folder: item,
        x: px + PADDING,
        y: py + PADDING,
        width: pw - PADDING * 2,
        height: ph - PADDING * 2,
        depth: 0,
      });
      return;
    }
    
    // Calculate the sum of remaining items
    const sum = items.reduce((s, i) => s + i.sizeGB, 0);
    
    // Determine split direction based on aspect ratio
    const isHorizontal = pw >= ph;
    
    // Find the best split point
    let splitIndex = 0;
    let currentSum = 0;
    const targetRatio = isHorizontal ? ph / pw : pw / ph;
    
    for (let i = 0; i < items.length; i++) {
      currentSum += items[i].sizeGB;
      const ratio = currentSum / sum;
      
      if (isHorizontal) {
        const segmentWidth = pw * ratio;
        const segmentHeight = ph;
        const worstAspect = Math.max(
          segmentWidth / segmentHeight,
          segmentHeight / segmentWidth
        );
        
        if (i > 0 && worstAspect > targetRatio * 1.5) {
          splitIndex = i;
          break;
        }
      } else {
        const segmentWidth = pw;
        const segmentHeight = ph * ratio;
        const worstAspect = Math.max(
          segmentWidth / segmentHeight,
          segmentHeight / segmentWidth
        );
        
        if (i > 0 && worstAspect > targetRatio * 1.5) {
          splitIndex = i;
          break;
        }
      }
      
      splitIndex = i + 1;
    }
    
    if (splitIndex === 0) splitIndex = 1;
    
    const firstGroup = items.slice(0, splitIndex);
    const secondGroup = items.slice(splitIndex);
    
    if (firstGroup.length === 0) {
      layout(secondGroup, px, py, pw, ph);
      return;
    }
    
    const firstSum = firstGroup.reduce((s, i) => s + i.sizeGB, 0);
    const firstRatio = firstSum / sum;
    
    if (isHorizontal) {
      // Split horizontally
      const firstWidth = pw * firstRatio;
      
      firstGroup.forEach((item) => {
        const itemRatio = item.sizeGB / firstSum;
        nodes.push({
          folder: item,
          x: px + PADDING,
          y: py + itemRatio * ph + PADDING,
          width: firstWidth - PADDING * 2,
          height: ph * itemRatio - PADDING * 2,
          depth: 0,
        });
      });
      
      layout(secondGroup, px + firstWidth, py, pw - firstWidth, ph);
    } else {
      // Split vertically
      const firstHeight = ph * firstRatio;
      
      firstGroup.forEach((item) => {
        const itemRatio = item.sizeGB / firstSum;
        nodes.push({
          folder: item,
          x: px + itemRatio * pw + PADDING,
          y: py + PADDING,
          width: pw * itemRatio - PADDING * 2,
          height: firstHeight - PADDING * 2,
          depth: 0,
        });
      });
      
      layout(secondGroup, px, py + firstHeight, pw, ph - firstHeight);
    }
  }
  
  layout(sorted, x, y, width, height);
  
  return nodes;
}

// ============================================================================
// Treemap Component
// ============================================================================

export const Treemap: React.FC<TreemapProps> = ({
  folders,
  width,
  height,
  onFolderClick,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<TreemapNode[]>([]);
  const hoverRef = useRef<{ x: number; y: number; node: TreemapNode | null }>({
    x: -1,
    y: -1,
    node: null,
  });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: TreemapNode } | null>(null);

  // Generate treemap layout
  const generateLayout = useCallback(() => {
    if (!canvasRef.current || folders.length === 0) return;
    
    const nodes = squarify(folders, 0, 0, width, height);
    nodesRef.current = nodes;
  }, [folders, width, height]);

  // Draw the treemap
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);
    
    // Draw all nodes
    nodesRef.current.forEach((node) => {
      const { x, y, width: w, height: h, folder } = node;
      
      // Skip if too small
      if (w < 10 || h < 10) return;
      
      // Draw background rectangle
      ctx.fillStyle = getColorForRisk(folder.riskLevel);
      ctx.fillRect(x, y, w, h);
      
      // Draw grid border
      ctx.strokeStyle = `rgba(${COLORS.grid.r}, ${COLORS.grid.g}, ${COLORS.grid.b}, ${COLORS.grid.a})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      
      // Draw hover highlight
      if (hoverRef.current.node === node) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, y, w, h);
      }
      
      // Calculate font size based on rectangle size
      const fontSize = Math.min(
        MAX_FONT_SIZE,
        Math.max(MIN_FONT_SIZE, Math.sqrt(w * h) / 10)
      );
      
      // Draw text
      ctx.fillStyle = getTextColorForBackground(folder.riskLevel);
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      
      // Path text
      const pathText = truncateText(folder.path.split('\\').pop() || folder.path, Math.floor(w / 8));
      ctx.fillText(pathText, x + 6, y + 6);
      
      // Size text
      if (h > fontSize * 2 + 8) {
        ctx.fillStyle = `rgba(${COLORS.textSecondary.r}, ${COLORS.textSecondary.g}, ${COLORS.textSecondary.b}, ${COLORS.textSecondary.a})`;
        ctx.font = `${Math.max(8, fontSize - 2)}px Inter, system-ui, sans-serif`;
        ctx.fillText(formatSize(folder.sizeGB), x + 6, y + fontSize + 8);
      }
      
      // Risk badge
      if (w > 60 && h > fontSize * 3 + 12) {
        const badgeWidth = 50;
        const badgeHeight = 16;
        const badgeX = x + 6;
        const badgeY = y + fontSize * 2 + 12;
        
        // Badge background
        ctx.fillStyle = getColorForRisk(folder.riskLevel);
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4);
        ctx.fill();
        
        // Badge text
        ctx.fillStyle = '#fff';
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          folder.riskLevel.toUpperCase(),
          badgeX + badgeWidth / 2,
          badgeY + 3
        );
        ctx.textAlign = 'left';
      }
    });
  }, [width, height]);

  // Handle mouse move for hover effects
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Find hovered node
      let hoveredNode: TreemapNode | null = null;
      
      for (const node of nodesRef.current) {
        if (
          x >= node.x &&
          x <= node.x + node.width &&
          y >= node.y &&
          y <= node.y + node.height
        ) {
          hoveredNode = node;
          break;
        }
      }
      
      hoverRef.current = { x, y, node: hoveredNode };
      
      // Update tooltip state for re-render
      if (hoveredNode) {
        setTooltip({ x, y, node: hoveredNode });
      } else {
        setTooltip(null);
      }
      
      // Redraw to show hover effect
      draw();
    },
    [draw]
  );

  // Handle click
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (hoverRef.current.node && onFolderClick) {
        onFolderClick(hoverRef.current.node.folder);
      }
    },
    [onFolderClick]
  );

  // Initial layout and draw
  useEffect(() => {
    generateLayout();
    draw();
  }, [generateLayout, draw]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set actual canvas size (accounting for DPI)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    
    generateLayout();
    draw();
  }, [width, height, generateLayout, draw]);

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="cursor-pointer rounded-lg"
        style={{
          width,
          height,
        }}
      />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-3 bg-black/50 backdrop-blur-sm px-3 py-2 rounded-lg">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: getColorForRisk('low') }}
          />
          <span className="text-xs text-white/70">Low Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: getColorForRisk('medium') }}
          />
          <span className="text-xs text-white/70">Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: getColorForRisk('high') }}
          />
          <span className="text-xs text-white/70">High</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: getColorForRisk('critical') }}
          />
          <span className="text-xs text-white/70">Critical</span>
        </div>
      </div>
      
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-black/90 backdrop-blur-md px-3 py-2 rounded-lg border border-white/10 shadow-xl"
          style={{
            left: Math.min(tooltip.x + 15, width - 200),
            top: Math.min(tooltip.y + 15, height - 150),
            maxWidth: '280px',
          }}
        >
          <div className="text-white font-medium text-sm mb-1">
            {truncateText(tooltip.node.folder.path, 50)}
          </div>
          <div className="text-white/70 text-xs space-y-1">
            <div>Size: {formatSize(tooltip.node.folder.sizeGB)}</div>
            <div>Files: {tooltip.node.folder.fileCount.toLocaleString()}</div>
            <div>Category: {tooltip.node.folder.category}</div>
            <div>Risk: {tooltip.node.folder.riskLevel}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Treemap;
