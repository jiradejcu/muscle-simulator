import { useMemo } from 'react'
import { DOF_BY_KEY, explainMuscle, JOINT_BY_ID, MUSCLE_BY_ID, type Severity } from '../engine'
import { heatColor, HEAT_GRADIENT_CSS } from '../scene/muscleTube'
import { useStore } from '../state/store'
import { Bar, Section, Slider } from './controls'

const pct = (v: number) => `${Math.round(v * 100)}%`
const cssHeat = (v: number) => `#${heatColor(v).getHexString()}`

export function RightPanel() {
  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-slate-700/60 bg-slate-900/95">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <MuscleDetails />
        <TakeOver />
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

      <StrengthControl muscleKey={m.key} />

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

/** Strength of the selected muscle, and how its force compares with normal strength. */
function StrengthControl({ muscleKey }: { muscleKey: string }) {
  const strength = useStore((s) => s.profile.muscleStrength[muscleKey] ?? 1)
  const setStrength = useStore((s) => s.setMuscleStrength)
  const now = useStore((s) => s.analysis.sim.muscleByKey[muscleKey])
  const base = useStore((s) => s.analysis.baseline?.muscleByKey[muscleKey])
  const [id] = muscleKey.split('.')
  const otherSide = useStore((s) => s.profile.muscleStrength[`${id}.${muscleKey.endsWith('L') ? 'R' : 'L'}`] ?? 1)
  return (
    <div className="mb-3 rounded-lg border border-slate-700 p-2.5">
      <Slider
        label="Strength of this muscle (this side)"
        hint="Make the muscle weaker (injury, disuse) or stronger and see which muscles take over"
        value={Math.round(strength * 100)}
        min={0}
        max={150}
        step={5}
        unit="%"
        marker={100}
        onChange={(v) => setStrength(muscleKey, Math.max(0.01, v / 100))}
      />
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px]">
        <button onClick={() => setStrength(muscleKey, strength, true)} className="text-sky-300 hover:text-sky-200" disabled={otherSide === strength}>
          Apply to both sides
        </button>
        {strength !== 1 && (
          <button onClick={() => setStrength(muscleKey, 1)} className="text-slate-400 hover:text-slate-200">
            Reset
          </button>
        )}
      </div>
      {base && Math.abs(base.force - now.force) > 5 && (
        <p className="mt-1.5 text-[12px] leading-snug text-slate-300">
          Force {Math.round(now.force)} N instead of {Math.round(base.force)} N at normal strength
          {now.force < base.force ? ' – the rest is carried by other muscles (see below).' : '.'}
        </p>
      )}
    </div>
  )
}

/** When any muscle is weakened: who works harder, who works less, and what cannot be covered. */
function TakeOver() {
  const analysis = useStore((s) => s.analysis)
  const strengths = useStore((s) => s.profile.muscleStrength)
  const reset = useStore((s) => s.resetMuscleStrength)
  const selectMuscle = useStore((s) => s.selectMuscle)
  const setView = useStore((s) => s.setView)
  const changeMode = useStore((s) => s.view.heatMode === 'change')
  const { sim, baseline } = analysis
  if (!baseline) return null
  const changes = sim.muscles
    .map((m) => ({ m, d: m.activation - (baseline.muscleByKey[m.key]?.activation ?? 0), df: m.force - (baseline.muscleByKey[m.key]?.force ?? 0) }))
    .filter((x) => Math.abs(x.d) > 0.02 || Math.abs(x.df) > 20)
    .sort((a, b) => b.d - a.d)
  const harder = changes.filter((x) => x.d > 0).slice(0, 8)
  const less = changes.filter((x) => x.d <= 0).sort((a, b) => a.df - b.df).slice(0, 5)
  const weakened = Object.entries(strengths).filter(([, v]) => v !== 1)
  const maxed = sim.muscles.filter((m) => m.activation > 0.985)
  const unheld = Object.keys(sim.reserve).filter((k) => Math.abs(sim.reserve[k]) > Math.max(20, sim.reserveCapacity[k] * 1.5))
  const row = (x: (typeof changes)[number]) => (
    <button
      key={x.m.key}
      onClick={() => selectMuscle(x.m.key)}
      className="flex w-full items-center justify-between rounded px-1.5 py-0.5 text-left text-[12.5px] text-slate-300 hover:bg-slate-800"
    >
      <span>
        {x.m.side} · {x.m.def.name}
      </span>
      <span className={`tabular-nums text-[11.5px] ${x.d > 0 ? 'text-orange-300' : 'text-sky-300'}`}>
        {x.d > 0 ? '+' : ''}
        {Math.round(x.d * 100)}% effort · {x.df > 0 ? '+' : ''}
        {Math.round(x.df)} N
      </span>
    </button>
  )
  return (
    <Section
      title="Who takes over"
      right={
        <button onClick={() => setView({ heatMode: changeMode ? 'effort' : 'change', heat: true })} className="text-[11px] text-sky-300 hover:text-sky-200">
          {changeMode ? 'Colour by effort' : 'Colour by change'}
        </button>
      }
    >
      <p className="mb-1.5 text-[12px] leading-snug text-slate-400">
        Compared with every muscle at normal strength in this same pose.
        {weakened.length > 0 && (
          <>
            {' '}
            Changed: {weakened.map(([k, v]) => `${k.endsWith('L') ? 'L' : 'R'} ${MUSCLE_BY_ID[k.split('.')[0]].name} ${Math.round(v * 100)}%`).join(', ')}.{' '}
            <button onClick={reset} className="text-sky-300 hover:text-sky-200">
              Reset all
            </button>
          </>
        )}
      </p>
      {harder.length > 0 && <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Work harder</div>}
      {harder.map(row)}
      {less.length > 0 && <div className="mb-0.5 mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Work less</div>}
      {less.map(row)}
      {harder.length === 0 && less.length === 0 && <p className="text-[12.5px] text-slate-400">No noticeable change in this pose: the weakened muscle has little to do here.</p>}
      {(maxed.length > 0 || unheld.length > 0) && (
        <p className="mt-2 rounded-md border border-red-400/40 bg-red-500/10 p-2 text-[12px] leading-snug text-red-100">
          {maxed.length > 0 && <>At their limit: {maxed.map((m) => `${m.side} ${m.def.name}`).join(', ')}. </>}
          {unheld.length > 0 && <>Not enough muscle strength left at: {unheld.map((k) => `${JOINT_BY_ID[DOF_BY_KEY[k].joint].label} (${DOF_BY_KEY[k].label.toLowerCase()})`).join(', ')}; ligaments and joint structures would be strained.</>}
        </p>
      )}
    </Section>
  )
}
