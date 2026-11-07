import { clampAngle, type Angles } from './skeleton'

/**
 * Postural conditions. Each one shifts the body's habitual posture (added on top of any
 * pose) and may weaken some muscles. Severity runs 0..1; the angle offsets are given for a
 * severe case and scale linearly. The muscle effects - asymmetric stretch, extra load -
 * then come out of the normal simulation.
 *
 * Simplification: a real scoliosis is a 3-D deformity spread over many vertebrae; here it
 * is spread over the two spinal joints the model has (lower and upper back).
 */
export type ConditionId =
  | 'scoliosis'
  | 'kyphosis'
  | 'lordosis'
  | 'flatBack'
  | 'forwardHead'
  | 'roundedShoulders'
  | 'kneeValgus'
  | 'kneeVarus'
  | 'flatFeet'
  | 'kneeHyperextension'
  | 'weakGlutes'
  | 'weakCore'

export interface ConditionDef {
  id: ConditionId
  name: string
  /** Short description shown in the profile panel. */
  summary: string
  /** What the severe value means, e.g. "40° Cobb angle". */
  scale: string
  /** Angle offsets at full severity. "?" = both sides. */
  offsets: Record<string, number>
  /** Muscle id -> strength multiplier at full severity. */
  weakness?: Record<string, number>
  /** Plain explanation added to the notes when active. */
  explain: (severity: number) => string
}

const r0 = (v: number) => Math.round(v)

