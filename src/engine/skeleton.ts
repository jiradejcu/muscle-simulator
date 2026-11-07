/**
 * Skeleton definition.
 *
 * Coordinate system (metres): +Y up, +Z forward (the way the body faces), +X to the
 * body's LEFT. All "rest" coordinates describe a 1.75 m adult standing in the anatomical
 * position (arms at the sides, palms forward) with the feet on the ground (y = 0).
 *
 * Every segment's local frame is aligned with the world frame at rest and has its origin
 * at its proximal joint centre. That way any point given in rest-world coordinates can be
 * moved with the segment by a single matrix (see kinematics.ts).
 */

export type Side = 'L' | 'R'
export type Vec3 = [number, number, number]

export type SegmentId =
  | 'pelvis'
  | 'lumbar'
  | 'thorax'
  | 'head'
  | 'scapulaL' | 'scapulaR'
  | 'humerusL' | 'humerusR'
  | 'forearmL' | 'forearmR'
  | 'handL' | 'handR'
  | 'thighL' | 'thighR'
  | 'shankL' | 'shankR'
  | 'footL' | 'footR'

export type JointId =
  | 'lumbar'
  | 'thoracic'
  | 'neck'
  | 'scapulaL' | 'scapulaR'
  | 'shoulderL' | 'shoulderR'
  | 'elbowL' | 'elbowR'
  | 'wristL' | 'wristR'
  | 'hipL' | 'hipR'
  | 'kneeL' | 'kneeR'
  | 'ankleL' | 'ankleR'

/** A degree of freedom key, e.g. "hipL.flexion". */
export type DofKey = string

export type Angles = Record<DofKey, number>

export interface DofDef {
  key: DofKey
  joint: JointId
  name: string
  label: string
  min: number
  max: number
  /** Short words for the positive / negative direction, used in the UI. */
  positive: string
  negative: string
}

/** One elementary rotation inside a joint. Angles are applied in list order. */
export interface RotationStep {
  axis: 'x' | 'y' | 'z'
  dof: string
  /** Multiplier for the DOF angle (sign convention, before left/right mirroring). */
  factor: number
}

export interface JointDef {
  id: JointId
  label: string
  /** Segment this joint moves (its child). */
  segment: SegmentId
  parent: SegmentId | null
  side: Side | null
  steps: RotationStep[]
  dofs: { name: string; label: string; min: number; max: number; positive: string; negative: string }[]
}

export interface SegmentDef {
  id: SegmentId
  label: string
  parent: SegmentId | null
  joint: JointId | null
  /** Rest-world position of the segment origin (its proximal joint centre). */
  origin: Vec3
  /** Fraction of total body mass. */
  massFraction: number
  /** Rest-world position of the centre of mass. */
  com: Vec3
  /** Rest-world position of the distal end, used for drawing and ground checks. */
  end: Vec3
}

const mirror = (p: Vec3): Vec3 => [-p[0], p[1], p[2]]

/** Build left and right copies of a point given for the LEFT side. */
export function sided(p: Vec3, side: Side): Vec3 {
  return side === 'L' ? p : mirror(p)
}

// ---------------------------------------------------------------------------
// Key rest positions (left side where sided)
// ---------------------------------------------------------------------------
export const REST = {
  hipCentre: [0, 0.925, 0] as Vec3,
  hip: [0.085, 0.925, 0] as Vec3,
  knee: [0.09, 0.505, 0] as Vec3,
  ankle: [0.09, 0.075, 0] as Vec3,
  lumbosacral: [0, 1.02, -0.055] as Vec3,
  thoracolumbar: [0, 1.2, -0.065] as Vec3,
  cervicothoracic: [0, 1.48, -0.065] as Vec3,
  sternoclavicular: [0.025, 1.43, 0.055] as Vec3,
  shoulder: [0.19, 1.41, -0.01] as Vec3,
  elbow: [0.205, 1.11, -0.01] as Vec3,
  wrist: [0.215, 0.86, 0] as Vec3,
}

