import { Vector3 } from 'three'
import { forwardKinematics, transformPoint } from './kinematics'
import { LANDMARKS } from './landmarks'
import { normalisedStretch, type StrandModel } from './model'
import { pathLength } from './musclePath'
import { clampAngle, type Angles, type Side } from './skeleton'
import { centreOfMass, placeBody, supportRange } from './statics'

/**
 * Body linkage. When a muscle would have to stretch past what this person can reach, the
 * body does not simply stop: nearby joints take up the movement instead. Classic examples:
 * tight hamstrings in a forward fold stop the hip bending, so the pelvis tilts back and the
 * lower back rounds; tight calves in a squat keep the shin upright, so the trunk leans more.
 */

export interface Compensation {
  id: string
  muscleId: string
  sides: Side[]
  /** Degrees of movement shifted away from the limited joint. */
  amount: number
  text: string
  /** DOF key -> change applied (degrees). */
  changes: Record<string, number>
}

interface DofShift {
  dof: string
  /** Change per degree of compensation. "?" = the affected side(s). */
  k: number
}

interface Rule {
  id: string
  muscleId: string
  /** Normalised stretch the body allows before compensating. */
  limit: number
  maxDelta: number
  shifts: DofShift[]
  when?: (a: Angles, side: Side) => boolean
  describe: (amount: number, sides: Side[]) => string
}

const sideWord = (sides: Side[]) => (sides.length === 2 ? 'both' : sides[0] === 'L' ? 'the left' : 'the right')
const r0 = (v: number) => Math.round(v)

const RULES: Rule[] = [
  {
    id: 'hamstrings-pelvis',
    muscleId: 'hamstrings',
    limit: 1.1,
    maxDelta: 60,
    when: (a, s) => a[`hip${s}.flexion`] > 30 && a[`knee${s}.flexion`] < 60,
    shifts: [{ dof: 'hip?.flexion', k: -1 }, { dof: 'lumbar.flexion', k: 0.6 }, { dof: 'thoracic.flexion', k: 0.4 }],
    describe: (d, s) =>
      `Tight hamstrings on ${sideWord(s)} side${s.length === 2 ? 's' : ''} stopped the hip bending about ${r0(d)}° short, so the pelvis tilts back and the lower back rounds to make up the difference.`,
  },
  {
    id: 'glutes-buttwink',
    muscleId: 'gluteusMaximus',
    limit: 1.1,
    maxDelta: 30,
    when: (a, s) => a[`hip${s}.flexion`] > 90,
    shifts: [{ dof: 'hip?.flexion', k: -1 }, { dof: 'lumbar.flexion', k: 1 }],
    describe: (d) => `Limited hip flexion (tight glutes) makes the pelvis tuck under at the bottom ("butt wink"): about ${r0(d)}° of the bend moves into the lower back.`,
  },
  {
    id: 'hipflexors-arch',
    muscleId: 'iliopsoas',
    limit: 1.1,
    maxDelta: 30,
    when: (a, s) => a[`hip${s}.flexion`] < 10,
    shifts: [{ dof: 'hip?.flexion', k: 1 }, { dof: 'lumbar.flexion', k: -0.8 }],
    describe: (d, s) =>
      `Tight hip flexors on ${sideWord(s)} side${s.length === 2 ? 's' : ''} pull the pelvis forward: the hip extends ${r0(d)}° less and the lower back arches instead.`,
  },
  {
    id: 'rectus-arch',
    muscleId: 'rectusFemoris',
    limit: 1.1,
    maxDelta: 30,
    when: (a, s) => a[`hip${s}.flexion`] < 20 && a[`knee${s}.flexion`] > 60,
    shifts: [{ dof: 'hip?.flexion', k: 1 }, { dof: 'lumbar.flexion', k: -0.6 }],
    describe: (d) => `A tight rectus femoris tips the pelvis forward when the knee is bent: the hip bends ${r0(d)}° and the lower back arches.`,
  },
  {
    id: 'lats-arch',
    muscleId: 'latissimusDorsi',
    limit: 1.1,
    maxDelta: 40,
    when: (a, s) => a[`shoulder${s}.elevation`] > 100,
    shifts: [{ dof: 'shoulder?.elevation', k: -1 }, { dof: 'thoracic.flexion', k: -0.5 }, { dof: 'lumbar.flexion', k: -0.5 }],
    describe: (d) => `Tight lats limit how far the arms go overhead (${r0(d)}° short), so the back arches to get the arms up.`,
  },
  {
    id: 'calves-ankle',
    muscleId: 'soleus',
    limit: 1.1,
    maxDelta: 30,
    when: (a, s) => a[`ankle${s}.dorsiflexion`] > 5,
    shifts: [{ dof: 'ankle?.dorsiflexion', k: -1 }, { dof: 'hip?.flexion', k: 1 }],
    describe: (d) => `Limited ankle bend (tight soleus) keeps the shins ${r0(d)}° more upright, so the hips sit back and the trunk leans further forward.`,
  },
  {
    id: 'gastroc-ankle',
    muscleId: 'gastrocnemius',
    limit: 1.1,
    maxDelta: 30,
    when: (a, s) => a[`ankle${s}.dorsiflexion`] > 0 && a[`knee${s}.flexion`] < 40,
    shifts: [{ dof: 'ankle?.dorsiflexion', k: -1 }],
    describe: (d) => `Tight calves (gastrocnemius) stop the ankle bending ${r0(d)}° short with the knee straight; the heels would lift.`,
  },
  {
    id: 'adductors-stance',
    muscleId: 'adductors',
    limit: 1.15,
    maxDelta: 25,
    when: (a, s) => a[`hip${s}.abduction`] > 15,
    shifts: [{ dof: 'hip?.abduction', k: -1 }],
    describe: (d) => `Tight adductors narrow the stance by about ${r0(d)}° at each hip.`,
  },
]

