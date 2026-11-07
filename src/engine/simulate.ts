import { Vector3 } from 'three'
import { forwardKinematics, transformPoint, type BodyPose, type RootTransform } from './kinematics'
import { LANDMARKS } from './landmarks'
import { weightedMinNorm } from './linalg'
import { normalisedStretch, passiveFraction, type StrandModel } from './model'
import { pathLength } from './musclePath'
import { MUSCLE_INSTANCES, type MuscleDef } from './muscles'
import type { LoadPoint } from './poses'
import { conditionStrength } from './conditions'
import { STRENGTH_FACTOR, type Profile } from './profile'
import { DOFS, JOINT_BY_ID, SEGMENTS, subtree, type Angles, type Side } from './skeleton'
import { GRAVITY, centreOfMass, solveGround, type PointForce } from './statics'

export interface StrandResult {
  key: string
  muscleKey: string
  length: number
  /** Current length / standing length. */
  lengthRatio: number
  /** 0 = slack, 1 = comfortable maximum for this person. */
  stretch: number
  /** Passive force as a fraction of Fmax. */
  passive: number
  /** Active force as a fraction of Fmax (can exceed 1 when the pose is too hard). */
  activation: number
  /** Active + passive force as a fraction of Fmax. */
  tension: number
  /** 0..~1.3 value for the heat colour: the larger of effort and how stretched it feels. */
  heat: number
  force: number
  fmax: number
}

export interface MuscleResult {
  key: string
  def: MuscleDef
  side: Side
  lengthRatio: number
  stretch: number
  activation: number
  passive: number
  tension: number
  heat: number
  force: number
  strands: StrandResult[]
  /** Torque this muscle contributes about each DOF (N·m, sign = DOF direction). */
  torque: Record<string, number>
}

export interface LoadSpec {
  point: LoadPoint | null
  kg: number
}

export interface SimulationResult {
  angles: Angles
  root: RootTransform
  pose: BodyPose
  strands: StrandResult[]
  muscles: MuscleResult[]
  muscleByKey: Record<string, MuscleResult>
  com: Vector3
  forces: PointForce[]
  imbalance: number
  /** Net torque the body must produce at each DOF (N·m, DOF sign convention). */
  jointTorque: Record<string, number>
  /** Torque carried by passive joint structures / unmodelled tissue at each DOF. */
  reserve: Record<string, number>
  bodyWeight: number
}

const H = 0.25 // degrees, finite-difference step

/** How strongly a stretch is felt, 0..1.3 (1 at about 120 % of the comfortable range). */
export function stretchFeel(x: number): number {
  return Math.min(1.3, Math.max(0, (x - 0.5) / 0.7))
}
const RAD = Math.PI / 180

function loadForces(load: LoadSpec): PointForce[] {
  if (!load.point || load.kg <= 0) return []
  const w = load.kg * GRAVITY
  if (load.point === 'upperBack') {
    const l = LANDMARKS.barPosition
    return [{ seg: l.seg, p: l.p, force: new Vector3(0, -w, 0), kind: 'load', label: 'bar' }]
  }
  return (['L', 'R'] as const).map((s) => {
    const l = LANDMARKS[`grip${s}`]
    return { seg: l.seg, p: l.p, force: new Vector3(0, -w / 2, 0), kind: 'load', label: `hand ${s}` }
  })
}

const crossingCache = new WeakMap<StrandModel[], number[][]>()

/** For each DOF, the indices of strands whose path spans the joint (others have zero moment arm). */
export function crossingStrands(model: StrandModel[]): number[][] {
  let c = crossingCache.get(model)
  if (c) return c
  c = DOFS.map((dof) => {
    const moved = new Set(subtree(JOINT_BY_ID[dof.joint].segment))
    const out: number[] = []
    model.forEach((s, i) => {
      let inside = false
      let outside = false
      for (const n of s.nodes) {
        if (moved.has(n.seg as never)) inside = true
        else outside = true
      }
      if (inside && outside) out.push(i)
    })
    return out
  })
  crossingCache.set(model, c)
  return c
}

function reserveCapacity(value: number, min: number, max: number): number {
  const base = 12
  const margin = Math.min(value - min, max - value)
  if (margin >= 12) return base
  const t = Math.min(1, Math.max(0, (12 - margin) / 12))
  return base + 260 * t * t
}

/**
 * Static analysis of one pose: muscle lengths, passive stretch, joint torques from gravity,
 * load and floor contact, and the muscle forces that hold the pose (minimum summed squared
 * activation).
 */
