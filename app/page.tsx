import Link from "next/link";

// 作品リストのデータ
const PROJECTS = [
  {
    id: "lumina",
    title: "LUMINA GRID(TENORAN)",
    description: "Web Tenori-On。光と音の連鎖を楽しむ、グリッドベースのインタラクティブ・シーケンサー。",
    href: "/lumina-grid", // フォルダ名と一致させる必要があります
    color: "from-cyan-400 to-blue-600", // 爽やかな光っぽい色にしました
    tags: ["Music", "Interactive", "Audio"],
  },
  {
    id: "blackhole",
    title: "GRAVITY SINGULARITY",
    description: "事象の地平線への物質の降着をシミュレート。重力レンズ効果と軌道力学の可視化。",
    href: "/blackhole",
    color: "from-purple-600 to-indigo-900", // 宇宙っぽい深い色
    tags: ["Physics", "Space", "Simulation"],
  },
  {
    id: "neural",
    title: "COLOR PREFERENCE AI",
    description: "R・G・Bのスライダーで色を作ると、AIがその色を「好き」か「嫌い」かで判定します。リロードで性格が変わります。",
    href: "/neural",
    color: "from-pink-500 to-blue-500",
    tags: ["AI", "Color", "Network"],
  },
  {
    id: "lsystem",
    title: "L-SYSTEM FRACTAL",
    description: "単純な文字の置換ルールから、複雑な植物の形状を生成するアルゴリズムの可視化。",
    href: "/lsystem",
    color: "from-yellow-400 to-orange-600",
    tags: ["Generative", "Fractal"],
  },
  {
    id: "life",
    title: "GAME OF LIFE",
    description: "コンウェイのライフゲーム。超高精細グリッドと有名パターンのプリセット再生。",
    href: "/life",
    color: "from-green-400 to-emerald-600",
    tags: ["Simulation", "ALife"],
  },
];

export default function HubPage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono selection:bg-white selection:text-black">
      {/* ヘッダーエリア */}
      <header className="p-8 border-b border-gray-900 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter mb-2">
            Roil's <span className="text-gray-500">Experiments</span>
          </h1>
          <p className="text-sm text-gray-400">
            Media Art Lab / FMS / HCI Research
          </p>
        </div>
        <div className="text-xs text-gray-600 hidden md:block">
          BUILT WITH NEXT.JS
        </div>
      </header>

      {/* メイングリッド */}
      <main className="p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PROJECTS.map((project) => (
            <Link
              key={project.id}
              href={project.href}
              className={`
                group relative block p-6 rounded-xl border border-gray-800 bg-gray-950/50 
                hover:border-gray-600 transition-all duration-300 hover:-translate-y-1 overflow-hidden
              `}
            >
              {/* 背景のグラデーション（ホバー時にふわっと光る） */}
              <div
                className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br ${project.color}`}
              />

              {/* カード内容 */}
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border border-gray-800 bg-black/50 text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <h2 className="text-xl font-bold mb-2 group-hover:text-white transition-colors text-gray-200">
                  {project.title}
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-8 flex-grow">
                  {project.description}
                </p>

                <div className="flex items-center text-xs font-bold text-gray-400 group-hover:text-white transition-colors">
                  LAUNCH PROJECT <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="fixed bottom-0 w-full p-4 border-t border-gray-900 bg-black/80 backdrop-blur text-center text-xs text-gray-700 pointer-events-none">
        © {new Date().getFullYear()} ROIL PORTFOLIO
      </footer>
    </div>
  );
}