function muscleStretch(model: StrandModel[], muscleKey: string, angles: Angles): number {
  const pose = forwardKinematics(angles, ZERO_ROOT)
  let x = -Infinity
  for (const s of model) if (s.muscleKey === muscleKey) x = Math.max(x, normalisedStretch(s, pathLength(pose, s.nodes)))
  return x
}

const ZERO_ROOT = { pitch: 0, roll: 0, position: new Vector3(0, 0.925, 0) }

function applyShifts(base: Angles, shifts: DofShift[], sides: Side[], delta: number): Angles {
  const a = { ...base }
  for (const sh of shifts) {
    const keys = sh.dof.includes('?') ? sides.map((s) => sh.dof.replace('?', s)) : [sh.dof]
    for (const k of keys) a[k] = clampAngle(k, a[k] + sh.k * delta)
  }
  return a
}

export interface CompensationOptions {
  contacts: string[]
  autoLevel: boolean
  balance: boolean
  root: { pitch: number; roll: number }
}

/** Apply the linkage rules, then (for standing poses) keep the centre of mass over the feet. */
export function compensate(target: Angles, model: StrandModel[], opts: CompensationOptions): { angles: Angles; notes: Compensation[] } {
  let angles = { ...target }
  const notes: Compensation[] = []
  for (const rule of RULES) {
    const sides = (['L', 'R'] as Side[]).filter((s) => {
      if (rule.when && !rule.when(angles, s)) return false
      return muscleStretch(model, `${rule.muscleId}.${s}`, angles) > rule.limit
    })
    if (!sides.length) continue
    const over = (a: Angles) => Math.max(...sides.map((s) => muscleStretch(model, `${rule.muscleId}.${s}`, a))) - rule.limit
    let lo = 0
    let hi = rule.maxDelta
    if (over(applyShifts(angles, rule.shifts, sides, hi)) > 0) {
      lo = hi
    } else {
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2
        if (over(applyShifts(angles, rule.shifts, sides, mid)) > 0) lo = mid
        else hi = mid
      }
      lo = hi
    }
    if (lo < 1) continue
    const next = applyShifts(angles, rule.shifts, sides, lo)
    // On the floor (hands, back or hips down) the contacts pin the body: a change that
    // would lift a contact off the floor cannot happen, so the muscle just stays stretched.
    if (!opts.balance && contactSpread(next, opts) > 0.02) continue
    const changes: Record<string, number> = {}
    for (const k of Object.keys(next)) if (Math.abs(next[k] - angles[k]) > 0.05) changes[k] = next[k] - angles[k]
    angles = next
    notes.push({ id: rule.id, muscleId: rule.muscleId, sides, amount: lo, text: rule.describe(lo, sides), changes })
  }

  if (opts.balance) {
    const b = balanceShift(angles, opts)
    if (b) {
      notes.push(b.note)
      angles = b.angles
    }
  }
  return { angles, notes }
}

