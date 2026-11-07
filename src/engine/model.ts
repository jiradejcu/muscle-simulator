import { Vector3 } from 'three'
import { forwardKinematics, type BodyPose } from './kinematics'
import { MUSCLE_INSTANCES, type MuscleDef, type StrandDef } from './muscles'
import { pathLength, resolvePath, type ResolvedNode } from './musclePath'
import { TESTS, testValue, type Profile, type StretchTest, defaultProfile } from './profile'
import { neutralAngles, type Angles, type Side } from './skeleton'

export interface StrandModel {
  /** e.g. "hamstrings.L.0" */
  key: string
  muscleKey: string
  index: number
  def: StrandDef
  muscle: MuscleDef
  side: Side
  nodes: ResolvedNode[]
  /** Length in neutral standing. */
  restLength: number
  /** Comfortable maximum length for the current profile. */
  comfortLength: number
  /** Length span between "slack" and comfortable maximum (fixed, from typical flexibility). */
  span: number
}

const ZERO_ROOT = { pitch: 0, roll: 0, position: new Vector3(0, 0.925, 0) }

let restPoseCache: BodyPose | null = null
function restPose(): BodyPose {
  if (!restPoseCache) restPoseCache = forwardKinematics(neutralAngles(), ZERO_ROOT)
  return restPoseCache
}

const testPoseCache = new Map<string, BodyPose>()
function testPose(testId: keyof typeof TESTS, value: number, side: Side): BodyPose {
  const key = `${testId}|${value}|${side}`
  let pose = testPoseCache.get(key)
  if (!pose) {
    const angles = { ...neutralAngles(), ...TESTS[testId].angles(value, side) }
    pose = forwardKinematics(angles, ZERO_ROOT)
    if (testPoseCache.size > 500) testPoseCache.clear()
    testPoseCache.set(key, pose)
  }
  return pose
}

/**
 * Everyday end-range positions a person with typical flexibility can reach comfortably.
 * A muscle's comfortable maximum is at least as long as its length in any of these, so
 * e.g. the adductor magnus is not "over-stretched" by an ordinary deep squat.
 */
const FUNCTIONAL_RANGE: ((s: Side) => Angles)[] = [
  (s) => ({ [`hip${s}.flexion`]: 120, [`knee${s}.flexion`]: 145, [`ankle${s}.dorsiflexion`]: 35, [`hip${s}.abduction`]: 20, [`hip${s}.rotation`]: -20, 'lumbar.flexion': 15 }),
  (s) => ({ [`hip${s}.flexion`]: 95, [`knee${s}.flexion`]: 60, 'lumbar.flexion': 45, 'thoracic.flexion': 35 }),
  (s) => ({ [`hip${s}.flexion`]: 90, [`hip${s}.abduction`]: 40, [`hip${s}.rotation`]: -40, [`knee${s}.flexion`]: 120 }),
  (s) => ({ [`hip${s}.flexion`]: -15, [`knee${s}.flexion`]: 90, [`ankle${s}.dorsiflexion`]: 30 }),
  (s) => ({ [`shoulder${s}.elevation`]: 170, [`shoulder${s}.plane`]: 30, [`elbow${s}.flexion`]: 30, [`scapula${s}.elevation`]: 20 }),
  (s) => ({ [`shoulder${s}.elevation`]: 172, [`shoulder${s}.plane`]: 90, [`shoulder${s}.rotation`]: -20, [`scapula${s}.elevation`]: 15 }),
  (s) => ({ [`shoulder${s}.elevation`]: 172, [`shoulder${s}.plane`]: 0, [`shoulder${s}.rotation`]: -60, [`scapula${s}.elevation`]: 15 }),
  (s) => ({ [`shoulder${s}.elevation`]: 90, [`shoulder${s}.plane`]: 90, [`shoulder${s}.rotation`]: 60 }),
  (s) => ({ [`shoulder${s}.elevation`]: 90, [`shoulder${s}.plane`]: 90, [`shoulder${s}.rotation`]: -60 }),
  (s) => ({ [`shoulder${s}.elevation`]: 90, [`shoulder${s}.plane`]: 0, [`shoulder${s}.rotation`]: 70 }),
  (s) => ({ [`shoulder${s}.elevation`]: 90, [`shoulder${s}.plane`]: 0, [`shoulder${s}.rotation`]: -80 }),
  (s) => ({ [`shoulder${s}.elevation`]: 60, [`shoulder${s}.plane`]: -90, [`elbow${s}.flexion`]: 0 }),
  (s) => ({ [`shoulder${s}.elevation`]: 25, [`shoulder${s}.plane`]: 120, [`shoulder${s}.rotation`]: 70, [`elbow${s}.flexion`]: 90 }),
  (s) => ({ [`shoulder${s}.elevation`]: 90, [`shoulder${s}.plane`]: -30, [`shoulder${s}.rotation`]: -60 }),
  (s) => ({ [`shoulder${s}.elevation`]: 90, [`shoulder${s}.plane`]: 130, [`scapula${s}.protraction`]: 25 }),
  (s) => ({ [`shoulder${s}.elevation`]: 40, [`shoulder${s}.plane`]: -90, [`shoulder${s}.rotation`]: 60, [`elbow${s}.flexion`]: 90 }),
  (s) => ({ [`elbow${s}.flexion`]: 145, [`wrist${s}.flexion`]: 70 }),
  (s) => ({ [`elbow${s}.flexion`]: 0, [`wrist${s}.flexion`]: -70 }),
  () => ({ 'neck.flexion': 45, 'thoracic.flexion': 20 }),
  () => ({ 'neck.flexion': -50 }),
  () => ({ 'neck.rotation': 70 }),
  () => ({ 'neck.rotation': -70 }),
  () => ({ 'thoracic.rotation': 35, 'lumbar.rotation': 10 }),
  () => ({ 'thoracic.rotation': -35, 'lumbar.rotation': -10 }),
]

