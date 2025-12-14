'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// --- Safe Icons (No change in logic, just memoized for slight perf gain) ---
const PlayIcon = React.memo(() => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M8 5v14l11-7z" />
  </svg>
));

const PauseIcon = React.memo(() => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
));

const TrashIcon = React.memo(() => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
));

// --- Constants (Frozen for immutability) ---
const CONSTANTS = Object.freeze({
  ROWS: 16,
  COLS: 16,
  DEFAULT_BPM: 120,
  BASE_FREQ: 174.61,
  MAX_EFFECTS: 150, // 安全装置: 描画負荷によるクラッシュ防止
  MIN_BPM: 60,
  MAX_BPM: 240,
  FLOOR_Y: 15.5
});

// Pentatonic Scale
const PENTATONIC_RATIOS = [
  4.0, 3.367, 3.0, 2.667, 2.378, 2.0, 1.683, 1.5,
  1.333, 1.189, 1.0, 0.841, 0.75, 0.667, 0.595, 0.5
];

// Layer Configurations
const LAYERS_CONFIG = [
  { id: 0, name: 'LEAD', type: 'sine', color: '#60a5fa', baseOctave: 0 },
  { id: 1, name: 'BASS', type: 'triangle', color: '#34d399', baseOctave: -1 },
  { id: 2, name: 'DRUM', type: 'drum', color: '#f472b6', baseOctave: 0 },
  { id: 3, name: 'CHRD', type: 'square', color: '#fbbf24', baseOctave: -0.5 }
];

const EFFECT_TYPES = ['RIPPLE', 'GRAVITY', 'SPLASH', 'STAR'];

// --- Audio Engine (Enhanced Robustness) ---
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.isInitialized = false;
  }

  // 安全な初期化: 何度呼んでも安全、SSR環境対応
  init() {
    if (typeof window === 'undefined') return;

    try {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
          console.warn('Web Audio API is not supported in this browser.');
          return;
        }
        this.ctx = new AudioContext();

        // ダイナミクスコンプレッサー（音割れ防止・聴覚保護）
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.4; // 初期マスターボリューム

        // チェーン接続: MasterGain -> Compressor -> Destination
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        this.isInitialized = true;
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(err => console.error('Audio resume failed:', err));
      }
    } catch (e) {
      console.error('AudioEngine initialization error:', e);
    }
  }

  // リソースの破棄
  dispose() {
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {
        // ignore close errors
      }
      this.ctx = null;
      this.isInitialized = false;
    }
  }

  // 安全な現在時刻取得
  get currentTime() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  playDrum(row, rawVolume = 0.8) {
    if (!this.ctx || !this.isInitialized) return;

    try {
      // Volumeのサニタイズ (0.0 ~ 1.0)
      const volume = Math.max(0, Math.min(1, rawVolume));
      const now = this.ctx.currentTime;

      const master = this.ctx.createGain();
      master.gain.value = volume;
      master.connect(this.masterGain);

      // --- Kick ---
      if (row >= 12) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);

        gain.gain.setValueAtTime(1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 0.51); // 余分なマージンを持たせてstop
      }
      // --- Snare ---
      else if (row >= 8) {
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'bandpass';
        filter.frequency.value = 1000;

        noiseGain.gain.setValueAtTime(1, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(master);
        noise.start(now);
      }
      // --- Hi-Hat ---
      else {
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        noise.start(now);
      }
    } catch (e) {
      console.warn('Audio synthesis error (Drum):', e);
    }
  }

  playTone(row, layerType, baseOctave = 0, rawVolume = 0.8) {
    if (!this.ctx || !this.isInitialized) return;

    // Volumeサニタイズ
    const volume = Math.max(0, Math.min(1, rawVolume));

    if (layerType === 'drum') {
      this.playDrum(row, volume);
      return;
    }

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // 安全な波形タイプ設定
      const safeType = ['sine', 'square', 'sawtooth', 'triangle'].includes(layerType) ? layerType : 'sine';
      osc.type = safeType;

      // 周波数計算（undefined対策）
      const ratio = PENTATONIC_RATIOS[row] !== undefined ? PENTATONIC_RATIOS[row] : 1.0;
      let freq = CONSTANTS.BASE_FREQ * ratio;
      if (baseOctave !== 0) freq = freq * Math.pow(2, baseOctave);

      // ナイキスト周波数チェック（念の為）
      if (freq > this.ctx.sampleRate / 2) freq = this.ctx.sampleRate / 2;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const now = this.ctx.currentTime;
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);

      // エンベロープ処理（クリックノイズ除去のため、0からの立ち上がりを明示）
      let duration = 0.6;
      gain.gain.setValueAtTime(0, now);

      if (layerType === 'square') {
        gain.gain.linearRampToValueAtTime(0.3 * volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        duration = 0.4;
      } else if (layerType === 'triangle') {
        gain.gain.linearRampToValueAtTime(0.5 * volume, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        duration = 0.9;
      } else {
        gain.gain.linearRampToValueAtTime(0.6 * volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        duration = 0.6;
      }

      // 完全に音が消えてからStop
      osc.stop(now + duration + 0.05);
    } catch (e) {
      console.warn('Audio synthesis error (Tone):', e);
    }
  }
}