function contactSpread(angles: Angles, opts: CompensationOptions): number {
  if (!opts.autoLevel || opts.contacts.length < 2) return 0
  const pl = placeBody(angles, opts.contacts, true, opts.root)
  let max = 0
  for (const c of opts.contacts) {
    const l = LANDMARKS[c]
    max = Math.max(max, transformPoint(pl.pose, l.seg, l.p).y)
  }
  return max
}

/** Forward-backward offset of the centre of mass from the support area (0 = inside). */
function comOffset(angles: Angles, opts: CompensationOptions): number {
  const pl = placeBody(angles, opts.contacts, opts.autoLevel, opts.root)
  const com = centreOfMass(pl.pose)
  const sup = supportRange(pl.pose, opts.contacts)
  const margin = Math.min(0.03, (sup.maxZ - sup.minZ) * 0.2)
  // People balance over mid-foot, a little in front of the ankles, not over the heels.
  const feet = (['L', 'R'] as const).filter((s) => opts.contacts.some((c) => c.endsWith(s) && (c.startsWith('heel') || c.startsWith('ball'))))
  const ankleZ = feet.length ? feet.reduce((a, s) => a + pl.pose[`foot${s}`].t.z, 0) / feet.length + 0.02 : -Infinity
  const lower = Math.max(sup.minZ + margin, Math.min(ankleZ, sup.maxZ - margin - 0.01))
  if (com.z < lower) return com.z - lower
  if (com.z > sup.maxZ - margin) return com.z - (sup.maxZ - margin)
  return 0
}

function balanceShift(angles: Angles, opts: CompensationOptions): { angles: Angles; note: Compensation } | null {
  const off = comOffset(angles, opts)
  if (off === 0) return null
  // The "ankle strategy": tip the whole body forward or back over the feet at the ankles,
  // leaving hip and spine angles (and any compensation already made there) alone.
  const shifts: DofShift[] = [{ dof: 'ankle?.dorsiflexion', k: off < 0 ? 1 : -1 }]
  const sides: Side[] = ['L', 'R']
  const max = 25
  const f = (d: number) => comOffset(applyShifts(angles, shifts, sides, d), opts)
  let lo = 0
  let hi = max
  if (Math.sign(f(hi)) === Math.sign(off)) {
    lo = hi
  } else {
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2
      if (Math.sign(f(mid)) === Math.sign(off)) lo = mid
      else hi = mid
    }
    lo = hi
  }
  if (lo < 1) return null
  const next = applyShifts(angles, shifts, sides, lo)
  const changes: Record<string, number> = {}
  for (const k of Object.keys(next)) if (Math.abs(next[k] - angles[k]) > 0.05) changes[k] = next[k] - angles[k]
  const text =
    off < 0
      ? `To stay balanced over the middle of the feet the whole body tips ${r0(lo)}° forward at the ankles.`
      : `To stay balanced the hips shift back: the whole body tips ${r0(lo)}° back at the ankles.`
  return { angles: next, note: { id: 'balance', muscleId: '', sides, amount: lo, text, changes } }
}