// ---------------------------------------------------------------------------
// Joints
// ---------------------------------------------------------------------------
const spineDofs = (flex: [number, number], lat: number, rot: number) => [
  { name: 'flexion', label: 'Flexion / extension', min: flex[0], max: flex[1], positive: 'bend forward', negative: 'arch back' },
  { name: 'lateral', label: 'Side bend', min: -lat, max: lat, positive: 'to the left', negative: 'to the right' },
  { name: 'rotation', label: 'Rotation', min: -rot, max: rot, positive: 'to the left', negative: 'to the right' },
]

const spineSteps: RotationStep[] = [
  { axis: 'x', dof: 'flexion', factor: 1 },
  { axis: 'z', dof: 'lateral', factor: -1 },
  { axis: 'y', dof: 'rotation', factor: 1 },
]

function sidedJoints(side: Side): JointDef[] {
  const s = side
  const name = side === 'L' ? 'Left' : 'Right'
  return [
    {
      id: `scapula${s}` as JointId,
      label: `${name} shoulder blade`,
      segment: `scapula${s}` as SegmentId,
      parent: 'thorax',
      side,
      steps: [
        { axis: 'y', dof: 'protraction', factor: -1 },
        { axis: 'z', dof: 'elevation', factor: 1 },
      ],
      dofs: [
        { name: 'elevation', label: 'Elevation', min: -10, max: 35, positive: 'shrug up', negative: 'pull down' },
        { name: 'protraction', label: 'Protraction', min: -25, max: 30, positive: 'reach forward', negative: 'squeeze back' },
      ],
    },
    {
      id: `shoulder${s}` as JointId,
      label: `${name} shoulder`,
      segment: `humerus${s}` as SegmentId,
      parent: `scapula${s}` as SegmentId,
      side,
      // ISB-style "plane of elevation / elevation / axial rotation" so the arm can be raised
      // in any direction without gimbal problems.
      steps: [
        { axis: 'y', dof: 'plane', factor: -1 },
        { axis: 'z', dof: 'elevation', factor: 1 },
        { axis: 'y', dof: 'plane', factor: 1 },
        { axis: 'y', dof: 'rotation', factor: -1 },
      ],
      dofs: [
        { name: 'elevation', label: 'Arm raise', min: 0, max: 180, positive: 'raise', negative: 'lower' },
        { name: 'plane', label: 'Raise direction (0° side, 90° front)', min: -80, max: 140, positive: 'toward front', negative: 'toward back' },
        { name: 'rotation', label: 'Internal / external rotation', min: -90, max: 80, positive: 'internal', negative: 'external' },
      ],
    },
    {
      id: `elbow${s}` as JointId,
      label: `${name} elbow`,
      segment: `forearm${s}` as SegmentId,
      parent: `humerus${s}` as SegmentId,
      side,
      steps: [{ axis: 'x', dof: 'flexion', factor: -1 }],
      dofs: [{ name: 'flexion', label: 'Flexion', min: -8, max: 150, positive: 'bend', negative: 'straighten' }],
    },
    {
      id: `wrist${s}` as JointId,
      label: `${name} wrist`,
      segment: `hand${s}` as SegmentId,
      parent: `forearm${s}` as SegmentId,
      side,
      steps: [{ axis: 'x', dof: 'flexion', factor: -1 }],
      dofs: [{ name: 'flexion', label: 'Flexion / extension', min: -80, max: 80, positive: 'palm-side bend', negative: 'back-of-hand bend' }],
    },
    {
      id: `hip${s}` as JointId,
      label: `${name} hip`,
      segment: `thigh${s}` as SegmentId,
      parent: 'pelvis',
      side,
      steps: [
        { axis: 'x', dof: 'flexion', factor: -1 },
        { axis: 'z', dof: 'abduction', factor: 1 },
        { axis: 'y', dof: 'rotation', factor: -1 },
      ],
      dofs: [
        { name: 'flexion', label: 'Flexion / extension', min: -25, max: 135, positive: 'bend', negative: 'extend' },
        { name: 'abduction', label: 'Abduction / adduction', min: -30, max: 50, positive: 'out to side', negative: 'across midline' },
        { name: 'rotation', label: 'Internal / external rotation', min: -50, max: 45, positive: 'internal', negative: 'external' },
      ],
    },
    {
      id: `knee${s}` as JointId,
      label: `${name} knee`,
      segment: `shank${s}` as SegmentId,
      parent: `thigh${s}` as SegmentId,
      side,
      steps: [{ axis: 'x', dof: 'flexion', factor: 1 }],
      dofs: [{ name: 'flexion', label: 'Flexion', min: -10, max: 150, positive: 'bend', negative: 'straighten' }],
    },
    {
      id: `ankle${s}` as JointId,
      label: `${name} ankle`,
      segment: `foot${s}` as SegmentId,
      parent: `shank${s}` as SegmentId,
      side,
      steps: [
        { axis: 'x', dof: 'dorsiflexion', factor: -1 },
        { axis: 'z', dof: 'inversion', factor: -1 },
      ],
      dofs: [
        { name: 'dorsiflexion', label: 'Dorsiflexion / plantarflexion', min: -50, max: 40, positive: 'toes up', negative: 'point toes' },
        { name: 'inversion', label: 'Inversion / eversion', min: -20, max: 30, positive: 'sole inward', negative: 'sole outward' },
      ],
    },
  ]
}

