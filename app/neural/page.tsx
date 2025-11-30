"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// --- 設定 ---
// 層の構成: 入力3個(RGB) -> 中間4個(脳) -> 出力2個(好き嫌い)
const LAYER_CONFIG = [3, 4, 2];

// 入力ラベル
const INPUT_LABELS = ["R", "G", "B"];
const INPUT_COLORS = ["#ef4444", "#22c55e", "#3b82f6"]; // 赤, 緑, 青

// 出力ラベル
const OUTPUT_LABELS = ["好き！", "嫌い..."];

export default function NeuralNetworkArt() {
  // 入力値: 0 〜 255 (RGB)
  const [inputs, setInputs] = useState<number[]>([128, 128, 128]);
  
  // 重み: -1.0 〜 1.0
  const [weights, setWeights] = useState<number[][][]>([]);
  // 活性化値
  const [activations, setActivations] = useState<number[][]>([]);
  
  // 決定したテキスト
  const [decision, setDecision] = useState<string>("???");

  // --- 1. 初期化（ランダムな性格の脳を作る） ---
  useEffect(() => {
    const newWeights: number[][][] = [];
    for (let i = 0; i < LAYER_CONFIG.length - 1; i++) {
      const layerWeights: number[][] = [];
      const currentLayerSize = LAYER_CONFIG[i];
      const nextLayerSize = LAYER_CONFIG[i + 1];
      for (let j = 0; j < currentLayerSize; j++) {
        const neuronWeights: number[] = [];
        for (let k = 0; k < nextLayerSize; k++) {
          neuronWeights.push(Math.random() * 2 - 1); 
        }
        layerWeights.push(neuronWeights);
      }
      newWeights.push(layerWeights);
    }
    setWeights(newWeights);
  }, []);

  // --- 2. 思考プロセス ---
  useEffect(() => {
    if (weights.length === 0) return;

    // 入力を 0.0 〜 1.0 に正規化してネットワークに入れる
    let currentValues = inputs.map(v => v / 255.0);
    const newActivations = [currentValues]; 

    // 層ごとの計算
    for (let i = 0; i < weights.length; i++) {
      const nextValues = new Array(LAYER_CONFIG[i + 1]).fill(0);
      
      for (let j = 0; j < currentValues.length; j++) {
        for (let k = 0; k < nextValues.length; k++) {
          nextValues[k] += currentValues[j] * weights[i][j][k];
        }
      }

      currentValues = nextValues.map(v => Math.tanh(v));
      newActivations.push(currentValues);
    }

    setActivations(newActivations);

    // 最終決定
    const finalOutputs = newActivations[newActivations.length - 1];
    if (finalOutputs[0] > finalOutputs[1]) {
        setDecision(OUTPUT_LABELS[0]);
    } else {
        setDecision(OUTPUT_LABELS[1]);
    }

  }, [inputs, weights]);

  // スライダー変更ハンドラ
  const handleSliderChange = (index: number, value: number) => {
    const newInputs = [...inputs];
    newInputs[index] = value;
    setInputs(newInputs);
  };

  // 画面サイズ設定
  const width = 350;
  const height = 300;
  const layerGap = width / (LAYER_CONFIG.length + 0.5);

  // 現在の色（CSS用文字列）
  const currentColor = `rgb(${inputs[0]}, ${inputs[1]}, ${inputs[2]})`;

  return (
    <div className="fixed inset-0 h-[100dvh] w-full bg-black flex flex-col items-center justify-between touch-none overflow-hidden font-mono text-white transition-colors duration-500">
      
      {/* 戻るボタン */}
      <Link href="/" className="absolute top-4 left-4 z-50 px-3 py-1 bg-black/50 backdrop-blur border border-white/20 text-xs hover:bg-white/10 transition-colors text-white/70">
        ← HUB
      </Link>

      {/* ヘッダー */}
      <div className="pt-12 pb-2 text-center z-10">
        <h1 className="text-xl tracking-widest font-bold mb-1 drop-shadow-md">COLOR PREFERENCE AI</h1>
        <p className="text-[10px] text-white/60">DOES AI LIKE THIS COLOR?</p>
      </div>

      {/* メインビジュアルエリア */}
      <div className="flex-grow flex items-center justify-center w-full relative">
        {/* 背景の装飾：現在の色を反映 */}
        <div 
            className="absolute inset-0 transition-colors duration-100 ease-linear"
            style={{
                background: `radial-gradient(circle at center, ${currentColor} 0%, transparent 70%)`,
                opacity: 0.3
            }}
        />

        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="max-w-md mx-auto overflow-visible relative z-10">
          {weights.length > 0 && activations.length > 0 && weights.map((layer, lIndex) => {
            const x1 = (lIndex * layerGap) + 50;
            const x2 = ((lIndex + 1) * layerGap) + 50;
            
            return layer.map((neuron, nIndex) => {
              const y1 = (height / (LAYER_CONFIG[lIndex] + 1)) * (nIndex + 1);
              const sourceActivation = activations[lIndex][nIndex];

              return neuron.map((weight, nextNIndex) => {
                const y2 = (height / (LAYER_CONFIG[lIndex + 1] + 1)) * (nextNIndex + 1);
                
                const isPositiveWeight = weight > 0;
                // 重みが正なら白、負なら黒っぽい色（背景が明るくなる可能性があるので調整）
                const color = isPositiveWeight ? "white" : "#444"; 

                const baseThickness = Math.abs(weight) * 2;
                const flowStrength = Math.abs(sourceActivation * weight);
                const activeThickness = flowStrength * 8; 
                const finalThickness = Math.max(1, baseThickness + activeThickness);
                const opacity = Math.min(1, 0.2 + flowStrength * 0.8);

                return (
                  <line
                    key={`${lIndex}-${nIndex}-${nextNIndex}`}
                    x1={x1} y1={y1}
                    x2={x2} y2={y2}
                    stroke={color}
                    strokeWidth={finalThickness}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                    className="transition-all duration-100"
                  />
                );
              });
            });
          })}

          {activations.map((layer, lIndex) => {
            const x = (lIndex * layerGap) + 50;
            return layer.map((val, nIndex) => {
              const y = (height / (LAYER_CONFIG[lIndex] + 1)) * (nIndex + 1);
              const intensity = Math.abs(val);
              
              const isOutputLayer = lIndex === activations.length - 1;
              const isWinner = isOutputLayer && (
                  (nIndex === 0 && val > layer[1]) || (nIndex === 1 && val > layer[0])
              );

              return (
                <g key={`node-${lIndex}-${nIndex}`}>
                  {/* ラベル表示 */}
                  {lIndex === 0 && (
                    <text x={x - 20} y={y + 4} textAnchor="end" fill={INPUT_COLORS[nIndex]} fontSize="12" fontWeight="bold">
                      {INPUT_LABELS[nIndex]}
                    </text>
                  )}
                  {lIndex === activations.length - 1 && (
                    <text x={x + 25} y={y + 4} textAnchor="start" fill={isWinner ? "white" : "gray"} fontSize="14" fontWeight="bold">
                      {OUTPUT_LABELS[nIndex]}
                    </text>
                  )}

                  <circle
                    cx={x} cy={y}
                    r={intensity * 12 + (isWinner ? 12 : 6)}
                    fill="white"
                    opacity={0.4}
                    className="blur-sm transition-all duration-100"
                  />
                  <circle
                    cx={x} cy={y}
                    // 入力層は値に応じてサイズを変える
                    r={lIndex === 0 ? (inputs[nIndex] / 255 * 8 + 2) : 4}
                    fill={lIndex === 0 ? INPUT_COLORS[nIndex] : (val > 0 ? "white" : "#555")}
                    className="transition-all duration-100"
                  />
                </g>
              );
            });
          })}
        </svg>
      </div>

      {/* コントロールパネル */}
      <div className="w-full bg-gray-900/80 backdrop-blur border-t border-white/10 p-6 pb-10 rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.5)] z-20">
        
        {/* 結果表示 */}
        <div className="text-center mb-6 flex items-center justify-center gap-4">
            <div 
                className="w-12 h-12 rounded-full border-2 border-white/20 shadow-lg transition-colors duration-100"
                style={{ backgroundColor: currentColor }}
            />
            <div className="text-left">
                <span className="text-[10px] text-gray-400 block tracking-wider">AI DECISION</span>
                <div className={`text-3xl font-bold tracking-widest ${decision === OUTPUT_LABELS[0] ? "text-pink-400 drop-shadow-[0_0_10px_rgba(244,114,182,0.8)]" : "text-blue-400"}`}>
                    {decision}
                </div>
            </div>
        </div>

        {/* スライダー入力 */}
        <div className="space-y-4 max-w-xs mx-auto">
          {INPUT_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-3">
                <span className="w-4 text-xs font-bold" style={{ color: INPUT_COLORS[i] }}>{label}</span>
                <input
                    type="range"
                    min="0"
                    max="255"
                    value={inputs[i]}
                    onChange={(e) => handleSliderChange(i, parseInt(e.target.value))}
                    className="flex-grow h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
                    style={{
                        accentColor: INPUT_COLORS[i]
                    }}
                />
                <span className="w-8 text-xs text-right text-gray-400 font-mono">{inputs[i]}</span>
            </div>
          ))}
        </div>
        
        <div className="mt-6 text-center">
            <button 
                onClick={() => window.location.reload()} 
                className="text-[10px] text-gray-500 underline hover:text-white transition-colors"
            >
                AIの性格を変える (RESET)
            </button>
        </div>
      </div>
    </div>
  );
}