export default function TenoriOn() {
  // --- Refs ---
  // AudioEngineをRefで保持し、再レンダリング間の永続性を確保
  const engineRef = useRef(null);
  const getEngine = () => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    return engineRef.current;
  };

  // --- State ---
  const [grids, setGrids] = useState(() =>
    LAYERS_CONFIG.map(() => Array(CONSTANTS.ROWS).fill().map(() => Array(CONSTANTS.COLS).fill(false)))
  );

  const [layerEffects, setLayerEffects] = useState(['RIPPLE', 'GRAVITY', 'SPLASH', 'STAR']);
  const [layerVolumes, setLayerVolumes] = useState([0.8, 0.8, 0.8, 0.8]);

  const [activeLayerIdx, setActiveLayerIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCol, setCurrentCol] = useState(-1);
  const [bpm, setBpm] = useState(CONSTANTS.DEFAULT_BPM);
  const [isMouseDown, setIsMouseDown] = useState(false);

  // エフェクト配列。メモリ管理のため上限を設ける
  const [effects, setEffects] = useState([]);

  // Refs for logic that doesn't need to trigger render immediately or needs access inside callbacks
  const lastTouchedRef = useRef(null);
  const requestRef = useRef(null);

  const activeLayerConfig = LAYERS_CONFIG[activeLayerIdx] || LAYERS_CONFIG[0]; // fallback safety

  // --- Handlers ---

  const handleStart = () => {
    const engine = getEngine();
    engine.init();
    setIsPlaying(prev => !prev);
  };

  const handleClear = () => {
    setGrids(prev => {
      const newGrids = [...prev];
      if (newGrids[activeLayerIdx]) {
        newGrids[activeLayerIdx] = Array(CONSTANTS.ROWS).fill().map(() => Array(CONSTANTS.COLS).fill(false));
      }
      return newGrids;
    });
  };

  const changeLayerEffect = (newEffect) => {
    setLayerEffects(prev => {
      const newEffects = [...prev];
      if (activeLayerIdx >= 0 && activeLayerIdx < newEffects.length) {
        newEffects[activeLayerIdx] = newEffect;
      }
      return newEffects;
    });
  };

  const handleVolumeChange = (newVol) => {
    // 値のクランプ (0-1)
    const clampedVol = Math.max(0, Math.min(1, newVol));
    setLayerVolumes(prev => {
      const newVols = [...prev];
      if (activeLayerIdx >= 0 && activeLayerIdx < newVols.length) {
        newVols[activeLayerIdx] = clampedVol;
      }
      return newVols;
    });
  };

  const handleBpmChange = (e) => {
    const val = Number(e.target.value);
    setBpm(Math.max(CONSTANTS.MIN_BPM, Math.min(CONSTANTS.MAX_BPM, val)));
  };

  // --- Visual Physics Loop ---

  useEffect(() => {
    const updatePhysics = () => {
      setEffects(prevEffects => {
        if (prevEffects.length === 0) return prevEffects;

        const now = Date.now();
        const activeEffects = [];

        // 処理上限: 古いエフェクトは強制削除 (スパムクリック対策)
        const startIndex = Math.max(0, prevEffects.length - CONSTANTS.MAX_EFFECTS);
        const processingEffects = prevEffects.slice(startIndex);

        for (const eff of processingEffects) {
          let keep = true;
          let updatedEff = { ...eff };

          if (eff.type === 'GRAVITY') {
            const g = 0.025;
            updatedEff.y += updatedEff.dy;
            updatedEff.dy += g;

            if (updatedEff.y > CONSTANTS.FLOOR_Y) {
              updatedEff.y = CONSTANTS.FLOOR_Y;
              // Bounce height check
              const height = CONSTANTS.FLOOR_Y - eff.r;
              // Prevent NaN
              const bounceVelocity = height > 0 ? -Math.sqrt(2 * g * height) : 0;
              updatedEff.dy = bounceVelocity;
            }
            // Stop condition
            if (updatedEff.dy < 0 && updatedEff.dy > -0.05 && Math.abs(updatedEff.y - CONSTANTS.FLOOR_Y) < 0.1) {
              keep = false;
            }
            if (now - eff.startTime > 3000) keep = false;
          }
          else if (eff.type === 'SPLASH') {
            updatedEff.particles = eff.particles.map(p => ({
              r: p.r + p.dr,
              c: p.c + p.dc,
              dr: p.dr + 0.005,
              life: p.life - 0.02,
              scale: p.scale * 0.95,
              ...p // keep original props if needed
            })).filter(p => p.life > 0);

            if (updatedEff.particles.length === 0) keep = false;
          }
          else {
            const lifeTime = 600;
            if (now - eff.startTime > lifeTime) keep = false;
          }

          if (keep) activeEffects.push(updatedEff);
        }

        return activeEffects;
      });

      requestRef.current = requestAnimationFrame(updatePhysics);
    };

    if (effects.length > 0) {
      requestRef.current = requestAnimationFrame(updatePhysics);
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [effects.length]); // effects.length changes trigger restart of loop, which is fine

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (engineRef.current) engineRef.current.dispose();
    };
  }, []);

  const addVisualEffect = useCallback((r, c, type, layerColor, layerIdx) => {
    // パフォーマンスガード: 同時エフェクト数が多すぎる場合は追加しない
    setEffects(prev => {
      if (prev.length >= CONSTANTS.MAX_EFFECTS) return prev;

      const id = Math.random();
      let newEffect = { id, type, r, c, startTime: Date.now(), color: layerColor, layerIdx };

      if (type === 'GRAVITY') {
        newEffect = { ...newEffect, y: r, dy: 0 };
      } else if (type === 'SPLASH') {
        const particles = [];
        // パーティクル数も控えめに
        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
          const angle = (Math.PI * 2 * i) / particleCount;
          const speed = 0.1 + Math.random() * 0.3;
          particles.push({
            r: 0, c: 0,
            dr: Math.sin(angle) * speed,
            dc: Math.cos(angle) * speed,
            life: 1.0,
            scale: 1.0 + Math.random()
          });
        }
        newEffect.particles = particles;
      }
      return [...prev, newEffect];
    });
  }, []);

  // --- Sequencer Loop ---
  useEffect(() => {
    let intervalId;

    if (isPlaying) {
      // 安全策: BPMが0や負の場合の除算エラー防止
      const safeBpm = Math.max(1, bpm);
      const msPerBeat = (60 * 1000) / safeBpm / 4;

      intervalId = setInterval(() => {
        setCurrentCol((prev) => {
          const nextCol = (prev + 1) % CONSTANTS.COLS;
          const engine = getEngine();

          // Batch grid processing
          LAYERS_CONFIG.forEach((layer, idx) => {
            // Grid boundary check
            const layerGrid = grids[idx];
            if (!layerGrid) return;

            for (let r = 0; r < CONSTANTS.ROWS; r++) {
              if (layerGrid[r] && layerGrid[r][nextCol]) {
                const volume = layerVolumes[idx] !== undefined ? layerVolumes[idx] : 0.8;
                engine.playTone(r, layer.type, layer.baseOctave, volume);

                const effectType = layerEffects[idx];
                addVisualEffect(r, nextCol, effectType, layer.color, idx);
              }
            }
          });
          return nextCol;
        });
      }, msPerBeat);
    } else {
      setCurrentCol(-1);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying, bpm, grids, layerEffects, layerVolumes, addVisualEffect]);

  // --- Input Handlers ---
  const handleMouseDown = () => {
    setIsMouseDown(true);
    lastTouchedRef.current = null;
    getEngine().init(); // User interaction trigger
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    lastTouchedRef.current = null;
  };

  const toggleCell = (r, c) => {
    if (!grids[activeLayerIdx]) return; // safety

    setGrids((prev) => {
      const newGrids = [...prev];
      // Defensive copy
      if (newGrids[activeLayerIdx]) {
        const newLayer = newGrids[activeLayerIdx].map(row => [...row]);
        if (newLayer[r] !== undefined) {
          newLayer[r][c] = !newLayer[r][c];
          newGrids[activeLayerIdx] = newLayer;
        }
      }
      return newGrids;
    });
    lastTouchedRef.current = { r, c };
  };

  const handleMouseEnter = (r, c) => {
    if (isMouseDown) {
      if (lastTouchedRef.current && lastTouchedRef.current.r === r && lastTouchedRef.current.c === c) return;

      setGrids((prev) => {
        const newGrids = [...prev];
        if (!newGrids[activeLayerIdx]) return prev;

        const currentVal = newGrids[activeLayerIdx][r]?.[c];
        if (currentVal === false) { // Only activate if currently inactive
          const newLayer = newGrids[activeLayerIdx].map(row => [...row]);
          newLayer[r][c] = true;
          newGrids[activeLayerIdx] = newLayer;
        }
        return newGrids;
      });
      lastTouchedRef.current = { r, c };
    }
  };

  const handleTouchMove = useCallback((e) => {
    // Passive listener warning prevention happens in React usually, but preventDefault is needed for UI logic
    if (e.cancelable && e.target && e.target.closest('.grid-container')) {
      e.preventDefault();
    }

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    if (element && element.dataset.row && element.dataset.col) {
      const r = parseInt(element.dataset.row, 10);
      const c = parseInt(element.dataset.col, 10);

      if (isNaN(r) || isNaN(c)) return;

      if (lastTouchedRef.current && lastTouchedRef.current.r === r && lastTouchedRef.current.c === c) return;

      setGrids((prev) => {
        const newGrids = [...prev];
        if (!newGrids[activeLayerIdx]) return prev;

        const currentVal = newGrids[activeLayerIdx][r]?.[c];
        if (currentVal === false) {
          const newLayer = newGrids[activeLayerIdx].map(row => [...row]);
          newLayer[r][c] = true;
          newGrids[activeLayerIdx] = newLayer;
          return newGrids;
        }
        return prev;
      });
      lastTouchedRef.current = { r, c };
    }
  }, [activeLayerIdx]); // grids removed from dependency to prevent lag, relying on functional state update

  // --- Rendering Helpers (Memoized for performance) ---

  const getCellBrightness = (r, c) => {
    let brightness = 0;
    const now = Date.now();

    // Performance: Loop only through relevant effects (reversed to prioritize new ones if we break early, but we sum here)
    for (let i = effects.length - 1; i >= 0; i--) {
      const eff = effects[i];
      if (eff.layerIdx !== activeLayerIdx) continue;

      // Simple distance check to skip expensive calculations for far-away effects
      if (Math.abs(eff.r - r) > 8 && Math.abs(eff.c - c) > 8 && eff.type !== 'SPLASH') continue;

      if (eff.type === 'RIPPLE') {
        const timeDelta = now - eff.startTime;
        const radius = timeDelta * 0.012;
        const dist = Math.max(Math.abs(r - eff.r), Math.abs(c - eff.c));
        const distDiff = Math.abs(dist - radius);
        if (distDiff < 1.0) brightness += ((1.0 - distDiff) * (1 - timeDelta / 600));
      }
      else if (eff.type === 'GRAVITY') {
        const distY = Math.abs(r - eff.y);
        const distX = Math.abs(c - eff.c);
        if (distX === 0 && distY < 0.8) brightness += (1.0 - distY);
        if (distX === 0 && r < eff.y && r >= eff.r) brightness += 0.1;
      }
      else if (eff.type === 'SPLASH') {
        eff.particles.forEach(p => {
          const particleR = eff.r + p.r;
          const particleC = eff.c + p.c;
          // Optimize distance calc
          const dr = r - particleR;
          const dc = c - particleC;
          if (Math.abs(dr) > 1 || Math.abs(dc) > 1) return; // bounding box check

          const dist = Math.sqrt(dr * dr + dc * dc);
          const size = 0.5 * p.scale;
          if (dist < size) brightness += (1.0 - dist / size) * p.life;
        });
      }
      else if (eff.type === 'STAR') {
        const timeDelta = now - eff.startTime;
        const life = 1 - timeDelta / 600;
        if (life > 0) {
          const distR = Math.abs(r - eff.r);
          const distC = Math.abs(c - eff.c);
          if ((distR === 0 && distC < 4) || (distC === 0 && distR < 4)) {
            const dist = Math.max(distR, distC);
            brightness += (1 - dist / 4) * life;
          }
          if (distR === distC && distR < 3) brightness += (1 - distR / 3) * life * 0.7;
        }
      }
      if (brightness >= 1) break; // Clamp early
    }
    return Math.min(1, brightness);
  };

  return (
    <div className="h-[100dvh] w-full bg-neutral-900 flex flex-col items-center overflow-hidden font-sans text-white select-none touch-none">

      {/* Header */}
      <div className="h-10 md:h-12 flex items-center justify-center shrink-0 w-full bg-neutral-900/80 z-20">
        <h1 className="text-sm md:text-lg font-light tracking-[0.3em] text-gray-400">LUMINA GRID</h1>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full min-h-0 flex flex-col lg:flex-row items-center justify-center p-2 md:p-4 gap-2 lg:gap-8">

        {/* --- Grid Container --- */}
        <div className="flex-1 w-full relative min-h-0 grid-container">
          <div
            className="absolute inset-0 m-auto aspect-square w-auto h-auto max-w-full max-h-full bg-gradient-to-br from-gray-300 to-gray-500 p-2 md:p-3 rounded-[2rem] shadow-2xl border border-gray-600"
            style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 2px 5px rgba(255,255,255,0.3)' }}
          >
            <div
              className="w-full h-full bg-black rounded-2xl border-4 border-gray-800 shadow-inner relative overflow-hidden"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
              onTouchMove={handleTouchMove}
            >
              <div className="w-full h-full grid grid-cols-16 gap-px bg-gray-900">
                {grids[activeLayerIdx]?.map((row, r) => (
                  row.map((active, c) => {
                    const isScannerHere = currentCol === c;
                    // Calculate brightness only if needed for render
                    const brightness = getCellBrightness(r, c);
                    const displaced = effects.some(eff => eff.layerIdx === activeLayerIdx && eff.type === 'GRAVITY' && eff.r === r && eff.c === c);

                    let bg = 'bg-gray-800 opacity-30';
                    let shadow = 'none';
                    let opacity = 0.3;
                    const effectActive = brightness > 0.01;

                    if (displaced && active) {
                      bg = 'transparent';
                      opacity = 0;
                    } else if (active) {
                      opacity = 1;
                      if (isScannerHere) {
                        bg = 'bg-white';
                        shadow = '0 0 20px 5px rgba(255, 255, 255, 0.9)';
                      } else {
                        bg = 'bg-gray-200';
                        shadow = `0 0 8px 1px ${activeLayerConfig.color}80`;
                      }
                    } else if (isScannerHere) {
                      bg = 'bg-gray-700 opacity-50';
                      opacity = 0.5;
                    }

                    const style = {
                      opacity: displaced ? Math.max(0, brightness) : active ? 1 : Math.max(opacity, brightness),
                      transform: active && isScannerHere ? 'scale(1.1)' : 'scale(1)',
                      backgroundColor: (displaced || !active) && effectActive
                        ? `rgba(255,255,255,${brightness})`
                        : bg === 'transparent' ? undefined : undefined,
                      ...(active && !displaced ? { backgroundColor: isScannerHere ? 'white' : activeLayerConfig.color } : {}),
                      boxShadow: active && !displaced
                        ? shadow
                        : (effectActive ? `0 0 10px ${brightness * 4}px rgba(255,255,255,${brightness * 0.6})` : undefined),
                      ...(!active && !effectActive ? { backgroundColor: isScannerHere ? 'rgb(55 65 81)' : 'rgb(31 41 55)' } : {})
                    };

                    return (
                      <div
                        key={`${r}-${c}`}
                        className="relative flex items-center justify-center cursor-pointer"
                        onMouseDown={() => toggleCell(r, c)}
                        onMouseEnter={() => handleMouseEnter(r, c)}
                        data-row={r}
                        data-col={c}
                      >
                        <div className={`w-[85%] h-[85%] rounded-full transition-transform duration-75 relative z-10 pointer-events-none`} style={style}></div>
                      </div>
                    );
                  })
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* --- Controls Container --- */}
        <div className="shrink-0 z-10 w-full lg:w-64 flex flex-row lg:flex-col gap-2 lg:gap-4 justify-between lg:justify-center bg-gray-900/50 p-2 lg:bg-transparent">

          {/* Playback Controls */}
          <div className="flex-1 lg:flex-none flex flex-row lg:flex-col items-center justify-between bg-gray-800 p-2 lg:p-4 rounded-xl lg:rounded-2xl border border-gray-700 gap-2 lg:gap-4 shadow-lg">
            <button
              onClick={handleStart}
              aria-label={isPlaying ? "Pause" : "Play"}
              className={`w-12 h-12 lg:w-20 lg:h-20 flex items-center justify-center rounded-full border-2 lg:border-4 transition-all active:scale-95 shadow-xl
                      ${isPlaying
                  ? 'bg-orange-500/20 border-orange-500 text-orange-500 shadow-orange-500/20'
                  : 'bg-gray-700 border-gray-500 text-gray-400 hover:border-white hover:text-white'}`}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            <div className="flex flex-col items-center gap-1 w-24 lg:w-full">
              <span className="text-[10px] lg:text-xs font-bold text-gray-500 tracking-wider">BPM {bpm}</span>
              <input
                type="range"
                min={CONSTANTS.MIN_BPM}
                max={CONSTANTS.MAX_BPM}
                value={bpm}
                onChange={handleBpmChange}
                className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-white"
                aria-label="BPM Control"
              />
            </div>

            <button
              onClick={handleClear}
              aria-label="Clear Grid"
              className="w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center rounded-full bg-gray-700 border border-gray-600 text-gray-400 hover:bg-red-900/50 hover:text-red-400 hover:border-red-400 transition-colors active:scale-95"
            >
              <TrashIcon />
            </button>
          </div>

          {/* Layer & Effect Controls */}
          <div className="flex-[2] lg:flex-none flex flex-col gap-2">
            <div className="bg-gray-800 p-1.5 lg:p-2 rounded-xl lg:rounded-2xl border border-gray-700 h-full lg:h-auto flex flex-col justify-center">
              <div className="flex lg:flex-col gap-1.5 lg:gap-2 h-full">
                {LAYERS_CONFIG.map((layer, idx) => (
                  <button
                    key={layer.id}
                    onClick={() => setActiveLayerIdx(idx)}
                    className={`
                                  flex-1 lg:h-12 rounded-lg lg:rounded-xl flex lg:flex-row flex-col items-center justify-center lg:justify-between px-1 lg:px-3 transition-all border
                                  ${activeLayerIdx === idx
                        ? 'bg-gray-700 border-white shadow-lg scale-[1.02]'
                        : 'bg-gray-900/50 border-gray-700 opacity-60 hover:opacity-100'}
                              `}
                    style={{ borderColor: activeLayerIdx === idx ? layer.color : undefined }}
                    aria-label={`Select ${layer.name} Layer`}
                  >
                    <div className="flex items-center gap-1 lg:gap-2">
                      <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full shadow-[0_0_8px]`} style={{ backgroundColor: layer.color, boxShadow: `0 0 10px ${layer.color}` }}></div>
                      <span className="text-[9px] lg:text-xs font-bold tracking-wider hidden sm:inline" style={{ color: activeLayerIdx === idx ? 'white' : '#aaa' }}>{layer.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Panel: Effect & Volume */}
            <div className="w-full py-2 bg-gray-800 border border-gray-700 rounded-xl flex flex-col px-3 gap-2 h-full lg:h-auto justify-center">

              {/* Effect Select */}
              <div className="flex flex-col gap-1">
                <span className="text-[8px] text-gray-500 font-bold tracking-widest text-center">EFFECT</span>
                <div className="grid grid-cols-4 gap-1">
                  {EFFECT_TYPES.map(type => {
                    const isActive = layerEffects[activeLayerIdx] === type;
                    return (
                      <button
                        key={type}
                        onClick={() => changeLayerEffect(type)}
                        className={`
                                    rounded text-[8px] font-bold py-1
                                    ${isActive
                            ? 'bg-gray-200 text-black shadow-inner scale-95'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'}
                                `}
                      >
                        {type}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Layer Volume Control */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between items-center text-[8px] font-bold text-gray-500 tracking-widest">
                  <span>LAYER VOL</span>
                  <span>{Math.round((layerVolumes[activeLayerIdx] || 0) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={layerVolumes[activeLayerIdx] || 0}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-white"
                  aria-label="Layer Volume"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}