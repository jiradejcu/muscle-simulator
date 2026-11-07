import { Matrix4, Quaternion, Vector3 } from 'three'
import {
  JOINT_BY_ID,
  SEGMENTS,
  SEGMENT_BY_ID,
  type Angles,
  type SegmentId,
  type Vec3,
} from './skeleton'

const DEG = Math.PI / 180

/** Rigid transform of a segment: worldPoint = q * (restPoint - restOrigin) + t */
export interface SegmentPose {
  q: Quaternion
  t: Vector3
}

export interface RootTransform {
  /** Whole-body orientation in degrees: pitch about +X (forward), roll about +Z. */
  pitch: number
  roll: number
  /** World position of the pelvis origin (hip centre). */
  position: Vector3
}

export type BodyPose = Record<SegmentId, SegmentPose>

const AXES = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) }
const _q = new Quaternion()

/** Local rotation of a joint for the given angles (degrees). */
export function jointRotation(jointId: string, angles: Angles, out = new Quaternion()): Quaternion {
  const j = JOINT_BY_ID[jointId]
  out.identity()
  for (const step of j.steps) {
    let a = (angles[`${j.id}.${step.dof}`] ?? 0) * step.factor
    // Mirror the right side: rotations about Y and Z change sign.
    if (j.side === 'R' && step.axis !== 'x') a = -a
    if (a !== 0) out.multiply(_q.setFromAxisAngle(AXES[step.axis], a * DEG))
  }
  return out
}

export function rootQuaternion(pitch: number, roll: number, out = new Quaternion()): Quaternion {
  out.setFromAxisAngle(AXES.x, pitch * DEG)
  return out.multiply(_q.setFromAxisAngle(AXES.z, roll * DEG))
}

/**
 * Forward kinematics. Segments are listed parent-first in SEGMENTS, so one pass suffices.
 */
export function forwardKinematics(angles: Angles, root: RootTransform): BodyPose {
  const pose = {} as BodyPose
  const tmp = new Vector3()
  for (const seg of SEGMENTS) {
    if (!seg.parent) {
      pose[seg.id] = { q: rootQuaternion(root.pitch, root.roll), t: root.position.clone() }
      continue
    }
    const parent = pose[seg.parent]
    const pDef = SEGMENT_BY_ID[seg.parent]
    // Joint centre in world = parent transform applied to the child's rest origin.
    tmp.set(seg.origin[0] - pDef.origin[0], seg.origin[1] - pDef.origin[1], seg.origin[2] - pDef.origin[2])
    const t = tmp.clone().applyQuaternion(parent.q).add(parent.t)
    const q = parent.q.clone().multiply(jointRotation(seg.joint!, angles))
    pose[seg.id] = { q, t }
  }
  return pose
}

/** Transform a rest-world point attached to a segment into the current world. */
export function transformPoint(pose: BodyPose, seg: SegmentId, p: Vec3, out = new Vector3()): Vector3 {
  const s = pose[seg]
  const o = SEGMENT_BY_ID[seg].origin
  return out.set(p[0] - o[0], p[1] - o[1], p[2] - o[2]).applyQuaternion(s.q).add(s.t)
}

/** Transform a rest-world direction attached to a segment. */
export function transformDir(pose: BodyPose, seg: SegmentId, d: Vec3, out = new Vector3()): Vector3 {
  return out.set(d[0], d[1], d[2]).applyQuaternion(pose[seg].q)
}

/** 4x4 matrix mapping rest-world coordinates to current world (for rendering rigid meshes). */
export function segmentMatrix(pose: BodyPose, seg: SegmentId, out = new Matrix4()): Matrix4 {
  const s = pose[seg]
  const o = SEGMENT_BY_ID[seg].origin
  out.makeRotationFromQuaternion(s.q)
  const offset = new Vector3(-o[0], -o[1], -o[2]).applyQuaternion(s.q).add(s.t)
  out.setPosition(offset)
  return out
}

/** World position of each joint centre (= the segment origin). */
export function jointPosition(pose: BodyPose, seg: SegmentId): Vector3 {
  return pose[seg].t.clone()
}
