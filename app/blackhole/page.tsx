"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

// --- パーティクル（光の粒）の定義 ---
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  isJet: boolean; // ジェットとして噴出中かどうか

  constructor(w: number, h: number, centerX: number, centerY: number) {
    this.isJet = false;
    
    // 初期配置
    const angle = Math.random() * Math.PI * 2;
    // 中心からある程度離れた位置に配置
    const dist = (Math.min(w, h) / 4) + Math.random() * 200;
    this.x = centerX + Math.cos(angle) * dist;
    this.y = centerY + Math.sin(angle) * dist;
    
    // 初速計算：円軌道速度 v = sqrt(GM / r) に基づく
    // GM = 50.0 (重力) * 100 (係数) = 5000
    const orbitalSpeed = Math.sqrt(5000 / dist);
    
    // 完全に円軌道だと落ちてこないので、少しランダム性を持たせる (0.5倍〜1.1倍)
    // 1.0未満が多いほど吸い込まれやすい
    const velocity = orbitalSpeed * (0.5 + Math.random() * 0.6);
    
    this.vx = Math.cos(angle + Math.PI / 2) * velocity;
    this.vy = Math.sin(angle + Math.PI / 2) * velocity;
    this.size = Math.random() * 2 + 0.5;
  }

  // 通常のリスポーン（外周から）
  respawn(w: number, h: number, centerX: number, centerY: number) {
    this.isJet = false;
    const angle = Math.random() * Math.PI * 2;
    // 画面サイズに基づいた距離に出現させる
    const spawnDist = (Math.min(w, h) / 2) + Math.random() * 100;
    this.x = centerX + Math.cos(angle) * spawnDist;
    this.y = centerY + Math.sin(angle) * spawnDist;
    
    // リスポーン時も軌道速度を計算して設定
    const orbitalSpeed = Math.sqrt(5000 / spawnDist);
    // 外周から内側へ少し向かう成分を持たせるため、完全な接線方向から少しずらすことも可能だが
    // ここでは速度の大きさで調整 (0.8倍〜1.0倍くらいが安定して回る)
    const v = orbitalSpeed * (0.8 + Math.random() * 0.3);
    
    this.vx = Math.cos(angle + Math.PI / 2) * v;
    this.vy = Math.sin(angle + Math.PI / 2) * v;
  }

  // ジェットとして噴出
  fireJet(centerX: number, centerY: number) {
    this.isJet = true;
    this.x = centerX;
    this.y = centerY;
    
    // 上下どちらかに超高速で噴出
    const dir = Math.random() < 0.5 ? 1 : -1;
    // 重力が強いので脱出速度も上げる
    this.vx = (Math.random() - 0.5) * 8; 
    this.vy = dir * (40 + Math.random() * 30);
  }
}