export const JOINTS: JointDef[] = [
  { id: 'lumbar', label: 'Lower back', segment: 'lumbar', parent: 'pelvis', side: null, steps: spineSteps, dofs: spineDofs([-30, 55], 25, 12) },
  { id: 'thoracic', label: 'Upper back', segment: 'thorax', parent: 'lumbar', side: null, steps: spineSteps, dofs: spineDofs([-25, 45], 25, 40) },
  { id: 'neck', label: 'Neck', segment: 'head', parent: 'thorax', side: null, steps: spineSteps, dofs: spineDofs([-65, 50], 40, 75) },
  ...sidedJoints('L'),
  ...sidedJoints('R'),
]

export const JOINT_BY_ID: Record<string, JointDef> = Object.fromEntries(JOINTS.map((j) => [j.id, j]))

export const DOFS: DofDef[] = JOINTS.flatMap((j) =>
  j.dofs.map((d) => ({
    key: `${j.id}.${d.name}`,
    joint: j.id,
    name: d.name,
    label: d.label,
    min: d.min,
    max: d.max,
    positive: d.positive,
    negative: d.negative,
  })),
)

export const DOF_BY_KEY: Record<string, DofDef> = Object.fromEntries(DOFS.map((d) => [d.key, d]))

/** Whole-body orientation (only used when a pose does not auto-level on its contacts). */
export interface RootPose {
  pitch: number
  roll: number
}

// ---------------------------------------------------------------------------
// Segments (masses after Winter, 2009)
// ---------------------------------------------------------------------------
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

