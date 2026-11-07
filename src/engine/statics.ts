import { Vector3 } from 'three'
import { forwardKinematics, transformPoint, type BodyPose, type RootTransform } from './kinematics'
import { LANDMARKS } from './landmarks'
import { SEGMENTS, type Angles, type SegmentId } from './skeleton'

export const GRAVITY = 9.81

export interface Placement {
  root: RootTransform
  pose: BodyPose
}

/** Points that must not go through the floor. */
const CHECK_LANDMARKS = [
  'heelL', 'heelR', 'toeTipL', 'toeTipR', 'ballL', 'ballR', 'headTop', 'headBack', 'forehead', 'chin',
  'knucklesL', 'knucklesR', 'fingerTipL', 'fingerTipR', 'olecranonL', 'olecranonR', 'palmL', 'palmR',
  'sacrum', 'coccyx', 'upperBack', 'xiphoid', 'manubrium', 't7Spinous', 'acromionL', 'acromionR',
  'greaterTrochanterL', 'greaterTrochanterR', 'asisL', 'asisR', 'ischialTuberosityL', 'ischialTuberosityR',
  'tibialTuberosityL', 'tibialTuberosityR', 'quadDistalL', 'quadDistalR', 'navel', 'pubicSymphysis',
]

function checkPoints(pose: BodyPose): Vector3[] {
  const pts: Vector3[] = []
  for (const s of SEGMENTS) {
    pts.push(pose[s.id].t.clone())
    pts.push(transformPoint(pose, s.id, s.end))
  }
  for (const name of CHECK_LANDMARKS) {
    const l = LANDMARKS[name]
    pts.push(transformPoint(pose, l.seg, l.p))
  }
  return pts
}

function contactPoints(pose: BodyPose, contacts: string[]): Vector3[] {
  return contacts.map((c) => {
    const l = LANDMARKS[c]
    if (!l) throw new Error(`Unknown contact landmark ${c}`)
    return transformPoint(pose, l.seg, l.p)
  })
}

const DEG = Math.PI / 180

function rotX(v: Vector3, deg: number): [number, number] {
  const c = Math.cos(deg * DEG)
  const s = Math.sin(deg * DEG)
  return [v.y * c - v.z * s, v.y * s + v.z * c]
}

/** Cost of a whole-body pitch: contacts level, nothing else below them. */
function levelCost(contacts: Vector3[], checks: Vector3[], pitch: number): number {
  let mean = 0
  const ys = contacts.map((p) => rotX(p, pitch)[0])
  for (const y of ys) mean += y
  mean /= ys.length
  let cost = 0
  for (const y of ys) cost += (y - mean) * (y - mean)
  for (const p of checks) {
    const y = rotX(p, pitch)[0]
    const pen = mean - 0.012 - y
    if (pen > 0) cost += 3 * pen * pen
  }
  return cost
}

/**
 * Place the body in the world: optionally choose the whole-body pitch that rests the
 * contacts level on the floor, then lift so nothing is below y = 0 and centre the contacts
 * on the origin.
 */
export function placeBody(
  angles: Angles,
  contacts: string[],
  autoLevel: boolean,
  manualRoot: { pitch: number; roll: number },
  pitchHint?: number,
): Placement {
  let pitch = manualRoot.pitch
  const roll = manualRoot.roll
  if (autoLevel && contacts.length > 0) {
    const base = forwardKinematics(angles, { pitch: 0, roll, position: new Vector3() })
    const cps = contactPoints(base, contacts)
    const chk = checkPoints(base)
    let best = 0
    let bestCost = Infinity
    for (let p = -180; p < 180; p += 2) {
      const c = levelCost(cps, chk, p)
      if (c < bestCost - 1e-9) {
        bestCost = c
        best = p
      }
    }
    // Prefer staying close to the hint when another solution is (almost) as good.
    if (pitchHint !== undefined) {
      const ch = levelCost(cps, chk, pitchHint)
      if (ch <= bestCost * 1.05 + 1e-7) best = pitchHint
    }
    // Golden-section refinement in [best-2.5, best+2.5]
    let a = best - 2.5
    let b = best + 2.5
    const g = (Math.sqrt(5) - 1) / 2
    let x1 = b - g * (b - a)
    let x2 = a + g * (b - a)
    let f1 = levelCost(cps, chk, x1)
    let f2 = levelCost(cps, chk, x2)
    for (let i = 0; i < 30; i++) {
      if (f1 < f2) {
        b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = levelCost(cps, chk, x1)
      } else {
        a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = levelCost(cps, chk, x2)
      }
    }
    pitch = (a + b) / 2
  }

  const pose0 = forwardKinematics(angles, { pitch, roll, position: new Vector3() })
  const cps = contactPoints(pose0, contacts)
  const chk = checkPoints(pose0)
  let minY = Infinity
  for (const p of cps) minY = Math.min(minY, p.y)
  for (const p of chk) minY = Math.min(minY, p.y)
  if (!Number.isFinite(minY)) minY = 0
  const centre = new Vector3()
  if (cps.length) {
    for (const p of cps) centre.add(p)
    centre.divideScalar(cps.length)
  }
  const position = new Vector3(-centre.x, -minY, -centre.z)
  const root: RootTransform = { pitch, roll, position }
  return { root, pose: forwardKinematics(angles, root) }
}

