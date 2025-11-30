"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

// --- 型定義 ---
type LSystemConfig = {
  axiom: string;
  rules: string;
  angle: number;
  initialLength: number;
  startOffset: { x: number; y: number };
};

// --- プリセット ---
const PRESETS: Record<string, LSystemConfig & { lengthDecay?: number }> = {
  "Standard Tree": {
    axiom: "F",
    rules: "F=F[+F]-F",
    angle: 45,
    initialLength: 50, 
    startOffset: { x: 0.5, y: 0.8 }, 
  },
  "Complex Bush": {
    axiom: "F",
    rules: "F=F[+F]F[-F]F",
    angle: 25,
    initialLength: 30,
    startOffset: { x: 0.5, y: 0.8 },
  },
  "Dragon Curve": {
    axiom: "FX",
    rules: "X=X+YF+\nY=-FX-Y",
    angle: 90,
    initialLength: 10,
    startOffset: { x: 0.5, y: 0.5 },
  },
  "Sierpinski": {
    axiom: "F-G-G",
    rules: "F=F-G+F+G-F\nG=GG",
    angle: 120,
    initialLength: 10,
    startOffset: { x: 0.2, y: 0.7 },
  },
};

export default function LSystemEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 状態管理
  const [config, setConfig] = useState<LSystemConfig>(PRESETS["Standard Tree"]);
  const [generation, setGeneration] = useState(0);
  const [dna, setDna] = useState("");
  const [scale, setScale] = useState(1.0); // ズーム倍率
  const [pan, setPan] = useState({ x: 0, y: 0 }); // 表示位置の移動量 (x, y)
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // ドラッグ・ピンチ操作用のRef
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const lastPinchDistRef = useRef<number | null>(null); // ピンチ操作の距離

  // --- 1. ルールのパース ---
  const parseRules = useCallback((rulesString: string) => {
    const rulesMap: Record<string, string> = {};
    rulesString.split("\n").forEach(line => {
      const [key, value] = line.split("=");
      if (key && value) {
        rulesMap[key.trim()] = value.trim();
      }
    });
    return rulesMap;
  }, []);

  // --- 2. DNAの成長 ---
  const growDna = useCallback((currentString: string, rulesMap: Record<string, string>) => {
    let nextString = "";
    for (const char of currentString) {
      nextString += rulesMap[char] || char;
    }
    return nextString;
  }, []);

  useEffect(() => {
    const rulesMap = parseRules(config.rules);
    let currentDna = config.axiom;
    // ステップ数上限を緩和 (複雑なルールは6、単純なものは8まで)
    const maxGen = config.rules.length > 20 ? 6 : 9; 
    const safeGen = Math.min(generation, maxGen);

    for (let i = 0; i < safeGen; i++) {
      currentDna = growDna(currentDna, rulesMap);
    }
    setDna(currentDna);
  }, [generation, config, growDna, parseRules]);

  // --- 3. 描画 ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 画面クリア
    ctx.fillStyle = "#020408"; // 完全な黒よりわずかに青みのある黒
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 描画設定：加算合成で光らせる
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(6, 182, 212, 0.6)"; // Cyan-500 with opacity
    ctx.lineWidth = 1.5; 
    ctx.lineCap = "round";

    // 開始位置（根元）: 初期位置 + パン(ドラッグ)移動量
    let x = canvas.width * config.startOffset.x + pan.x;
    let y = canvas.height * config.startOffset.y + pan.y;
    let dir = -90 * (Math.PI / 180); 
    
    // 長さ計算
    let len = config.initialLength * scale;

    const stack: { x: number; y: number; dir: number }[] = [];

    ctx.beginPath();
    ctx.moveTo(x, y);

    for (const char of dna) {
      if (char === "F" || char === "G") {
        x += Math.cos(dir) * len;
        y += Math.sin(dir) * len;
        ctx.lineTo(x, y);
      } else if (char === "+") {
        dir += config.angle * (Math.PI / 180);
      } else if (char === "-") {
        dir -= config.angle * (Math.PI / 180);
      } else if (char === "[") {
        stack.push({ x, y, dir });
      } else if (char === "]") {
        ctx.stroke();
        // パスを一度切ることで、重なり部分の発光効果を最大限に活かす
        ctx.beginPath();
        const state = stack.pop();
        if (state) {
          x = state.x;
          y = state.y;
          dir = state.dir;
          ctx.moveTo(x, y);
        }
      }
    }
    ctx.stroke();
    
    // 設定を戻す
    ctx.globalCompositeOperation = "source-over";

  }, [dna, config, scale, pan]);

  // リサイズ対応
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        draw();
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize(); 
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  useEffect(() => { draw(); }, [dna, draw]);

  const applyPreset = (name: string) => {
    setConfig(PRESETS[name]);
    setGeneration(0);
    setScale(1.0);
    setPan({ x: 0, y: 0 }); // 位置もリセット
  };

  // --- マウスホイールでのズーム (修正版: 正確な位置維持) ---
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault(); // ブラウザのスクロール防止
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 拡大縮小の感度
    const zoomSensitivity = 0.001;
    const zoomFactor = Math.exp(-e.deltaY * zoomSensitivity);
    const newScale = Math.max(0.01, Math.min(100, scale * zoomFactor));

    // マウス位置を取得
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // 現在の「木の根元」の画面上の座標
    const rootX = canvas.width * config.startOffset.x + pan.x;
    const rootY = canvas.height * config.startOffset.y + pan.y;

    // ズーム中心の計算:
    // マウス位置にある点は、根元からベクトル V = (mouseX - rootX) の位置にある。
    // 新しいスケールでは、このベクトルは V' = V * (newScale / scale) になる。
    // マウス位置を変えずに根元をずらすには、新しい根元位置 rootX' = mouseX - V' とすればよい。
    
    const ratio = newScale / scale;
    const newRootX = mouseX - (mouseX - rootX) * ratio;
    const newRootY = mouseY - (mouseY - rootY) * ratio;

    // パン（移動量）に変換して保存
    const newPanX = newRootX - canvas.width * config.startOffset.x;
    const newPanY = newRootY - canvas.height * config.startOffset.y;

    setPan({ x: newPanX, y: newPanY });
    setScale(newScale);
  };

  // --- 2点間の距離と中点を計算するヘルパー ---
  const getTouchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    const cx = (touches[0].clientX + touches[1].clientX) / 2;
    const cy = (touches[0].clientY + touches[1].clientY) / 2;
    return { x: cx, y: cy };
  };

  // --- ドラッグ & ピンチ操作ハンドラ ---
  const handlePointerStart = (e: React.MouseEvent | React.TouchEvent) => {
    // 2本指タッチ（ピンチ操作開始）
    if ('touches' in e && e.touches.length === 2) {
      isDraggingRef.current = false; // パン操作は中断
      lastPinchDistRef.current = getTouchDistance(e.touches);
    } 
    // 1本指またはマウス（パン操作開始）
    else {
      isDraggingRef.current = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      lastMousePosRef.current = { x: clientX, y: clientY };
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ピンチズーム処理 (修正版: 中心維持)
    if ('touches' in e && e.touches.length === 2 && lastPinchDistRef.current !== null) {
      const dist = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches); // ピンチの中心
      
      // 距離の比率でスケール変更
      const ratio = dist / lastPinchDistRef.current;
      const newScale = Math.max(0.01, Math.min(100, scale * ratio));
      
      // ズーム中心の計算 (Wheelと同じロジック)
      const rootX = canvas.width * config.startOffset.x + pan.x;
      const rootY = canvas.height * config.startOffset.y + pan.y;
      
      const effectiveRatio = newScale / scale;
      const newRootX = center.x - (center.x - rootX) * effectiveRatio;
      const newRootY = center.y - (center.y - rootY) * effectiveRatio;

      const newPanX = newRootX - canvas.width * config.startOffset.x;
      const newPanY = newRootY - canvas.height * config.startOffset.y;

      setPan({ x: newPanX, y: newPanY });
      setScale(newScale);
      lastPinchDistRef.current = dist;
      return;
    }

    // パンドラッグ処理
    if (!isDraggingRef.current) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const deltaX = clientX - lastMousePosRef.current.x;
    const deltaY = clientY - lastMousePosRef.current.y;
    
    setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
    lastMousePosRef.current = { x: clientX, y: clientY };
  };

  const handlePointerEnd = () => {
    isDraggingRef.current = false;
    lastPinchDistRef.current = null;
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-[#020408] flex flex-col touch-none overflow-hidden font-mono text-cyan-400">
      
      {/* 戻るボタン */}
      <Link href="/" className="absolute top-4 left-4 z-50 px-3 py-1 bg-black/50 backdrop-blur border border-cyan-900 text-xs hover:border-cyan-500 transition-colors text-cyan-500">
        ← HUB
      </Link>

      {/* キャンバス (ドラッグ・ホイール・ピンチ対応) */}
      <canvas 
        ref={canvasRef} 
        className="block w-full h-full cursor-move active:cursor-grabbing"
        onMouseDown={handlePointerStart}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerEnd}
        onMouseLeave={handlePointerEnd}
        onTouchStart={handlePointerStart}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerEnd}
        onWheel={handleWheel}
      />

      {/* 現在の倍率表示のみ残す */}
      <div className="absolute right-4 bottom-32 z-30 pointer-events-none">
        <div className="text-center text-[10px] bg-black/50 text-cyan-400 rounded px-2 py-1 backdrop-blur border border-cyan-900/30">
            ZOOM: x{scale.toFixed(2)}
        </div>
      </div>

      {/* コントロールパネル (常時表示部分) */}
      <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur border-t border-cyan-900 p-4 pb-8 z-20 flex flex-col gap-4">
        
        {/* 世代スライダー (上限を8に変更) */}
        <div className="flex items-center gap-4">
          <span className="text-xs w-12 text-gray-500">GEN:{generation}</span>
          <input 
            type="range" min="0" max="8" step="1" 
            value={generation}
            onChange={(e) => setGeneration(Number(e.target.value))}
            className="flex-grow accent-cyan-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* ボタン列 */}
        <div className="flex justify-between items-center">
          <select 
            className="bg-gray-900 border border-cyan-800 text-xs text-cyan-400 py-2 px-3 rounded focus:outline-none"
            onChange={(e) => applyPreset(e.target.value)}
          >
            {Object.keys(PRESETS).map(name => <option key={name} value={name}>{name}</option>)}
          </select>

          <button 
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className={`text-xs px-4 py-2 border rounded transition-colors ${isPanelOpen ? "bg-cyan-900 border-cyan-500 text-white" : "border-cyan-800 text-cyan-500"}`}
          >
            {isPanelOpen ? "CLOSE EDITOR" : "CUSTOMIZE"}
          </button>
        </div>
      </div>

      {/* 詳細エディタ (スライドアップ) */}
      <div 
        className={`
          absolute bottom-[100px] left-0 w-full bg-black/90 backdrop-blur border-t border-cyan-900 p-6 z-10 transition-transform duration-300 ease-out
          ${isPanelOpen ? "translate-y-0" : "translate-y-[120%]"}
        `}
      >
        <div className="grid grid-cols-2 gap-6 max-w-lg mx-auto">
          
          {/* 左カラム: パラメータ */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">AXIOM (START)</label>
              <input 
                type="text" value={config.axiom}
                onChange={(e) => setConfig({...config, axiom: e.target.value})}
                className="w-full bg-gray-900 border border-cyan-900 p-2 text-xs rounded text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">ANGLE: {config.angle}°</label>
              <input 
                type="range" min="0" max="180" value={config.angle}
                onChange={(e) => setConfig({...config, angle: Number(e.target.value)})}
                className="w-full accent-cyan-500 h-1 bg-gray-800 rounded appearance-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">BASE LENGTH: {config.initialLength}</label>
              <input 
                type="range" min="10" max="200" value={config.initialLength}
                onChange={(e) => setConfig({...config, initialLength: Number(e.target.value)})}
                className="w-full accent-cyan-500 h-1 bg-gray-800 rounded appearance-none"
              />
            </div>
          </div>

          {/* 右カラム: ルールエディタ */}
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">RULES (e.g. F=F[+F])</label>
            <textarea 
              value={config.rules}
              onChange={(e) => setConfig({...config, rules: e.target.value})}
              className="w-full h-24 bg-gray-900 border border-cyan-900 p-2 text-xs rounded text-white font-mono focus:border-cyan-500 focus:outline-none resize-none"
            />
            {/* チートシート */}
            <div className="mt-2 text-[10px] text-gray-600 grid grid-cols-2 gap-1">
              <span>F: Draw</span> <span>+: Right</span>
              <span>-: Left</span> <span>[: Save</span>
              <span>]: Return</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}