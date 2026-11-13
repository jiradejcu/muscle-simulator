import { Scene } from './scene/Scene'
import { useStore } from './state/store'
import { LeftPanel } from './ui/LeftPanel'
import { RightPanel } from './ui/RightPanel'
import { ContextMenu } from './ui/ContextMenu'
import { LabelOverlay } from './ui/LabelOverlay'
import { Toolbar } from './ui/Toolbar'

export default function App() {
  const hovered = useStore((s) => s.hoveredMuscle)
  const muscles = useStore((s) => s.analysis.sim.muscleByKey)
  const h = hovered ? muscles[hovered] : null
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-slate-700/60 bg-slate-900 px-3 py-2 md:px-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[15px] font-semibold tracking-tight">Muscle Simulator</h1>
          <span className="hidden text-[12px] text-slate-400 sm:inline">What your muscles do in common exercise poses</span>
        </div>
        <div
          role="note"
          title="Based on simplified rules about stretch, load and joint position. It does not simulate real tissue and cannot diagnose anything."
          className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-[12px] text-amber-200"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 fill-amber-400">
            <path d="M10 2 1 18h18L10 2Zm-1 6h2v5H9V8Zm0 6h2v2H9v-2Z" />
          </svg>
          <span>
            <b className="font-semibold text-amber-100">Educational model, not a medical tool.</b> <span className="hidden sm:inline">If a pose causes pain, see a qualified professional.</span>
          </span>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <LeftPanel />
        <div className="sticky top-0 z-10 order-first h-[48svh] shrink-0 border-b border-slate-700/60 md:relative md:order-none md:h-auto md:min-w-0 md:flex-1 md:shrink md:border-b-0">
          <Scene />
          <LabelOverlay />
          <Toolbar />
          <ContextMenu />
          {h && (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-slate-900/85 px-3 py-1.5 text-[12px] text-slate-200 backdrop-blur">
              <b>{h.side === 'L' ? 'Left' : 'Right'} {h.def.name}</b> · effort {Math.round(h.activation * 100)}% · stretch {Math.round(Math.max(0, h.stretch) * 100)}%
            </div>
          )}
          <div className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-slate-500 md:hidden">Drag to orbit · pinch to zoom · tap a muscle</div>
          <div className="pointer-events-none absolute bottom-3 right-3 hidden text-[11px] text-slate-500 md:block">Middle-drag orbit (or Alt+left) · Shift+middle pan · scroll zoom · right-click menu · 1/3/7 views, Home frame</div>
        </div>
        <RightPanel />
      </main>
    </div>
  )
}
