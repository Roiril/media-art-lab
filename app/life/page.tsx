"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link"; // 戻るボタン用

const CELL_SIZE = 10;
const CELL_COLOR = "#39ff14";
const BG_COLOR = "#050505";
const GRID_LINE_COLOR = "#111111";

const PATTERNS: Record<string, number[][]> = {
  "R-Pentomino (Chaos)": [[0, 1], [0, 2], [1, 0], [1, 1], [2, 1]],
  "Glider (Walker)": [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  "Lightweight Spaceship": [[0, 1], [0, 4], [1, 0], [2, 0], [3, 0], [3, 4], [4, 0], [4, 1], [4, 2], [4, 3]],
  "Pulsar (Oscillator)": [
    [0, 2], [0, 3], [0, 4], [0, 8], [0, 9], [0, 10], [2, 0], [2, 5], [2, 7], [2, 12],
    [3, 0], [3, 5], [3, 7], [3, 12], [4, 0], [4, 5], [4, 7], [4, 12], [5, 2], [5, 3], [5, 4], [5, 8], [5, 9], [5, 10],
    [7, 2], [7, 3], [7, 4], [7, 8], [7, 9], [7, 10], [8, 0], [8, 5], [8, 7], [8, 12], [9, 0], [9, 5], [9, 7], [9, 12],
    [10, 0], [10, 5], [10, 7], [10, 12], [12, 2], [12, 3], [12, 4], [12, 8], [12, 9], [12, 10]
  ],
  "Gosper Glider Gun": [
    [0, 24], [1, 22], [1, 24], [2, 12], [2, 13], [2, 20], [2, 21], [2, 34], [2, 35],
    [3, 11], [3, 15], [3, 20], [3, 21], [3, 34], [3, 35], [4, 0], [4, 1], [4, 10], [4, 16], [4, 20], [4, 21],
    [5, 0], [5, 1], [5, 10], [5, 14], [5, 16], [5, 17], [5, 22], [5, 24], [6, 10], [6, 16], [7, 11], [7, 15], [8, 12], [8, 13]
  ]
};

export default function GameOfLifePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const [isRunning, setIsRunning] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [selectedPattern, setSelectedPattern] = useState("Gosper Glider Gun");

  const gridRef = useRef<number[][]>([]);
  const rowsRef = useRef(0);
  const colsRef = useRef(0);
  const animationFrameId = useRef<number>(0);

  // --- 描画ロジック ---
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += CELL_SIZE) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = 0; y <= canvas.height; y += CELL_SIZE) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();
    ctx.fillStyle = CELL_COLOR;
    const grid = gridRef.current;
    for (let y = 0; y < rowsRef.current; y++) {
      if (!grid[y]) continue;
      for (let x = 0; x < colsRef.current; x++) {
        if (grid[y][x]) ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      }
    }
  }, []);

  // --- グリッド操作 ---
  const resetGrid = useCallback(() => {
    if (!canvasRef.current || !wrapperRef.current) return;
    const { width, height } = wrapperRef.current.getBoundingClientRect();
    canvasRef.current.width = width;
    canvasRef.current.height = height;
    const cols = Math.ceil(width / CELL_SIZE);
    const rows = Math.ceil(height / CELL_SIZE);
    rowsRef.current = rows;
    colsRef.current = cols;
    gridRef.current = new Array(rows).fill(null).map(() => new Array(cols).fill(0));
    setGeneration(0);
    drawGrid();
  }, [drawGrid]);

  const loadPattern = useCallback((patternName: string) => {
    resetGrid();
    const pattern = PATTERNS[patternName];
    if (!pattern) return;
    const grid = gridRef.current;
    const rows = rowsRef.current;
    const cols = colsRef.current;
    let maxX = 0, maxY = 0;
    pattern.forEach(([y, x]) => { if (x > maxX) maxX = x; if (y > maxY) maxY = y; });
    const offsetX = Math.floor((cols - maxX) / 2);
    const offsetY = Math.floor((rows - maxY) / 2);
    pattern.forEach(([y, x]) => {
        const targetY = y + offsetY;
        const targetX = x + offsetX;
        if (targetY >= 0 && targetY < rows && targetX >= 0 && targetX < cols) grid[targetY][targetX] = 1;
    });
    drawGrid();
  }, [resetGrid, drawGrid]);

  const computeNextGen = useCallback(() => {
    const grid = gridRef.current;
    const rows = rowsRef.current;
    const cols = colsRef.current;
    const nextGrid = grid.map(arr => [...arr]); 
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const state = grid[y][x];
        let neighbors = 0;
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            neighbors += grid[(y + i + rows) % rows][(x + j + cols) % cols];
          }
        }
        if (state === 1 && (neighbors < 2 || neighbors > 3)) nextGrid[y][x] = 0;
        else if (state === 0 && neighbors === 3) nextGrid[y][x] = 1;
      }
    }
    gridRef.current = nextGrid;
    setGeneration(g => g + 1);
    drawGrid();
  }, [drawGrid]);

  const loop = useCallback(() => {
    if (!isRunning) return;
    computeNextGen();
    animationFrameId.current = requestAnimationFrame(loop);
  }, [isRunning, computeNextGen]);

  useEffect(() => {
    if (isRunning) animationFrameId.current = requestAnimationFrame(loop);
    else cancelAnimationFrame(animationFrameId.current);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [isRunning, loop]);

  useEffect(() => {
    loadPattern(selectedPattern);
    const handleResize = () => { setIsRunning(false); loadPattern(selectedPattern); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); // eslint-disable-line

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    let clientX, clientY;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { if ((e as React.MouseEvent).buttons !== 1) return; clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((clientY - rect.top) / CELL_SIZE);
    if (x >= 0 && x < colsRef.current && y >= 0 && y < rowsRef.current) {
        gridRef.current[y][x] = 1;
        drawGrid();
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-black flex flex-col touch-none overflow-hidden font-mono text-green-400">
      {/* --- 追加: 戻るボタン (オーバーレイ) --- */}
      <Link href="/" className="absolute top-4 left-4 z-50 px-3 py-1 bg-black/50 backdrop-blur border border-green-900 text-xs hover:border-green-500 transition-colors">
        ← HUB
      </Link>

      <div ref={wrapperRef} className="flex-grow relative w-full">
        <canvas ref={canvasRef} className="block outline-none active:cursor-cell"
          onMouseDown={handleInteraction} onMouseMove={handleInteraction}
          onTouchStart={handleInteraction} onTouchMove={handleInteraction}
        />
      </div>

      <div className="flex-none p-4 pb-8 bg-gray-900/90 backdrop-blur border-t border-green-900 z-10 flex flex-col gap-3 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between items-center text-xs text-gray-400 pl-16">
            <span>GEN: {generation}</span>
            <span>DRAW TO INTERACT</span>
        </div>
        <div className="flex gap-2 w-full">
            <select value={selectedPattern} onChange={(e) => { setSelectedPattern(e.target.value); setIsRunning(false); loadPattern(e.target.value); }}
                className="flex-grow bg-black border border-green-700 text-green-400 p-3 rounded text-sm focus:outline-none focus:border-green-400">
                {Object.keys(PATTERNS).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <button onClick={() => setIsRunning(!isRunning)} className={`w-24 font-bold rounded border transition-all ${isRunning ? 'bg-green-600 border-green-600 text-black' : 'bg-black border-green-600 text-green-400'}`}>
                {isRunning ? "STOP" : "PLAY"}
            </button>
        </div>
      </div>
    </div>
  );
}