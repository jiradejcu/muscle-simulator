import type { ConditionLevels } from './conditions'
import type { Angles, Side } from './skeleton'

/**
 * Personal profile. Flexibility is expressed the way a physio measures it: as the joint
 * angle a person reaches in a standard range-of-motion test. Each muscle's comfortable
 * maximum length is the length it has in that test pose, so a lower test angle means a
 * shorter comfortable range everywhere the muscle is used.
 */
export type ProfileKey =
  | 'slr'
  | 'kneeToChest'
  | 'hipExtension'
  | 'rectusFemoris'
  | 'hipAbduction'
  | 'dfKneeStraight'
  | 'dfKneeBent'
  | 'kneeFlexion'
  | 'spineFlexion'
  | 'spineExtension'
  | 'shoulderFlexion'
  | 'chestOpener'

export interface ProfileItem {
  key: ProfileKey
  label: string
  /** Which muscles the test limits, shown in the UI. */
  muscles: string
  help: string
  normal: number
  min: number
  max: number
}

export const PROFILE_ITEMS: ProfileItem[] = [
  { key: 'slr', label: 'Straight-leg raise', muscles: 'Hamstrings', help: 'How high you can lift a straight leg while lying on your back.', normal: 80, min: 30, max: 120 },
  { key: 'kneeToChest', label: 'Knee to chest', muscles: 'Glutes', help: 'Hip bend with the knee bent, pulling the knee to the chest.', normal: 125, min: 80, max: 135 },
  { key: 'hipExtension', label: 'Hip extension (Thomas test)', muscles: 'Hip flexors (iliopsoas, TFL)', help: 'How far the thigh can drop behind the body.', normal: 15, min: -15, max: 25 },
  { key: 'rectusFemoris', label: 'Heel to buttock (lying face down)', muscles: 'Rectus femoris', help: 'Knee bend with the hip straight.', normal: 135, min: 80, max: 150 },
  { key: 'hipAbduction', label: 'Leg out to the side', muscles: 'Adductors', help: 'How far a straight leg can move out sideways.', normal: 45, min: 15, max: 50 },
  { key: 'dfKneeStraight', label: 'Ankle bend, knee straight', muscles: 'Gastrocnemius', help: 'Toes-up range with the knee locked (calf stretch against a wall).', normal: 15, min: -10, max: 35 },
  { key: 'dfKneeBent', label: 'Ankle bend, knee bent', muscles: 'Soleus', help: 'Knee-to-wall lunge: how far the shin tilts over the toes.', normal: 35, min: 5, max: 40 },
  { key: 'kneeFlexion', label: 'Full knee bend', muscles: 'Vasti (quadriceps)', help: 'How far the knee bends, e.g. sitting back on the heels.', normal: 145, min: 100, max: 150 },
  { key: 'spineFlexion', label: 'Lower back rounding', muscles: 'Erector spinae, multifidus, QL', help: 'Lumbar flexion when slumping forward.', normal: 50, min: 15, max: 55 },
  { key: 'spineExtension', label: 'Back bend', muscles: 'Abdominals and obliques', help: 'Lumbar extension when arching back.', normal: 25, min: 5, max: 30 },
  { key: 'shoulderFlexion', label: 'Arms overhead', muscles: 'Lats, teres, triceps long head', help: 'How high the arm reaches in front, without arching the back.', normal: 170, min: 110, max: 180 },
  { key: 'chestOpener', label: 'Arm back at shoulder height', muscles: 'Pectorals, front deltoid', help: 'Horizontal reach behind the body with the arm at shoulder height.', normal: 30, min: 0, max: 50 },
]

export type StrengthLevel = 'untrained' | 'average' | 'trained'

export interface Profile {
  flexibility: Record<ProfileKey, number>
  bodyMass: number
  strength: StrengthLevel
  /** Postural conditions, severity 0..1 each. */
  conditions: ConditionLevels
}

export const STRENGTH_FACTOR: Record<StrengthLevel, number> = { untrained: 0.7, average: 1, trained: 1.4 }

