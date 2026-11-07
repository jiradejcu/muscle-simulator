import { useEffect, useRef, type ReactNode } from 'react'
import { Box3, Vector3 } from 'three'
import { pathLength } from '../engine/musclePath'
import { cameraActions, type ViewName } from '../scene/cameraActions'
import { useStore } from '../state/store'

/** Bounding box of all strands of a muscle in the current pose. */
function muscleBounds(key: string): { centre: Vector3; radius: number } {
  const { model, analysis } = useStore.getState()
  const box = new Box3()
  for (const s of model) {
    if (s.muscleKey !== key) continue
    const pts: Vector3[] = []
    pathLength(analysis.sim.pose, s.nodes, pts)
    for (const p of pts) box.expandByPoint(p)
  }
  return { centre: box.getCenter(new Vector3()), radius: Math.max(0.12, box.getSize(new Vector3()).length() / 2) }
}

const VIEWS: { v: ViewName; label: string; key: string }[] = [
  { v: 'front', label: 'Front', key: '1' },
  { v: 'back', label: 'Back', key: 'Ctrl 1' },
  { v: 'right', label: 'Right side', key: '3' },
  { v: 'left', label: 'Left side', key: 'Ctrl 3' },
  { v: 'top', label: 'Top', key: '7' },
]

/** Blender-style right-click menu over the 3D view. */
export function ContextMenu() {
  const menu = useStore((s) => s.contextMenu)
  const close = useStore((s) => s.openContextMenu)
  const muscles = useStore((s) => s.analysis.sim.muscleByKey)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(null)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu, close])

  if (!menu) return null
  const m = menu.muscleKey ? muscles[menu.muscleKey] : null
  const run = (fn: () => void) => () => {
    fn()
    close(null)
  }
  const { selectMuscle, setView, view } = useStore.getState()
  const left = Math.min(menu.x, window.innerWidth - 230)
  const top = Math.min(menu.y, window.innerHeight - 330)

  return (
    <div
      ref={ref}
      className="fixed z-50 w-56 overflow-hidden rounded-lg border border-slate-600 bg-slate-900/95 py-1 text-[12.5px] text-slate-200 shadow-2xl backdrop-blur"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {m && (
        <>
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {m.side === 'L' ? 'Left' : 'Right'} {m.def.name}
          </div>
          <Item onClick={run(() => selectMuscle(m.key))}>Select</Item>
          <Item onClick={run(() => selectMuscle(`${m.def.id}.${m.side === 'L' ? 'R' : 'L'}`))}>Select {m.side === 'L' ? 'right' : 'left'} side</Item>
          <Item
            onClick={run(() => {
              selectMuscle(m.key)
              const b = muscleBounds(m.key)
              cameraActions.focus(b.centre, b.radius)
            })}
          >
            Focus view on muscle
          </Item>
          <Item onClick={run(() => setView(m.def.layer === 'superficial' ? { superficial: false } : { deep: false }))}>
            Hide {m.def.layer} layer
          </Item>
          <Sep />
        </>
      )}
      <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">View</div>
      {VIEWS.map((v) => (
        <Item key={v.v} onClick={run(() => cameraActions.view(v.v))} shortcut={v.key}>
          {v.label}
        </Item>
      ))}
      <Item onClick={run(() => cameraActions.frameBody())} shortcut="Home">
        Frame body
      </Item>
      {(!view.superficial || !view.deep) && (
        <>
          <Sep />
          <Item onClick={run(() => setView({ superficial: true, deep: true }))}>Show all muscle layers</Item>
        </>
      )}
    </div>
  )
}

function Item({ children, onClick, shortcut }: { children: ReactNode; onClick: () => void; shortcut?: string }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-sky-500/20">
      <span>{children}</span>
      {shortcut && <span className="text-[11px] text-slate-500">{shortcut}</span>}
    </button>
  )
}

const Sep = () => <div className="my-1 h-px bg-slate-700" />