/** Whole-body centre of mass (body only). */
export function centreOfMass(pose: BodyPose): Vector3 {
  const c = new Vector3()
  const tmp = new Vector3()
  for (const s of SEGMENTS) {
    if (!s.massFraction) continue
    c.addScaledVector(transformPoint(pose, s.id, s.com, tmp), s.massFraction)
  }
  return c
}

export interface PointForce {
  seg: SegmentId
  /** Rest-world attachment point. */
  p: [number, number, number]
  force: Vector3
  kind: 'gravity' | 'ground' | 'load'
  label: string
}

export interface GroundResult {
  forces: PointForce[]
  /** Horizontal distance (m) between the line of gravity and where the floor can push. */
  imbalance: number
  supported: string[]
}

/**
 * Vertical ground reaction forces at the contacts that touch the floor. Solves the
 * least-squares distribution that balances weight and moments, with no pulling forces.
 */
export function solveGround(pose: BodyPose, contacts: string[], weight: number, cop: Vector3): GroundResult {
  const pts = contactPoints(pose, contacts)
  let minY = Infinity
  for (const p of pts) minY = Math.min(minY, p.y)
  const idx = pts.map((p, i) => (p.y < minY + 0.03 ? i : -1)).filter((i) => i >= 0)
  const n = idx.length
  const active = new Array(n).fill(true)
  let f = new Array(n).fill(0)
  for (let iter = 0; iter < 10; iter++) {
    // Normal equations for min sum f^2 s.t. sum f = W, sum f dx = 0, sum f dz = 0
    const rows: number[][] = [[], [], []]
    for (let k = 0; k < n; k++) {
      const p = pts[idx[k]]
      const on = active[k] ? 1 : 0
      rows[0].push(on)
      rows[1].push(on * (p.x - cop.x))
      rows[2].push(on * (p.z - cop.z))
    }
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < n; k++) M[r][c] += rows[r][k] * rows[c][k]
    const tr = M[0][0] + M[1][1] + M[2][2]
    for (let r = 0; r < 3; r++) M[r][r] += 1e-6 * tr + 1e-9
    const lam = solve3(M, [weight, 0, 0])
    f = rows[0].map((_, k) => rows[0][k] * lam[0] + rows[1][k] * lam[1] + rows[2][k] * lam[2])
    let changed = false
    for (let k = 0; k < n; k++) if (active[k] && f[k] < 0) { active[k] = false; f[k] = 0; changed = true }
    if (!changed) break
  }
  // Rescale so the total matches the weight exactly.
  const total = f.reduce((s, v) => s + v, 0)
  if (total > 0) f = f.map((v) => (v * weight) / total)
  else if (n) f = f.map(() => weight / n)
  // Residual moment -> imbalance distance
  let mx = 0
  let mz = 0
  for (let k = 0; k < n; k++) {
    const p = pts[idx[k]]
    mx += f[k] * (p.x - cop.x)
    mz += f[k] * (p.z - cop.z)
  }
  const imbalance = weight > 0 ? Math.hypot(mx, mz) / weight : 0
  const forces: PointForce[] = []
  const supported: string[] = []
  for (let k = 0; k < n; k++) {
    const name = contacts[idx[k]]
    const l = LANDMARKS[name]
    if (f[k] > 1e-6) supported.push(name)
    forces.push({ seg: l.seg, p: l.p, force: new Vector3(0, f[k], 0), kind: 'ground', label: name })
  }
  return { forces, imbalance, supported }
}

function solve3(M: number[][], b: number[]): number[] {
  const a = M.map((r, i) => [...r, b[i]])
  for (let i = 0; i < 3; i++) {
    let p = i
    for (let r = i + 1; r < 3; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r
    ;[a[i], a[p]] = [a[p], a[i]]
    const d = a[i][i] || 1e-12
    for (let r = 0; r < 3; r++) {
      if (r === i) continue
      const k = a[r][i] / d
      for (let c = i; c < 4; c++) a[r][c] -= k * a[i][c]
    }
  }
  return [a[0][3] / (a[0][0] || 1e-12), a[1][3] / (a[1][1] || 1e-12), a[2][3] / (a[2][2] || 1e-12)]
}

/** Support region along the forward (z) axis spanned by the contacts on the floor. */
export function supportRange(pose: BodyPose, contacts: string[]): { minZ: number; maxZ: number; minX: number; maxX: number } {
  const pts = contactPoints(pose, contacts)
  let minY = Infinity
  for (const p of pts) minY = Math.min(minY, p.y)
  const on = pts.filter((p) => p.y < minY + 0.03)
  return {
    minZ: Math.min(...on.map((p) => p.z)),
    maxZ: Math.max(...on.map((p) => p.z)),
    minX: Math.min(...on.map((p) => p.x)),
    maxX: Math.max(...on.map((p) => p.x)),
  }
}