export default function BlackHolePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // 状態管理
  const [horizonSize, setHorizonSize] = useState(30); // ブラックホールのサイズ
  const [particleCount, setParticleCount] = useState(1000);
  const [isPaused, setIsPaused] = useState(false);
  
  // ズーム・パン用状態
  const [scale, setScale] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // シミュレーション用データ
  const particlesRef = useRef<Particle[]>([]);
  const centerRef = useRef({ x: 0, y: 0 });
  const maxDistRef = useRef(1000); // パーティクルの生存限界距離

  // 操作用Ref
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const lastPinchDistRef = useRef<number | null>(null);

  // --- 初期化 ---
  const initParticles = useCallback((count: number, w: number, h: number) => {
    const arr: Particle[] = [];
    const cx = w / 2;
    const cy = h / 2;
    centerRef.current = { x: cx, y: cy };
    
    // 画面サイズに基づいて限界距離を設定
    maxDistRef.current = Math.max(w, h) * 1.5;
    
    for (let i = 0; i < count; i++) {
      arr.push(new Particle(w, h, cx, cy));
    }
    particlesRef.current = arr;
  }, []);

  // --- メインループ ---
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (isPaused) {
        requestRef.current = requestAnimationFrame(animate);
        return;
    }

    // 画面クリア（残像効果）
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 座標変換の適用（ズーム・パン）
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);

    // 加算合成
    ctx.globalCompositeOperation = "lighter";

    const cx = centerRef.current.x;
    const cy = centerRef.current.y;
    
    // 設定されたサイズを使用
    const eventHorizon = horizonSize; 
    
    // 重力設定：超強力に (5.0 -> 50.0)
    const gravity = 50.0; 

    // 限界距離
    const maxDistance = maxDistRef.current;

    particlesRef.current.forEach((p) => {
      const dxFromCenter = p.x - cx;
      const dyFromCenter = p.y - cy;
      const distFromCenterSq = dxFromCenter * dxFromCenter + dyFromCenter * dyFromCenter;

      // --- ジェットの処理 ---
      if (p.isJet) {
        p.x += p.vx;
        p.y += p.vy;
        
        // 描画（青白いビーム）
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx, p.y - p.vy);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = "#a5f3fc"; 
        ctx.lineWidth = p.size;
        ctx.stroke();

        if (distFromCenterSq > maxDistance * maxDistance) {
           p.respawn(canvas.width, canvas.height, cx, cy);
        }
        return; 
      }

      // --- 通常粒子の処理 ---
      
      // 1. 重力計算
      const dist = Math.sqrt(distFromCenterSq);

      // イベント・ホライゾン到達判定
      if (dist < eventHorizon) {
        // 30%の確率でジェット噴射
        if (Math.random() < 0.3) {
          p.fireJet(cx, cy);
        } else {
          p.respawn(canvas.width, canvas.height, cx, cy);
        }
        return;
      }

      // 遠くに行き過ぎた場合のリスポーン
      if (dist > maxDistance) {
         p.respawn(canvas.width, canvas.height, cx, cy);
         return;
      }

      // 引力 F = G * M / r^2
      const safeDistSq = Math.max(distFromCenterSq, 100); 
      const force = gravity * 100 / safeDistSq;

      // 中心へ向かうベクトル
      const dx = cx - p.x;
      const dy = cy - p.y;
      
      const ax = (dx / dist) * force;
      const ay = (dy / dist) * force;
      p.vx += ax;
      p.vy += ay;

      // 2. 位置更新
      p.x += p.vx;
      p.y += p.vy;

      // 3. 描画 & 色計算
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      
      // 速度に応じた色（熱表現） - 重力が強くなったので速度閾値も上げる
      let color;
      if (speed < 5) { // 低速域
        color = `hsl(0, 100%, 50%)`; // Red
      } else if (speed < 15) { // 中速域 (加速中)
        const hue = ((speed - 5) / 10) * 60; 
        color = `hsl(${hue}, 100%, 50%)`;
      } else { // 高速域 (事象の地平線付近)
        // 青白く輝く
        const lightness = Math.min(100, 50 + (speed - 15) * 2);
        color = `hsl(210, 100%, ${lightness}%)`;
      }

      ctx.beginPath();
      ctx.moveTo(p.x - p.vx, p.y - p.vy);
      ctx.lineTo(p.x, p.y);
      
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.5, p.size - speed * 0.02); // 伸びすぎないよう調整
      ctx.stroke();
    });

    // --- ブラックホール本体 ---
    ctx.globalCompositeOperation = "source-over";
    
    // グロー効果
    const grad = ctx.createRadialGradient(cx, cy, eventHorizon * 0.8, cx, cy, eventHorizon * 3.5);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(0.3, "rgba(0,0,0,0.9)");
    grad.addColorStop(0.5, "rgba(50, 0, 100, 0.2)"); 
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, eventHorizon * 4, 0, Math.PI * 2);
    ctx.fill();

    // 完全な闇
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(cx, cy, eventHorizon, 0, Math.PI * 2);
    ctx.fill();
    
    // 降着円盤のフォトンリング（光の輪）
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, eventHorizon + 1, 0, Math.PI * 2);
    ctx.stroke();

    // 座標変換終了
    ctx.restore();

    requestRef.current = requestAnimationFrame(animate);
  }, [horizonSize, isPaused, scale, pan]);

  // --- リサイズ & スタートアップ ---
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        initParticles(particleCount, w, h);
      }
    };
    
    window.addEventListener("resize", handleResize);
    handleResize();
    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [animate, initParticles, particleCount]);

  // --- ズーム・パン・インタラクション ---

  // ホイールズーム (中心維持)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const zoomFactor = Math.exp(-e.deltaY * zoomSensitivity);
    const newScale = Math.max(0.1, Math.min(50, scale * zoomFactor));

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    const newPanX = mouseX - ((mouseX - pan.x) / scale) * newScale;
    const newPanY = mouseY - ((mouseY - pan.y) / scale) * newScale;

    setPan({ x: newPanX, y: newPanY });
    setScale(newScale);
  };

  // 2点間距離
  const getTouchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  // 2点中心
  const getTouchCenter = (touches: React.TouchList) => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };

  // ポインター開始
  const handlePointerStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length === 2) {
      isDraggingRef.current = false;
      lastPinchDistRef.current = getTouchDistance(e.touches);
    } else {
      isDraggingRef.current = true;
      const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      lastMousePosRef.current = { x: cx, y: cy };

      injectMatter(cx, cy);
    }
  };

  // 物質投入ロジック
  const injectMatter = (screenX: number, screenY: number) => {
    const worldX = (screenX - pan.x) / scale;
    const worldY = (screenY - pan.y) / scale;

    const particles = particlesRef.current;
    for(let i=0; i<50; i++) {
        const idx = Math.floor(Math.random() * particles.length);
        const p = particles[idx];
        p.isJet = false; 
        p.x = worldX + (Math.random() - 0.5) * 20;
        p.y = worldY + (Math.random() - 0.5) * 20;
        
        const dx = centerRef.current.x - worldX;
        const dy = centerRef.current.y - worldY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx);
        
        // 投入時も距離に応じた軌道速度を計算
        // ただし、投入直後に吸い込まれるように、軌道速度より少し遅くする (0.4倍〜0.8倍)
        const orbitalSpeed = Math.sqrt(5000 / dist);
        const v = orbitalSpeed * (0.4 + Math.random() * 0.4);
        
        p.vx = Math.cos(angle + Math.PI/2) * v;
        p.vy = Math.sin(angle + Math.PI/2) * v;
    }
  };

  // ポインター移動
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length === 2 && lastPinchDistRef.current !== null) {
      const dist = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      const ratio = dist / lastPinchDistRef.current;
      const newScale = Math.max(0.1, Math.min(50, scale * ratio));

      const newPanX = center.x - ((center.x - pan.x) / scale) * newScale;
      const newPanY = center.y - ((center.y - pan.y) / scale) * newScale;

      setScale(newScale);
      setPan({ x: newPanX, y: newPanY });
      lastPinchDistRef.current = dist;
      return;
    }

    if (!isDraggingRef.current) return;
    
    const cx = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const deltaX = cx - lastMousePosRef.current.x;
    const deltaY = cy - lastMousePosRef.current.y;
    
    setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
    lastMousePosRef.current = { x: cx, y: cy };
  };

  const handlePointerEnd = () => {
    isDraggingRef.current = false;
    lastPinchDistRef.current = null;
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-black flex flex-col touch-none overflow-hidden font-mono text-purple-400">
      
      {/* 戻るボタン */}
      <Link href="/" className="absolute top-4 left-4 z-50 px-3 py-1 bg-black/50 backdrop-blur border border-purple-900 text-xs hover:border-purple-500 transition-colors text-purple-500">
        ← HUB
      </Link>

      {/* キャンバス */}
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

      {/* ズーム倍率表示 */}
      <div className="absolute right-4 bottom-40 z-30 pointer-events-none">
        <div className="text-center text-[10px] bg-black/50 text-purple-400 rounded px-2 py-1 backdrop-blur border border-purple-900/30">
            ZOOM: x{scale.toFixed(2)}
        </div>
      </div>

      {/* コントロールパネル */}
      <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur border-t border-purple-900 p-6 pb-10 rounded-t-2xl shadow-[0_-5px_30px_rgba(0,0,0,0.8)] pointer-events-auto">
        
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-widest text-white mb-1 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]">SINGULARITY</h1>
            <p className="text-[10px] text-gray-400">RELATIVISTIC JETS & ACCRETION DISK</p>
          </div>
          <button 
             onClick={() => setIsPaused(!isPaused)}
             className="text-xs px-4 py-2 border border-purple-800 text-purple-400 rounded hover:bg-purple-900 transition-colors"
          >
            {isPaused ? "RESUME" : "FREEZE"}
          </button>
        </div>

        {/* スライダー群 */}
        <div className="space-y-4">
          
          {/* 円盤サイズ (Event Horizon) スライダー */}
          <div className="flex items-center gap-4">
            <span className="text-xs w-16 text-gray-500">SIZE</span>
            <input 
              type="range" min="10" max="150" step="1" 
              value={horizonSize}
              onChange={(e) => setHorizonSize(Number(e.target.value))}
              className="flex-grow accent-purple-500 h-1 bg-gray-800 rounded appearance-none"
            />
            <span className="text-xs w-8 text-right text-purple-400">{horizonSize}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs w-16 text-gray-500">MATTER</span>
            <input 
              type="range" min="100" max="3000" step="100" 
              value={particleCount}
              onChange={(e) => {
                const count = Number(e.target.value);
                setParticleCount(count);
                if(canvasRef.current) initParticles(count, canvasRef.current.width, canvasRef.current.height);
              }}
              className="flex-grow accent-purple-500 h-1 bg-gray-800 rounded appearance-none"
            />
            <span className="text-xs w-8 text-right text-purple-400">{particleCount}</span>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-600 mt-6">
          DRAG TO PAN / SCROLL TO ZOOM / TAP TO INJECT
        </p>
      </div>
    </div>
  );
}