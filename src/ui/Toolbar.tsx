import { HEAT_GRADIENT_CSS } from '../scene/muscleTube'
import { useStore } from '../state/store'
import { Toggle } from './controls'

export function Toolbar() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
      <div className="pointer-events-auto flex flex-wrap gap-1.5 rounded-lg bg-slate-900/80 p-1.5 backdrop-blur">
        <Toggle label="Heat" checked={view.heat} onChange={(v) => setView({ heat: v })} title="Colour muscles by effort or stretch" />
        <Toggle label="Skin" checked={view.skin} onChange={(v) => setView({ skin: v })} />
        <Toggle label="Superficial" checked={view.superficial} onChange={(v) => setView({ superficial: v })} title="Outer muscle layer" />
        <Toggle label="Deep" checked={view.deep} onChange={(v) => setView({ deep: v })} title="Deep muscle layer" />
        <Toggle label="Bones" checked={view.bones} onChange={(v) => setView({ bones: v })} />
        <Toggle label="Labels" checked={view.labels} onChange={(v) => setView({ labels: v })} />
        <Toggle label="Forces" checked={view.forces} onChange={(v) => setView({ forces: v })} title="Floor reaction, load and centre of mass" />
        <Toggle label="Joint handles" checked={view.gizmos} onChange={(v) => setView({ gizmos: v })} title="Click a joint, then drag its rings" />
      </div>
      {view.heat && (
        <div className="pointer-events-auto rounded-lg bg-slate-900/80 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
          <div className="mb-1 h-2 w-44 rounded" style={{ background: HEAT_GRADIENT_CSS }} />
          <div className="flex justify-between">
            <span>relaxed</span>
            <span>working / stretched hard</span>
          </div>
        </div>
      )}
    </div>
  )
}