// Typical full shoulder range: elevation x plane x rotation, elbow relaxed.
for (const elev of [30, 90, 150, 175]) {
  for (const plane of [0, 45, 90, 120]) {
    for (const rot of [-40, 0, 40]) {
      FUNCTIONAL_RANGE.push((s) => ({
        [`shoulder${s}.elevation`]: elev,
        [`shoulder${s}.plane`]: plane,
        [`shoulder${s}.rotation`]: rot,
        [`elbow${s}.flexion`]: 30,
        [`scapula${s}.elevation`]: elev > 90 ? 15 : 0,
      }))
    }
  }
}

const functionalPoseCache = new Map<string, BodyPose>()
function functionalPoses(side: Side): BodyPose[] {
  return FUNCTIONAL_RANGE.map((f, i) => {
    const key = `${i}|${side}`
    let pose = functionalPoseCache.get(key)
    if (!pose) {
      pose = forwardKinematics({ ...neutralAngles(), ...f(side) }, ZERO_ROOT)
      functionalPoseCache.set(key, pose)
    }
    return pose
  })
}

/** Build per-strand data for a profile. Cheap enough to call on every profile change. */
export function buildModel(profile: Profile): StrandModel[] {
  const normal = defaultProfile()
  const out: StrandModel[] = []
  for (const inst of MUSCLE_INSTANCES) {
    inst.def.strands.forEach((def, index) => {
      const nodes = resolvePath(def.path, inst.side)
      const restLength = pathLength(restPose(), nodes)
      const testId = def.test ?? inst.def.test
      const test: StretchTest = TESTS[testId]
      const normalTest = pathLength(testPose(testId, testValue(test, normal), inst.side), nodes)
      const personalTest = test.profileKey ? pathLength(testPose(testId, testValue(test, profile), inst.side), nodes) : normalTest
      let typical = normalTest
      for (const pose of functionalPoses(inst.side)) typical = Math.max(typical, pathLength(pose, nodes))
      // Typical comfortable length, never less than a 6 % range.
      typical = Math.max(typical, restLength * 1.06)
      const span = typical - restLength
      // Personal tightness (or extra flexibility) scales the comfortable range by how much of
      // the typical test range this person reaches (0.4..1.6 so extreme inputs stay sane).
      const testRange = normalTest - restLength
      const fraction = testRange > 0.01 * restLength ? Math.min(1.6, Math.max(0.4, (personalTest - restLength) / testRange)) : 1
      const comfortLength = restLength + span * fraction
      out.push({
        key: `${inst.key}.${index}`,
        muscleKey: inst.key,
        index,
        def,
        muscle: inst.def,
        side: inst.side,
        nodes,
        restLength,
        comfortLength,
        span,
      })
    })
  }
  return out
}

/**
 * Normalised stretch: 0 = slack, 1 = comfortable maximum for this person.
 * A tight muscle has a shorter comfortable length, so it reaches 1 sooner and may sit above
 * 0 even when standing.
 */
export function normalisedStretch(s: StrandModel, length: number): number {
  return 1 + (length - s.comfortLength) / s.span
}

/** Passive force as a fraction of Fmax for a normalised stretch. */
export function passiveFraction(x: number): number {
  if (x <= 0) return 0
  const c = 2.5
  const k = 0.15 / (Math.exp(c) - 1)
  const xm = 1.5
  if (x <= xm) return k * (Math.exp(c * x) - 1)
  // Beyond 150 % of the comfortable range continue linearly (the tissue would tear long
  // before an exponential got this large; we only need a monotonic warning signal).
  return k * (Math.exp(c * xm) - 1) + k * c * Math.exp(c * xm) * (x - xm)
}
