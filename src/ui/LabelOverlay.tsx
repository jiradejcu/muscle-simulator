import { useEffect, useRef } from 'react'
import { useLabelStore, viewState } from '../scene/labelState'
import { useStore } from '../state/store'

/** Muscle name tags drawn as ordinary DOM over the canvas, repositioned every frame. */
export function LabelOverlay() {
  const items = useLabelStore((s) => s.items)
  const selectMuscle = useStore((s) => s.selectMuscle)
  const container = useRef<HTMLDivElement>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const cam = viewState.camera
      const el = container.current
      if (cam && el) {
        const w = el.clientWidth
        const h = el.clientHeight
        items.forEach((it, i) => {
          const b = refs.current[i]
          if (!b) return
          const p = it.pos.clone().project(cam)
          const visible = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1
          b.style.display = visible ? '' : 'none'
          b.style.transform = `translate(-50%, -50%) translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px)`
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [items])

  return (
    <div ref={container} className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((l, i) => (
        <button
          key={l.key}
          ref={(b) => {
            refs.current[i] = b
          }}
          onClick={() => selectMuscle(l.key)}
          className={`pointer-events-auto absolute left-0 top-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium shadow-md ${
            l.selected ? 'bg-amber-300/95 text-slate-900' : 'bg-slate-900/75 text-slate-100 hover:bg-slate-800'
          }`}
        >
          {l.name}
        </button>
      ))}
    </div>
  )
}