export const CONDITIONS: ConditionDef[] = [
  {
    id: 'scoliosis',
    name: 'Scoliosis (right thoracic curve)',
    summary: 'Sideways S-curve of the spine with twisting: upper back bends right, lower back compensates left.',
    scale: 'about 45° Cobb angle when severe',
    offsets: { 'lumbar.lateral': -16, 'lumbar.rotation': -4, 'thoracic.lateral': 24, 'thoracic.rotation': -14, 'neck.lateral': -8, 'scapulaR.elevation': 6, 'scapulaL.elevation': -3 },
    explain: (s) =>
      `Scoliosis (~${r0(45 * s)}° Cobb): the spine bows to the right around the lower ribs - the lower back leans ${r0(16 * s)}° right, the upper back angles ${r0(24 * s)}° back to the left and twists to the right (rib hump), and the neck tilts to level the head. Trunk muscles on the convex (right) side are held stretched; those on the concave (left) side are shortened and the side-benders on both sides work unevenly. The right shoulder sits higher.`,
  },
  {
    id: 'kyphosis',
    name: 'Hyperkyphosis (rounded upper back)',
    summary: 'Excessive forward rounding of the thoracic spine ("hunchback"), often with the head pushed forward.',
    scale: 'about 25° extra rounding when severe',
    offsets: { 'thoracic.flexion': 25, 'neck.flexion': -15, 'scapula?.protraction': 12 },
    weakness: { trapezius: 0.75, rhomboids: 0.75 },
    explain: (s) =>
      `Rounded upper back: the thoracic spine is flexed ${r0(25 * s)}° more than normal and the neck tips back ${r0(15 * s)}° to keep the eyes level. Upper-back extensors and the middle trapezius/rhomboids work stretched; the chest muscles adapt short.`,
  },
  {
    id: 'lordosis',
    name: 'Hyperlordosis / anterior pelvic tilt',
    summary: 'Pelvis tipped forward with an exaggerated lower-back arch; common with tight hip flexors and weak abs.',
    scale: 'about 20° extra arch when severe',
    offsets: { 'lumbar.flexion': -20, 'hip?.flexion': 12 },
    weakness: { rectusAbdominis: 0.8, gluteusMaximus: 0.85 },
    explain: (s) =>
      `Anterior pelvic tilt: the pelvis tips forward ~${r0(12 * s)}° and the lower back arches ${r0(20 * s)}° more. Hip flexors and lower-back muscles sit shortened, the abdominals and hamstrings lengthened; the small joints at the back of the lumbar spine take more load.`,
  },
  {
    id: 'flatBack',
    name: 'Flat back / posterior pelvic tilt',
    summary: 'Loss of the normal lower-back curve with the pelvis tucked under; often with tight hamstrings.',
    scale: 'about 15° less lordosis when severe',
    offsets: { 'lumbar.flexion': 15, 'hip?.flexion': -8, 'knee?.flexion': 6 },
    explain: (s) =>
      `Flat back: the lower back loses ~${r0(15 * s)}° of its curve and the pelvis tucks under. Hamstrings and glutes sit shortened, hip flexors lengthened; the knees bend slightly to keep the body upright.`,
  },
  {
    id: 'forwardHead',
    name: 'Forward head posture',
    summary: '"Tech neck": the head sits in front of the shoulders.',
    scale: 'about 25° forward tilt when severe',
    offsets: { 'neck.flexion': 25, 'thoracic.flexion': 8 },
    weakness: { neckExtensors: 0.85 },
    explain: (s) =>
      `Forward head: the neck is flexed ${r0(25 * s)}° so the head's weight sits in front of the spine. The neck extensors and upper trapezius must hold it up continuously.`,
  },
  {
    id: 'roundedShoulders',
    name: 'Rounded shoulders',
    summary: 'Shoulder blades drift forward and up; tight chest, weak mid-back.',
    scale: 'about 20° protraction when severe',
    offsets: { 'scapula?.protraction': 20, 'scapula?.elevation': 6, 'shoulder?.rotation': 15 },
    weakness: { trapezius: 0.8, rhomboids: 0.8, serratusAnterior: 0.85 },
    explain: (s) =>
      `Rounded shoulders: the shoulder blades sit ${r0(20 * s)}° forward with the arms turned in. Pectoralis minor shortens, rhomboids and middle trapezius are stretched, and raising the arms is more likely to pinch the rotator cuff.`,
  },
  {
    id: 'kneeValgus',
    name: 'Knock knees (genu valgum)',
    summary: 'Knees angle in toward each other; often with flat feet and weak hip abductors.',
    scale: 'about 10° inward angle when severe',
    offsets: { 'hip?.abduction': -8, 'hip?.rotation': 12, 'ankle?.inversion': -8 },
    weakness: { gluteusMedius: 0.75 },
    explain: (s) =>
      `Knock knees: the thighs angle inward ~${r0(8 * s)}° and rotate in ${r0(12 * s)}°. Load shifts to the outer knee compartment and the inner knee ligaments; gluteus medius has to work harder in squats and on one leg.`,
  },
  {
    id: 'kneeVarus',
    name: 'Bow legs (genu varum)',
    summary: 'Knees bow outward; load shifts to the inner side of the knee.',
    scale: 'about 8° outward angle when severe',
    offsets: { 'hip?.abduction': 6, 'hip?.rotation': -6, 'ankle?.inversion': 8 },
    explain: (s) => `Bow legs: the thighs angle out ~${r0(6 * s)}° with the feet rolled outward. The inner knee carries more load and the outer structures (IT band) are stretched.`,
  },
  {
    id: 'flatFeet',
    name: 'Flat feet (overpronation)',
    summary: 'Arches collapse and the feet roll inward, which rotates the shins and knees in.',
    scale: 'about 12° eversion when severe',
    offsets: { 'ankle?.inversion': -12, 'hip?.rotation': 6 },
    weakness: { tibialisAnterior: 0.85 },
    explain: (s) => `Flat feet: the feet roll in ~${r0(12 * s)}°, turning the shins and knees inward. Tibialis anterior and the arch muscles work harder; it can contribute to knee valgus.`,
  },
  {
    id: 'kneeHyperextension',
    name: 'Knee hyperextension (genu recurvatum)',
    summary: 'Knees lock back past straight when standing.',
    scale: 'about 8° past straight when severe',
    offsets: { 'knee?.flexion': -8, 'ankle?.dorsiflexion': -4 },
    explain: (s) => `Knee hyperextension: the knees push ${r0(8 * s)}° past straight, so ligaments at the back of the knee rather than muscles hold you up.`,
  },
  {
    id: 'weakGlutes',
    name: 'Weak glutes',
    summary: 'Gluteus maximus and medius produce less force (e.g. after long sitting or injury).',
    scale: 'down to 50% strength when severe',
    offsets: {},
    weakness: { gluteusMaximus: 0.5, gluteusMedius: 0.5 },
    explain: (s) => `Weak glutes (${r0(100 - 50 * s)}% strength): the hamstrings, adductors and lower back pick up hip-extension work, and the knees tend to cave in.`,
  },
  {
    id: 'weakCore',
    name: 'Weak core',
    summary: 'Abdominals and deep trunk muscles produce less force.',
    scale: 'down to 50% strength when severe',
    offsets: {},
    weakness: { rectusAbdominis: 0.5, externalOblique: 0.5, internalOblique: 0.5, multifidus: 0.6, quadratusLumborum: 0.7 },
    explain: (s) => `Weak core (${r0(100 - 50 * s)}% strength): planks and lifting rely more on the hip flexors and passive spinal tissues; the lower back sags or arches more easily.`,
  },
]

export const CONDITION_BY_ID: Record<string, ConditionDef> = Object.fromEntries(CONDITIONS.map((c) => [c.id, c]))

export type ConditionLevels = Partial<Record<ConditionId, number>>

/** Add the postural offsets of all active conditions to a set of angles. */
export function applyConditions(angles: Angles, levels: ConditionLevels | undefined): Angles {
  if (!levels) return angles
  const out = { ...angles }
  for (const c of CONDITIONS) {
    const s = levels[c.id] ?? 0
    if (s <= 0) continue
    for (const [k, v] of Object.entries(c.offsets)) {
      const keys = k.includes('?') ? [k.replace('?', 'L'), k.replace('?', 'R')] : [k]
      for (const key of keys) out[key] = clampAngle(key, out[key] + v * s)
    }
  }
  return out
}

/** Strength multiplier per muscle id from the active conditions. */
export function conditionStrength(levels: ConditionLevels | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  if (!levels) return out
  for (const c of CONDITIONS) {
    const s = levels[c.id] ?? 0
    if (s <= 0 || !c.weakness) continue
    for (const [m, f] of Object.entries(c.weakness)) out[m] = (out[m] ?? 1) * (1 - (1 - f) * s)
  }
  return out
}