export function defaultProfile(): Profile {
  const flexibility = {} as Record<ProfileKey, number>
  for (const item of PROFILE_ITEMS) flexibility[item.key] = item.normal
  return { flexibility, bodyMass: 70, strength: 'average', conditions: {} }
}

export interface ProfilePreset {
  id: string
  label: string
  description: string
  values: Partial<Record<ProfileKey, number>>
}

export const PROFILE_PRESETS: ProfilePreset[] = [
  { id: 'normal', label: 'Typical', description: 'Average adult flexibility.', values: {} },
  {
    id: 'desk',
    label: 'Desk worker',
    description: 'Tight hamstrings, hip flexors and chest; stiff back.',
    values: { slr: 55, hipExtension: 0, rectusFemoris: 115, chestOpener: 10, shoulderFlexion: 150, spineExtension: 15, kneeToChest: 110 },
  },
  {
    id: 'runner',
    label: 'Runner',
    description: 'Tight calves and hamstrings.',
    values: { slr: 60, dfKneeStraight: 5, dfKneeBent: 20, rectusFemoris: 120 },
  },
  {
    id: 'yoga',
    label: 'Very flexible',
    description: 'Above-average range almost everywhere.',
    values: { slr: 110, kneeToChest: 135, hipExtension: 25, rectusFemoris: 150, hipAbduction: 50, dfKneeStraight: 25, dfKneeBent: 40, spineFlexion: 55, spineExtension: 30, shoulderFlexion: 180, chestOpener: 45 },
  },
]

/** A stretch test: the pose (for one side) where a muscle reaches its comfortable maximum. */
export interface StretchTest {
  profileKey?: ProfileKey
  /** Value used when there is no profile key. */
  value?: number
  angles: (v: number, side: Side) => Angles
}

/** Side-specific DOF key helper: k('hip', side, 'flexion') -> "hipL.flexion". */
const k = (joint: string, side: Side, dof: string) => `${joint}${side}.${dof}`

