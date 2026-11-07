import { Vector3 } from 'three'
import { transformDir, transformPoint, type BodyPose } from './kinematics'
import { landmark } from './landmarks'
import type { Side, Vec3 } from './skeleton'

/** A path node is a landmark name ('?' is replaced by the side) or a wrap sphere. */
export type PathNode = string | WrapNode

export interface WrapNode {
  /** Landmark used as the centre of the wrapping cylinder. */
  centre: string
  radius: number
  /** Rest-world direction (left side) of the side the path must stay on. */
  keep: Vec3
  /** Cylinder axis in rest-world coordinates (left side); default is the flexion axis (x). */
  axis?: Vec3
}

export interface ResolvedNode {
  seg: string
  p: Vec3
  wrap?: { radius: number; axis: Vec3; sign: number }
}

const mirrorX = (v: Vec3, side: Side): Vec3 => (side === 'L' ? v : [-v[0], v[1], v[2]])

export function resolvePath(nodes: PathNode[], side: Side): ResolvedNode[] {
  const out: ResolvedNode[] = nodes.map((n) => {
    if (typeof n === 'string') {
      const l = landmark(n.replace('?', side))
      return { seg: l.seg, p: l.p }
    }
    const l = landmark(n.centre.replace('?', side))
    return { seg: l.seg, p: l.p, wrap: { radius: n.radius, axis: mirrorX(n.axis ?? [1, 0, 0], side), sign: 1 } }
  })
  // Fix the push direction's sign from the rest pose so it can never flip later.
  out.forEach((node, i) => {
    if (!node.wrap) return
    const def = nodes[i] as WrapNode
    const prev = out[i - 1]
    const next = out[i + 1]
    const dir = new Vector3(next.p[0] - prev.p[0], next.p[1] - prev.p[1], next.p[2] - prev.p[2])
    // The path should pass on the `keep` side of the centre, so the centre is on the
    // opposite side: if keep is to the left of the travel direction, wind clockwise.
    const left = new Vector3(...node.wrap.axis).normalize().cross(dir)
    const keep = new Vector3(...mirrorX(def.keep, side))
    node.wrap.sign = left.dot(keep) > 0 ? -1 : 1
  })
  return out
}


const _e1 = new Vector3()
const _e2 = new Vector3()
const _rp = new Vector3()
const _rs = new Vector3()
const TWO_PI = Math.PI * 2
const normAngle = (a: number) => ((a % TWO_PI) + TWO_PI) % TWO_PI

/**
 * Shortest path from P to S around a cylinder (centre C, radius r, unit axis `axis`).
 * `winding` fixes which way the path goes round: +1 = counter-clockwise about the axis
 * (the centre stays on the path's left), -1 = clockwise. Because the direction never
 * changes, length and moment arm stay continuous as joints move.
 * In the plane perpendicular to the axis the path is tangent - arc - tangent; the axial
 * offset is spread evenly along it (a helix). If `out` is given, arc samples are appended.
 */
export function wrapSegment(P: Vector3, S: Vector3, C: Vector3, r: number, axis: Vector3, winding: number, out?: Vector3[]): number {
  const straight = P.distanceTo(S)
  _rp.subVectors(P, C)
  _rs.subVectors(S, C)
  const hP = _rp.dot(axis)
  const hS = _rs.dot(axis)
  _e1.copy(_rp).addScaledVector(axis, -hP)
  const dP = _e1.length()
  if (dP <= r * 1.0001) return straight
  _e1.divideScalar(dP)
  _e2.crossVectors(axis, _e1)
  const sx = _rs.dot(_e1)
  const sy = _rs.dot(_e2)
  const dS = Math.hypot(sx, sy)
  if (dS <= r * 1.0001) return straight
  // Signed distance of the centre from the 2D line P->S (positive = centre on the left)
  const ux = sx - dP
  const uy = sy
  const ul = Math.hypot(ux, uy)
  if (ul < 1e-9) return straight
  const cross = (ux * (0 - 0) - uy * (0 - dP)) / ul // u x (C - P), with C at the origin and P = (dP, 0)
  if (winding * cross >= r) return straight
  // Only wrap when the cylinder lies between P and S. If the centre projects beyond either
  // end (e.g. a fully bent elbow folds the insertion up beside the origin), the path does not
  // pass the cylinder at all.
  const along = (-dP * ux) / ul // (C - P) . u
  if (along <= 0 || along >= ul) return straight
  const aS = Math.atan2(sy, sx)
  const bP = Math.acos(r / dP)
  const bS = Math.acos(r / dS)
  let t1: number
  let sweep: number
  if (winding > 0) {
    t1 = bP
    sweep = normAngle(aS - bS - t1)
  } else {
    t1 = -bP
    sweep = normAngle(t1 - (aS + bS))
  }
  // A sweep near a full turn means the cylinder is not between P and S after all.
  if (sweep > Math.PI * 1.25) return straight
  const flat = Math.sqrt(dP * dP - r * r) + Math.sqrt(dS * dS - r * r) + sweep * r
  const dh = hS - hP
  const total = Math.sqrt(flat * flat + dh * dh)
  if (out) {
    const n = Math.max(2, Math.ceil(sweep / 0.2))
    const tan1 = Math.sqrt(dP * dP - r * r)
    for (let i = 0; i <= n; i++) {
      const ang = t1 + (winding > 0 ? 1 : -1) * (sweep * i) / n
      const along = tan1 + (sweep * r * i) / n
      const h = hP + (dh * along) / flat
      out.push(C.clone().addScaledVector(_e1, Math.cos(ang) * r).addScaledVector(_e2, Math.sin(ang) * r).addScaledVector(axis, h))
    }
  }
  return total
}

const _p = new Vector3()
const _s = new Vector3()
const _centre = new Vector3()
const _axis = new Vector3()

/**
 * Compute the length of a muscle path in the given pose. If `out` is given, it is filled
 * with the polyline (including wrap arcs) for rendering.
 */
export function pathLength(pose: BodyPose, nodes: ResolvedNode[], out?: Vector3[]): number {
  let length = 0
  let prev: Vector3 | null = null
  let pendingWrap: ResolvedNode | null = null
  for (const node of nodes) {
    if (node.wrap) {
      pendingWrap = node
      continue
    }
    const cur = transformPoint(pose, node.seg as never, node.p, prev === _p ? _s : _p)
    if (out) out.push(cur.clone())
    if (prev) {
      if (pendingWrap) {
        transformPoint(pose, pendingWrap.seg as never, pendingWrap.p, _centre)
        const w = pendingWrap.wrap!
        const axis = transformDir(pose, pendingWrap.seg as never, w.axis, _axis).normalize()
        if (out) {
          const via: Vector3[] = []
          length += wrapSegment(prev, cur, _centre, w.radius, axis, w.sign, via)
          const last = out.pop()!
          out.push(...via, last)
        } else {
          length += wrapSegment(prev, cur, _centre, w.radius, axis, w.sign)
        }
      } else {
        length += prev.distanceTo(cur)
      }
    }
    pendingWrap = null
    prev = cur
  }
  return length
}