export function simulate(
  angles: Angles,
  root: RootTransform,
  model: StrandModel[],
  profile: Profile,
  contacts: string[],
  load: LoadSpec,
): SimulationResult {
  const pose = forwardKinematics(angles, root)
  const mass = profile.bodyMass
  const bodyWeight = mass * GRAVITY
  const strengthScale = STRENGTH_FACTOR[profile.strength] * Math.pow(mass / 70, 2 / 3)

  // --- External forces --------------------------------------------------
  const forces: PointForce[] = []
  for (const s of SEGMENTS) {
    if (!s.massFraction) continue
    forces.push({ seg: s.id, p: s.com, force: new Vector3(0, -s.massFraction * bodyWeight, 0), kind: 'gravity', label: s.id })
  }
  const loads = loadForces(load)
  forces.push(...loads)
  const comBody = centreOfMass(pose)
  // Combined centre of pressure target: body + load
  const cop = comBody.clone().multiplyScalar(bodyWeight)
  let totalWeight = bodyWeight
  for (const l of loads) {
    const p = transformPoint(pose, l.seg, l.p)
    cop.addScaledVector(p, -l.force.y)
    totalWeight += -l.force.y
  }
  cop.divideScalar(totalWeight)
  const ground = contacts.length ? solveGround(pose, contacts, totalWeight, cop) : { forces: [], imbalance: 0, supported: [] }
  forces.push(...ground.forces)

  // --- Lengths at the current pose ---------------------------------------
  const nS = model.length
  const lengths = new Float64Array(nS)
  for (let i = 0; i < nS; i++) lengths[i] = pathLength(pose, model[i].nodes)

  // --- Generalised forces and moment arms by finite differences -----------
  const nD = DOFS.length
  const crossing = crossingStrands(model)
  const Q = new Float64Array(nD)
  const M = new Float64Array(nD * nS) // moment arms (m / rad), row = DOF
  const tmpA = new Vector3()
  const tmpB = new Vector3()
  for (let d = 0; d < nD; d++) {
    const key = DOFS[d].key
    const plus = { ...angles, [key]: angles[key] + H }
    const minus = { ...angles, [key]: angles[key] - H }
    const pp = forwardKinematics(plus, root)
    const pm = forwardKinematics(minus, root)
    const denom = 2 * H * RAD
    let q = 0
    for (const f of forces) {
      transformPoint(pp, f.seg, f.p, tmpA)
      transformPoint(pm, f.seg, f.p, tmpB)
      q += f.force.dot(tmpA.sub(tmpB)) / denom
    }
    Q[d] = q
    for (const i of crossing[d]) {
      const lp = pathLength(pp, model[i].nodes)
      const lm = pathLength(pm, model[i].nodes)
      M[d * nS + i] = -(lp - lm) / denom
    }
  }

  // --- Passive forces -----------------------------------------------------
  const fmax = new Float64Array(nS)
  const stretch = new Float64Array(nS)
  const passive = new Float64Array(nS)
  const weakness = conditionStrength(profile.conditions)
  for (let i = 0; i < nS; i++) {
    fmax[i] = model[i].def.fmax * strengthScale * (weakness[model[i].muscle.id] ?? 1)
    stretch[i] = normalisedStretch(model[i], lengths[i])
    passive[i] = passiveFraction(stretch[i])
  }

  // Required muscle torque: sum_i M_di F_i + R_d = -Q_d - sum_i M_di Fp_i
  const tau = new Float64Array(nD)
  for (let d = 0; d < nD; d++) {
    let t = -Q[d]
    for (let i = 0; i < nS; i++) t -= M[d * nS + i] * passive[i] * fmax[i]
    tau[d] = t
  }

  // --- Static optimisation -----------------------------------------------
  const nX = nS + nD
  const A = new Float64Array(nD * nX)
  const w = new Float64Array(nX)
  const nonNeg = new Uint8Array(nX)
  for (let d = 0; d < nD; d++) {
    for (let i = 0; i < nS; i++) A[d * nX + i] = M[d * nS + i]
    A[d * nX + nS + d] = 1
  }
  for (let i = 0; i < nS; i++) {
    w[i] = fmax[i]
    nonNeg[i] = 1
  }
  for (let d = 0; d < nD; d++) {
    const def = DOFS[d]
    w[nS + d] = reserveCapacity(angles[def.key], def.min, def.max)
  }
  const x = weightedMinNorm(A, tau, nD, nX, w, nonNeg)

  // --- Results ----------------------------------------------------------
  const strands: StrandResult[] = model.map((s, i) => {
    const activation = x[i] / fmax[i]
    const tension = Math.min(1.5, activation + passive[i])
    const heat = Math.min(1.3, Math.max(activation, stretchFeel(stretch[i])))
    return {
      key: s.key,
      muscleKey: s.muscleKey,
      length: lengths[i],
      lengthRatio: lengths[i] / s.restLength,
      stretch: stretch[i],
      passive: passive[i],
      activation,
      tension,
      heat,
      force: x[i] + passive[i] * fmax[i],
      fmax: fmax[i],
    }
  })

  const muscles: MuscleResult[] = []
  const byKey: Record<string, MuscleResult> = {}
  for (const inst of MUSCLE_INSTANCES) {
    const idx = model.map((s, i) => (s.muscleKey === inst.key ? i : -1)).filter((i) => i >= 0)
    const ss = idx.map((i) => strands[i])
    const fsum = ss.reduce((a, s) => a + s.fmax, 0)
    const torque: Record<string, number> = {}
    for (let d = 0; d < nD; d++) {
      let t = 0
      for (const i of idx) t += M[d * nS + i] * strands[i].force
      if (Math.abs(t) > 0.5) torque[DOFS[d].key] = t
    }
    const r: MuscleResult = {
      key: inst.key,
      def: inst.def,
      side: inst.side,
      lengthRatio: ss.reduce((a, s) => a + s.lengthRatio * s.fmax, 0) / fsum,
      stretch: Math.max(...ss.map((s) => s.stretch)),
      activation: ss.reduce((a, s) => a + s.activation * s.fmax, 0) / fsum,
      passive: Math.max(...ss.map((s) => s.passive)),
      tension: Math.max(...ss.map((s) => s.tension)),
      heat: Math.max(...ss.map((s) => s.heat)),
      force: ss.reduce((a, s) => a + s.force, 0),
      strands: ss,
      torque,
    }
    muscles.push(r)
    byKey[inst.key] = r
  }

  const jointTorque: Record<string, number> = {}
  const reserve: Record<string, number> = {}
  for (let d = 0; d < nD; d++) {
    jointTorque[DOFS[d].key] = -Q[d]
    reserve[DOFS[d].key] = x[nS + d]
  }

  return {
    angles,
    root,
    pose,
    strands,
    muscles,
    muscleByKey: byKey,
    com: comBody,
    forces,
    imbalance: ground.imbalance,
    jointTorque,
    reserve,
    bodyWeight,
  }
}