export const TESTS = {
  slr: { profileKey: 'slr', angles: (v, s) => ({ [k('hip', s, 'flexion')]: v }) },
  kneeToChest: { profileKey: 'kneeToChest', angles: (v, s) => ({ [k('hip', s, 'flexion')]: v, [k('knee', s, 'flexion')]: 140 }) },
  hipExtension: { profileKey: 'hipExtension', angles: (v, s) => ({ [k('hip', s, 'flexion')]: -v }) },
  rectusFemoris: { profileKey: 'rectusFemoris', angles: (v, s) => ({ [k('knee', s, 'flexion')]: v }) },
  hipAbduction: { profileKey: 'hipAbduction', angles: (v, s) => ({ [k('hip', s, 'abduction')]: v }) },
  hipCrossBody: { value: 30, angles: (v, s) => ({ [k('hip', s, 'flexion')]: 80, [k('hip', s, 'abduction')]: -v, [k('hip', s, 'rotation')]: -30 }) },
  hipAbductorStretch: { value: 25, angles: (v, s) => ({ [k('hip', s, 'abduction')]: -v, [k('hip', s, 'flexion')]: -10 }) },
  dfKneeStraight: { profileKey: 'dfKneeStraight', angles: (v, s) => ({ [k('ankle', s, 'dorsiflexion')]: v }) },
  dfKneeBent: { profileKey: 'dfKneeBent', angles: (v, s) => ({ [k('ankle', s, 'dorsiflexion')]: v, [k('knee', s, 'flexion')]: 90 }) },
  plantarflexion: { value: 45, angles: (v, s) => ({ [k('ankle', s, 'dorsiflexion')]: -v }) },
  kneeFlexion: { profileKey: 'kneeFlexion', angles: (v, s) => ({ [k('knee', s, 'flexion')]: v, [k('hip', s, 'flexion')]: 20 }) },
  spineFlexion: { profileKey: 'spineFlexion', angles: (v) => ({ 'lumbar.flexion': v, 'thoracic.flexion': v * 0.8 }) },
  spineExtension: { profileKey: 'spineExtension', angles: (v) => ({ 'lumbar.flexion': -v, 'thoracic.flexion': -v * 0.8 }) },
  sideBend: { value: 25, angles: (v, s) => ({ 'lumbar.lateral': s === 'L' ? -v : v, 'thoracic.lateral': s === 'L' ? -v : v, 'lumbar.flexion': -10 }) },
  shoulderFlexion: { profileKey: 'shoulderFlexion', angles: (v, s) => ({ [k('shoulder', s, 'elevation')]: v, [k('shoulder', s, 'plane')]: 90, [k('shoulder', s, 'rotation')]: -20 }) },
  chestOpener: { profileKey: 'chestOpener', angles: (v, s) => ({ [k('shoulder', s, 'elevation')]: 90, [k('shoulder', s, 'plane')]: -v, [k('shoulder', s, 'rotation')]: -45 }) },
  shoulderExtension: { value: 55, angles: (v, s) => ({ [k('shoulder', s, 'elevation')]: v, [k('shoulder', s, 'plane')]: -90, [k('elbow', s, 'flexion')]: 0, [k('wrist', s, 'flexion')]: -30 }) },
  crossBody: { value: 40, angles: (v, s) => ({ [k('shoulder', s, 'elevation')]: 90, [k('shoulder', s, 'plane')]: 90 + v }) },
  shoulderAdduction: { value: 25, angles: (v, s) => ({ [k('shoulder', s, 'elevation')]: v, [k('shoulder', s, 'plane')]: 120 }) },
  internalRotation: { value: 70, angles: (v, s) => ({ [k('shoulder', s, 'elevation')]: 80, [k('shoulder', s, 'plane')]: 20, [k('shoulder', s, 'rotation')]: v }) },
  externalRotation: { value: 85, angles: (v, s) => ({ [k('shoulder', s, 'elevation')]: 80, [k('shoulder', s, 'plane')]: 20, [k('shoulder', s, 'rotation')]: -v }) },
  overheadElbow: { value: 145, angles: (v, s) => ({ [k('shoulder', s, 'elevation')]: 165, [k('shoulder', s, 'plane')]: 90, [k('elbow', s, 'flexion')]: v }) },
  elbowExtension: { value: 5, angles: (v, s) => ({ [k('elbow', s, 'flexion')]: -v }) },
  wristExtension: { value: 70, angles: (v, s) => ({ [k('wrist', s, 'flexion')]: -v }) },
  wristFlexion: { value: 80, angles: (v, s) => ({ [k('wrist', s, 'flexion')]: v }) },
  scapulaProtraction: { value: 30, angles: (v, s) => ({ [k('scapula', s, 'protraction')]: v, [k('shoulder', s, 'elevation')]: 90, [k('shoulder', s, 'plane')]: 110 }) },
  scapulaRetraction: { value: 25, angles: (v, s) => ({ [k('scapula', s, 'protraction')]: -v }) },
  scapulaElevation: { value: 35, angles: (v, s) => ({ [k('scapula', s, 'elevation')]: v, [k('shoulder', s, 'elevation')]: 170, [k('shoulder', s, 'plane')]: 90 }) },
  upperTrap: { value: 40, angles: (v, s) => ({ 'neck.flexion': v, 'neck.lateral': s === 'L' ? -v : v, [k('scapula', s, 'elevation')]: -10 }) },
  neckFlexion: { value: 50, angles: (v) => ({ 'neck.flexion': v }) },
  neckExtension: { value: 60, angles: (v, s) => ({ 'neck.flexion': -v, 'neck.rotation': s === 'L' ? 30 : -30 }) },
} satisfies Record<string, StretchTest>

export type TestId = keyof typeof TESTS

export function testValue(test: StretchTest, profile: Profile): number {
  if (test.profileKey) return profile.flexibility[test.profileKey]
  return test.value ?? 0
}
