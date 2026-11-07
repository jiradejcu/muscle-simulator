import type { ReactNode } from 'react'

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = '°',
  hint,
  marker,
  actual,
}: {
  label: ReactNode
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  unit?: string
  hint?: string
  /** Show a tick at this value (e.g. "typical"). */
  marker?: number
  /** Value actually used after compensation, if different. */
  actual?: number
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const showActual = actual !== undefined && Math.abs(actual - value) > 0.5
  return (
    <label className="block py-1" title={hint}>
      <div className="flex items-baseline justify-between text-[12px] text-slate-300">
        <span className="truncate pr-2">{label}</span>
        <span className="tabular-nums text-slate-100">
          {Math.round(value * 10) / 10}
          {unit}
          {showActual && <span className="ml-1 text-amber-300" title="Value after body compensation">→ {Math.round(actual!)}{unit}</span>}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider w-full"
        />
        {marker !== undefined && (
          <div className="pointer-events-none absolute top-0 h-full w-px bg-emerald-400/80" style={{ left: `${pct(marker)}%` }} title="Typical" />
        )}
        {showActual && (
          <div className="pointer-events-none absolute top-[3px] h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-amber-300" style={{ left: `${pct(actual!)}%` }} />
        )}
      </div>
    </label>
  )
}

export function Toggle({ label, checked, onChange, title }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={() => onChange(!checked)}
      className={`rounded-md border px-2 py-1 text-[12px] font-medium transition ${
        checked ? 'border-sky-400/60 bg-sky-500/20 text-sky-100' : 'border-slate-600 bg-slate-800/60 text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  )
}

export function Section({ title, children, right }: { title: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Bar({ value, max = 1, color, label, text }: { value: number; max?: number; color: string; label: string; text: string }) {
  const w = Math.max(0, Math.min(1, value / max)) * 100
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[12px] text-slate-300">
        <span>{label}</span>
        <span className="tabular-nums text-slate-100">{text}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-slate-700/70">
        <div className="h-full rounded" style={{ width: `${w}%`, background: color }} />
      </div>
    </div>
  )
}
