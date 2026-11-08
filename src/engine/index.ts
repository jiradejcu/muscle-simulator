import { compensate, type Compensation } from './compensation'
import { applyConditions, CONDITIONS } from './conditions'
import type { StrandModel } from './model'
import type { PoseDef } from './poses'
import type { Profile } from './profile'
import type { Angles } from './skeleton'
import { simulate, type LoadSpec, type SimulationResult } from './simulate'
import { placeBody } from './statics'
import { computeWarnings, type Warning } from './warnings'

export interface AnalysisInput {
  /** Angles the user asked for (pose preset or sliders). */
  target: Angles
  pose: Pick<PoseDef, 'contacts' | 'autoLevel' | 'balance' | 'levelRoll'> & { contacts: string[] }
  root: { pitch: number; roll: number }
  load: LoadSpec
  profile: Profile
  model: StrandModel[]
  compensate: boolean
  pitchHint?: number
  rollHint?: number
}

export interface Analysis {
  sim: SimulationResult
  /** Same pose with every muscle at normal strength, when any muscle has been weakened. */
  baseline?: SimulationResult
  target: Angles
  compensations: Compensation[]
  warnings: Warning[]
}

/** Full pipeline: body compensation -> placement on the floor -> statics -> warnings. */
export function analyse(input: AnalysisInput): Analysis {
  const { target, pose, root, load, profile, model } = input
  // Postural conditions shift the habitual posture before anything else happens.
  const postured = applyConditions(target, profile.conditions)
  const comp = input.compensate
    ? compensate(postured, model, { contacts: pose.contacts, autoLevel: pose.autoLevel, balance: !!pose.balance, levelRoll: !!pose.levelRoll, root })
    : { angles: postured, notes: [] }
  const placement = placeBody(comp.angles, pose.contacts, pose.autoLevel, root, input.pitchHint, { levelRoll: pose.levelRoll, rollHint: input.rollHint })
  const sim = simulate(comp.angles, placement.root, model, profile, pose.contacts, load)
  const weakened = Object.values(profile.muscleStrength ?? {}).some((v) => v !== 1) || CONDITIONS.some((c) => c.weakness && (profile.conditions?.[c.id] ?? 0) > 0)
  const baseline = weakened
    ? simulate(comp.angles, placement.root, model, { ...profile, muscleStrength: {}, conditions: {} }, pose.contacts, load)
    : undefined
  const warnings = computeWarnings({ sim, baseline, contacts: pose.contacts, loadKg: load.point ? load.kg : 0, compensations: comp.notes })
  for (const c of CONDITIONS) {
    const s = profile.conditions?.[c.id] ?? 0
    if (s <= 0) continue
    warnings.push({ id: `condition-${c.id}`, severity: s >= 0.6 ? 'caution' : 'info', title: c.name, detail: c.explain(s), dofs: Object.keys(c.offsets) })
  }
  return { sim, baseline, target, compensations: comp.notes, warnings }
}

export * from './skeleton'
export * from './poses'
export * from './profile'
export * from './muscles'
export * from './conditions'
export { buildModel, type StrandModel } from './model'
export type { SimulationResult, MuscleResult, StrandResult, LoadSpec } from './simulate'
export type { Warning, Severity } from './warnings'
export type { Compensation } from './compensation'
export { explainMuscle, dofPhrase } from './explain'