function sidedSegments(side: Side): SegmentDef[] {
  const s = side
  const p = (v: Vec3) => sided(v, side)
  const name = side === 'L' ? 'Left' : 'Right'
  const handEnd: Vec3 = [0.215, 0.67, 0.01]
  const toe: Vec3 = [0.085, 0.01, 0.2]
  return [
    { id: `scapula${s}` as SegmentId, label: `${name} shoulder girdle`, parent: 'thorax', joint: `scapula${s}` as JointId, origin: p(REST.sternoclavicular), massFraction: 0, com: p([0.12, 1.4, -0.04]), end: p(REST.shoulder) },
    { id: `humerus${s}` as SegmentId, label: `${name} upper arm`, parent: `scapula${s}` as SegmentId, joint: `shoulder${s}` as JointId, origin: p(REST.shoulder), massFraction: 0.028, com: p(lerp3(REST.shoulder, REST.elbow, 0.436)), end: p(REST.elbow) },
    { id: `forearm${s}` as SegmentId, label: `${name} forearm`, parent: `humerus${s}` as SegmentId, joint: `elbow${s}` as JointId, origin: p(REST.elbow), massFraction: 0.016, com: p(lerp3(REST.elbow, REST.wrist, 0.43)), end: p(REST.wrist) },
    { id: `hand${s}` as SegmentId, label: `${name} hand`, parent: `forearm${s}` as SegmentId, joint: `wrist${s}` as JointId, origin: p(REST.wrist), massFraction: 0.006, com: p(lerp3(REST.wrist, handEnd, 0.5)), end: p(handEnd) },
    { id: `thigh${s}` as SegmentId, label: `${name} thigh`, parent: 'pelvis', joint: `hip${s}` as JointId, origin: p(REST.hip), massFraction: 0.1, com: p(lerp3(REST.hip, REST.knee, 0.433)), end: p(REST.knee) },
    { id: `shank${s}` as SegmentId, label: `${name} shank`, parent: `thigh${s}` as SegmentId, joint: `knee${s}` as JointId, origin: p(REST.knee), massFraction: 0.0465, com: p(lerp3(REST.knee, REST.ankle, 0.433)), end: p(REST.ankle) },
    { id: `foot${s}` as SegmentId, label: `${name} foot`, parent: `shank${s}` as SegmentId, joint: `ankle${s}` as JointId, origin: p(REST.ankle), massFraction: 0.0145, com: p([0.088, 0.04, 0.05]), end: p(toe) },
  ]
}

export const SEGMENTS: SegmentDef[] = [
  { id: 'pelvis', label: 'Pelvis', parent: null, joint: null, origin: REST.hipCentre, massFraction: 0.142, com: [0, 0.97, -0.02], end: REST.lumbosacral },
  { id: 'lumbar', label: 'Abdomen / lumbar spine', parent: 'pelvis', joint: 'lumbar', origin: REST.lumbosacral, massFraction: 0.139, com: [0, 1.11, 0.0], end: REST.thoracolumbar },
  { id: 'thorax', label: 'Chest / thoracic spine', parent: 'lumbar', joint: 'thoracic', origin: REST.thoracolumbar, massFraction: 0.216, com: [0, 1.33, -0.01], end: REST.cervicothoracic },
  { id: 'head', label: 'Head and neck', parent: 'thorax', joint: 'neck', origin: REST.cervicothoracic, massFraction: 0.081, com: [0, 1.62, 0.0], end: [0, 1.75, 0] },
  ...sidedSegments('L'),
  ...sidedSegments('R'),
]

export const SEGMENT_BY_ID: Record<string, SegmentDef> = Object.fromEntries(SEGMENTS.map((s) => [s.id, s])) as Record<SegmentId, SegmentDef>

/** Neutral standing pose: every DOF at zero. */
export function neutralAngles(): Angles {
  const a: Angles = {}
  for (const d of DOFS) a[d.key] = 0
  return a
}

export function clampAngle(key: DofKey, value: number): number {
  const d = DOF_BY_KEY[key]
  if (!d) return value
  return Math.min(d.max, Math.max(d.min, value))
}

export function clampAngles(a: Angles): Angles {
  const out: Angles = {}
  for (const d of DOFS) out[d.key] = clampAngle(d.key, a[d.key] ?? 0)
  return out
}

/** Expand "hip?.flexion" into ["hipL.flexion", "hipR.flexion"]. */
export function expandSides(key: string, sides: Side[] = ['L', 'R']): string[] {
  return key.includes('?') ? sides.map((s) => key.replace('?', s)) : [key]
}

/** Children of each segment, in definition order. */
export const SEGMENT_CHILDREN: Record<string, SegmentId[]> = (() => {
  const m: Record<string, SegmentId[]> = {}
  for (const s of SEGMENTS) {
    m[s.id] = m[s.id] ?? []
    if (s.parent) (m[s.parent] = m[s.parent] ?? []).push(s.id)
  }
  return m
})()

/** All segments in the subtree rooted at `id` (inclusive). */
export function subtree(id: SegmentId): SegmentId[] {
  const out: SegmentId[] = [id]
  for (let i = 0; i < out.length; i++) out.push(...(SEGMENT_CHILDREN[out[i]] ?? []))
  return out
}
