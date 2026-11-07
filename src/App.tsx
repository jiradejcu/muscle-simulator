import { Scene } from './scene/Scene'
import { useStore } from './state/store'
import { LeftPanel } from './ui/LeftPanel'
import { RightPanel } from './ui/RightPanel'
import { LabelOverlay } from './ui/LabelOverlay'
import { Toolbar } from './ui/Toolbar'

export default function App() {
  const hovered = useStore((s) => s.hoveredMuscle)
  const muscles = useStore((s) => s.analysis.sim.muscleByKey)
  const h = hovered ? muscles[hovered] : null
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-700/60 bg-slate-900 px-4 py-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[15px] font-semibold tracking-tight">Muscle Simulator</h1>
          <span className="text-[12px] text-slate-400">What your muscles do in common exercise poses</span>
        </div>
        <span className="text-[11px] text-slate-500">Educational model, not a medical tool. Based on simplified rules about stretch, load and joint position.</span>
      </header>
      <main className="flex min-h-0 flex-1">
        <LeftPanel />
        <div className="relative min-w-0 flex-1">
          <Scene />
          <LabelOverlay />
          <Toolbar />
          {h && (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-slate-900/85 px-3 py-1.5 text-[12px] text-slate-200 backdrop-blur">
              <b>{h.side === 'L' ? 'Left' : 'Right'} {h.def.name}</b> · effort {Math.round(h.activation * 100)}% · stretch {Math.round(Math.max(0, h.stretch) * 100)}%
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 right-3 text-[11px] text-slate-500">Drag to orbit · scroll to zoom · right-drag to pan</div>
        </div>
        <RightPanel />
      </main>
    </div>
  )
}
