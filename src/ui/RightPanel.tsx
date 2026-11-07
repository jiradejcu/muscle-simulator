import { useMemo } from 'react'
import { explainMuscle, MUSCLE_BY_ID, type Severity } from '../engine'
import { heatColor, HEAT_GRADIENT_CSS } from '../scene/muscleTube'
import { useStore } from '../state/store'
import { Bar, Section } from './controls'

const pct = (v: number) => `${Math.round(v * 100)}%`
const cssHeat = (v: number) => `#${heatColor(v).getHexString()}`

export function RightPanel() {
  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-slate-700/60 bg-slate-900/95">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <MuscleDetails />
        <WarningList />
        <TopMuscles />
      </div>
    </aside>
  )
}

function MuscleDetails() {
  const key = useStore((s) => s.selectedMuscle)
  const analysis = useStore((s) => s.analysis)
  const model = useStore((s) => s.model)
  const loadKg = useStore((s) => (s.loadPoint ? s.loadKg : 0))
  const contacts = useStore((s) => s.contacts)
  const selectMuscle = useStore((s) => s.selectMuscle)
  const m = key ? analysis.sim.muscleByKey[key] : null
  const ex = useMemo(
    () => (m && key ? explainMuscle(analysis.sim, model, key, { loadKg, contacts, compensations: analysis.compensations }) : null),
    [m, key, analysis, model, loadKg, contacts],
  )
  if (!m || !ex) {
    return (
      <Section title="Muscle">
        <p className="text-[13px] text-slate-400">Click a muscle in the 3D view or in the list below to see what it is doing.</p>
      </Section>
    )
  }
  const other = `${m.def.id}.${m.side === 'L' ? 'R' : 'L'}`
  return (
    <Section
      title={`${m.def.region} · ${m.def.layer}`}
      right={
        <button onClick={() => selectMuscle(other)} className="text-[11px] text-sky-300 hover:text-sky-200">
          Switch to {m.side === 'L' ? 'right' : 'left'}
        </button>
      }
    >
      <h2 className="text-[17px] font-semibold text-white">{ex.title}</h2>
      <p className="mb-2 text-[12.5px] leading-snug text-slate-400">{m.def.description} {m.def.actions}</p>

      <div className="mb-3 rounded-lg bg-slate-800/70 p-3">
        <Bar label="Length vs. standing" value={m.lengthRatio - 0.6} max={0.8} color="#94a3b8" text={pct(m.lengthRatio)} />
        <Bar label="Stretch vs. your comfortable range" value={Math.max(0, m.stretch)} max={1.4} color={cssHeat(Math.max(0, (m.stretch - 0.5) / 0.7))} text={pct(Math.max(0, m.stretch))} />
        <Bar label="Effort (active force / strength)" value={m.activation} max={1.2} color={cssHeat(m.activation)} text={pct(m.activation)} />
        <Bar label="Tension (active + passive)" value={m.tension} max={1.5} color={cssHeat(m.tension)} text={`${Math.round(m.force)} N`} />
        <div className="mt-2 flex items-center gap-2 text-[12px] text-slate-300">
          <span className="h-3 w-3 rounded-full" style={{ background: cssHeat(m.heat) }} />
          <span className="font-medium">Feels like:</span> {ex.feel}
        </div>
      </div>

      <p className="mb-2 text-[13px] leading-snug text-slate-200">{ex.stretchText}</p>
      <p className="mb-2 text-[13px] leading-snug text-slate-200">{ex.loadText}</p>
      {ex.compensation && <p className="mb-2 rounded-md border border-amber-400/30 bg-amber-400/10 p-2 text-[12.5px] leading-snug text-amber-100">{ex.compensation}</p>}

      {ex.reasons.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">What changes its length</div>
          {ex.reasons.map((r) => (
            <div key={r.dof} className="flex justify-between text-[12px] text-slate-300">
              <span>{r.phrase}</span>
              <span className={`tabular-nums ${r.mm > 0 ? 'text-orange-300' : 'text-sky-300'}`}>
                {r.mm > 0 ? '+' : ''}
                {Math.round(r.mm)} mm
              </span>
            </div>
          ))}
        </div>
      )}

      {m.strands.length > 1 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Parts</div>
          {m.strands.map((s, i) => (
            <div key={s.key} className="flex items-center justify-between text-[12px] text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: cssHeat(s.heat) }} />
                {MUSCLE_BY_ID[m.def.id].strands[i].name}
              </span>
              <span className="tabular-nums text-slate-400">
                len {pct(s.lengthRatio)} · effort {pct(s.activation)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

const SEVERITY_STYLE: Record<Severity, string> = {
  warning: 'border-red-400/40 bg-red-500/10 text-red-100',
  caution: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  info: 'border-slate-600 bg-slate-800/60 text-slate-300',
}
const SEVERITY_ICON: Record<Severity, string> = { warning: '⚠', caution: '!', info: 'i' }

function WarningList() {
  const warnings = useStore((s) => s.analysis.warnings)
  const selectMuscle = useStore((s) => s.selectMuscle)
  const shown = warnings.filter((w) => w.severity !== 'info' || !w.id.startsWith('range-')).slice(0, 12)
  const ranges = warnings.filter((w) => w.id.startsWith('range-'))
  return (
    <Section title={`Warnings and notes (${warnings.length})`}>
      {warnings.length === 0 && <p className="text-[12.5px] text-slate-400">Nothing to flag in this pose.</p>}
      <div className="space-y-1.5">
        {shown.map((w) => (
          <button
            key={w.id}
            onClick={() => w.muscles?.[0] && selectMuscle(w.muscles[0])}
            className={`block w-full rounded-md border p-2 text-left ${SEVERITY_STYLE[w.severity]} ${w.muscles ? 'hover:brightness-125' : 'cursor-default'}`}
          >
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/25 text-[10px]">{SEVERITY_ICON[w.severity]}</span>
              {w.title}
            </div>
            <div className="mt-0.5 text-[12px] leading-snug opacity-90">{w.detail}</div>
          </button>
        ))}
        {ranges.length > 0 && (
          <details className="rounded-md border border-slate-700 bg-slate-800/40 p-2 text-[12px] text-slate-400">
            <summary className="cursor-pointer">{ranges.length} joint(s) at the end of their range</summary>
            <ul className="mt-1 space-y-0.5">
              {ranges.map((r) => (
                <li key={r.id}>
                  <b className="text-slate-300">{r.title.replace(': end of range', '')}</b> — {r.detail.split('.')[0]}.
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Section>
  )
}

function TopMuscles() {
  const muscles = useStore((s) => s.analysis.sim.muscles)
  const selected = useStore((s) => s.selectedMuscle)
  const selectMuscle = useStore((s) => s.selectMuscle)
  const top = [...muscles].sort((a, b) => b.heat - a.heat).slice(0, 14)
  return (
    <Section
      title="Most demanding"
      right={<div className="h-2 w-24 rounded" style={{ background: HEAT_GRADIENT_CSS }} title="Heat scale: relaxed → hard" />}
    >
      <div className="space-y-0.5">
        {top.map((m) => (
          <button
            key={m.key}
            onClick={() => selectMuscle(m.key)}
            className={`flex w-full items-center justify-between rounded px-1.5 py-1 text-left text-[12.5px] ${selected === m.key ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: cssHeat(m.heat) }} />
              {m.side === 'L' ? 'L' : 'R'} · {m.def.name}
            </span>
            <span className="tabular-nums text-[11.5px] text-slate-400">
              {m.stretch > 0.7 ? `stretch ${pct(m.stretch)}` : `effort ${pct(m.activation)}`}
            </span>
          </button>
        ))}
      </div>
    </Section>
  )
}
