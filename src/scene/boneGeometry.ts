import {
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type BufferAttribute,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { REST, sided, type SegmentId, type Side, type Vec3 } from '../engine/skeleton'

/*
 * Stylised but anatomically placed bones, generated in code. Coordinates are rest-world
 * metres (see engine/skeleton.ts), so each segment's mesh can be moved by one matrix.
 * Real bone meshes (e.g. from Z-Anatomy or BodyParts3D) can replace these per segment; see
 * Bones.tsx for the loader.
 */

const v = (p: Vec3) => new Vector3(p[0], p[1], p[2])

/** Tube along a smooth curve with a radius that can vary along it. */
function tube(points: Vec3[], radius: number | ((t: number) => number), radial = 10, segments = 24): BufferGeometry {
  const curve = new CatmullRomCurve3(points.map(v), false, 'centripetal')
  const r0 = typeof radius === 'number' ? radius : 1
  const geo = new TubeGeometry(curve, segments, r0, radial, false)
  if (typeof radius === 'function') {
    // Rescale each ring around the curve to the requested radius
    const pos = geo.attributes.position as BufferAttribute
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const c = curve.getPointAt(t)
      const r = radius(t)
      for (let j = 0; j <= radial; j++) {
        const idx = i * (radial + 1) + j
        const p = new Vector3().fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c)
        pos.setXYZ(idx, p.x, p.y, p.z)
      }
    }
    geo.computeVertexNormals()
  }
  return capEnds(geo, curve, radius)
}

function capEnds(geo: BufferGeometry, curve: CatmullRomCurve3, radius: number | ((t: number) => number)): BufferGeometry {
  const r = (t: number) => (typeof radius === 'number' ? radius : radius(t))
  const a = ellipsoid(curve.getPointAt(0).toArray() as Vec3, [r(0), r(0), r(0)], 8)
  const b = ellipsoid(curve.getPointAt(1).toArray() as Vec3, [r(1), r(1), r(1)], 8)
  return merge([geo, a, b])
}

function ellipsoid(c: Vec3, s: Vec3, detail = 14, rot?: Quaternion): BufferGeometry {
  const g = new SphereGeometry(1, detail, Math.max(6, Math.round(detail * 0.7)))
  const m = new Matrix4().compose(v(c), rot ?? new Quaternion(), v(s))
  g.applyMatrix4(m)
  return g
}

/** Cylinder between two points. */
function rod(a: Vec3, b: Vec3, r1: number, r2 = r1, radial = 10): BufferGeometry {
  const A = v(a)
  const B = v(b)
  const len = A.distanceTo(B)
  const g = new CylinderGeometry(r2, r1, len, radial, 1, false)
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), B.clone().sub(A).normalize())
  g.applyMatrix4(new Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new Vector3(1, 1, 1)))
  return g
}

function merge(list: BufferGeometry[]): BufferGeometry {
  const clean = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g
    for (const name of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(name)) n.deleteAttribute(name)
    if (!n.attributes.uv) {
      n.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2))
    }
    return n
  })
  return mergeGeometries(clean, false)!
}

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// ---------------------------------------------------------------------------
// Spine helpers
// ---------------------------------------------------------------------------
/** Centre line of the vertebral bodies from sacrum to skull, rest-world. */
const SPINE_CURVE = new CatmullRomCurve3(
  [
    [0, 0.985, -0.06],
    [0, 1.02, -0.055],
    [0, 1.1, -0.035],
    [0, 1.2, -0.055],
    [0, 1.32, -0.085],
    [0, 1.44, -0.07],
    [0, 1.48, -0.06],
    [0, 1.54, -0.045],
    [0, 1.59, -0.03],
  ].map((p) => v(p as Vec3)),
)

function spineAtY(y: number): Vector3 {
  // Find the point on the curve at the given height (curve is monotonic in y)
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (SPINE_CURVE.getPoint(mid).y < y) lo = mid
    else hi = mid
  }
  return SPINE_CURVE.getPoint((lo + hi) / 2)
}

function vertebra(y: number, body: number, height: number, spinous: number, transverse: number): BufferGeometry[] {
  const c = spineAtY(y)
  const out = [rod([c.x, c.y - height / 2, c.z], [c.x, c.y + height / 2, c.z], body, body, 12)]
  // Spinous process slants down and back
  out.push(rod([c.x, c.y, c.z - body * 0.8], [c.x, c.y - height * 0.5, c.z - body - spinous], body * 0.28, body * 0.18, 6))
  // Transverse processes
  for (const s of [1, -1]) out.push(rod([c.x, c.y, c.z - body * 0.7], [c.x + s * transverse, c.y, c.z - body * 1.1], body * 0.22, body * 0.15, 6))
  return out
}

// ---------------------------------------------------------------------------
// Bones per segment
// ---------------------------------------------------------------------------
function pelvis(): BufferGeometry {
  const parts: BufferGeometry[] = []
  // Sacrum: tapered wedge
  parts.push(tube([[0, 1.0, -0.07], [0, 0.96, -0.095], [0, 0.92, -0.1], [0, 0.895, -0.09]], (t) => 0.045 * (1 - t * 0.7), 10, 12))
  for (const side of ['L', 'R'] as Side[]) {
    const p = (q: Vec3) => sided(q, side)
    // Iliac wing: a curved fan from the sacroiliac joint to the crest
    const crest: Vec3[] = [p([0.04, 1.03, -0.09]), p([0.09, 1.055, -0.075]), p([0.135, 1.05, -0.03]), p([0.14, 1.035, 0.02]), p([0.12, 1.0, 0.065])]
    parts.push(tube(crest, 0.009, 8, 20))
    // Wing surface: tubes from acetabulum region up to the crest, fanning out
    const base = p([0.085, 0.94, -0.01])
    for (let i = 0; i < crest.length; i++) {
      const top = crest[i]
      const mid = lerp3(base, top, 0.55)
      const bulge: Vec3 = [mid[0] + (side === 'L' ? 0.012 : -0.012), mid[1], mid[2]]
      parts.push(tube([base, bulge, top], (t) => 0.012 + 0.006 * Math.sin(Math.PI * t), 8, 10))
    }
    // Acetabulum rim
    parts.push(ellipsoid(p(REST.hip), [0.03, 0.03, 0.03], 12))
    // Pubic and ischial rami forming the obturator ring
    parts.push(tube([p([0.08, 0.93, 0.03]), p([0.06, 0.915, 0.06]), p([0.025, 0.9, 0.065]), p([0.006, 0.895, 0.06])], 0.011, 8, 12))
    parts.push(tube([p([0.025, 0.89, 0.06]), p([0.04, 0.865, 0.03]), p([0.06, 0.855, -0.03]), p([0.08, 0.9, -0.04]), p([0.085, 0.93, -0.03])], 0.012, 8, 14))
    parts.push(ellipsoid(p([0.065, 0.855, -0.05]), [0.017, 0.014, 0.02], 10)) // ischial tuberosity
  }
  return merge(parts)
}

function lumbar(): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (let i = 0; i < 5; i++) {
    const y = 1.035 + i * 0.034
    parts.push(...vertebra(y, 0.021, 0.024, 0.03, 0.04))
  }
  return merge(parts)
}

function thorax(): BufferGeometry {
  const parts: BufferGeometry[] = []
  // Thoracic vertebrae T12..T1
  for (let i = 0; i < 12; i++) {
    const y = 1.21 + i * 0.022
    parts.push(...vertebra(y, 0.016 - i * 0.0004, 0.017, 0.032, 0.03))
  }
  // Sternum
  parts.push(tube([[0, 1.42, 0.07], [0, 1.37, 0.098], [0, 1.31, 0.11], [0, 1.265, 0.108]], (t) => 0.016 - t * 0.005, 8, 12))
  parts.push(ellipsoid([0, 1.248, 0.104], [0.008, 0.012, 0.004], 8)) // xiphoid
  // Ribs 1..12
  for (let i = 0; i < 12; i++) {
    const rib = i + 1
    const yBack = 1.45 - i * 0.021
    const c = spineAtY(yBack)
    const width = 0.06 + Math.min(rib, 8) * 0.012 - Math.max(0, rib - 9) * 0.008
    const depthBack = -0.11 + Math.min(rib, 7) * -0.002
    const drop = 0.06 + rib * 0.006
    const front = rib <= 7 ? 0.1 + Math.min(rib, 5) * 0.003 : 0.095 - (rib - 7) * 0.012
    const frontX = rib <= 7 ? 0.025 : 0.05 + (rib - 7) * 0.015
    for (const side of ['L', 'R'] as Side[]) {
      const p = (q: Vec3) => sided(q, side)
      const reach = rib >= 11 ? 0.55 : 1
      const pts: Vec3[] = [
        p([0.015, c.y, c.z - 0.01]),
        p([0.05, yBack + 0.004, depthBack]),
        p([width * 0.95, yBack - drop * 0.15, depthBack * 0.45]),
        p([width, yBack - drop * 0.45, 0.02]),
      ]
      if (reach === 1) {
        pts.push(p([width * 0.8, yBack - drop * 0.75, front * 0.8]))
        pts.push(p([frontX, yBack - drop, front]))
      }
      parts.push(tube(pts, 0.0055, 6, 18))
      if (rib <= 10) {
        // Costal cartilage to the sternum
        const s = rib <= 7 ? 1.41 - rib * 0.022 : 1.27
        parts.push(tube([p([frontX, yBack - drop, front]), p([0.012, s, 0.1 + Math.min(rib, 5) * 0.002])], 0.005, 6, 6))
      }
    }
  }
  return merge(parts)
}

function head(): BufferGeometry {
  const parts: BufferGeometry[] = []
  // Cervical vertebrae C7..C1
  for (let i = 0; i < 7; i++) parts.push(...vertebra(1.49 + i * 0.016, 0.013, 0.012, i === 0 ? 0.03 : 0.018, 0.022))
  // Cranium
  parts.push(ellipsoid([0, 1.675, -0.005], [0.072, 0.075, 0.093], 24))
  // Face / maxilla
  parts.push(ellipsoid([0, 1.625, 0.055], [0.05, 0.045, 0.045], 16))
  // Zygomatic arches
  for (const s of [1, -1]) parts.push(rod([s * 0.055, 1.63, 0.06], [s * 0.065, 1.625, 0.0], 0.008, 0.007))
  // Mandible: U-shaped tube
  parts.push(tube([[0.055, 1.62, -0.01], [0.052, 1.575, 0.03], [0.03, 1.56, 0.075], [0, 1.555, 0.09], [-0.03, 1.56, 0.075], [-0.052, 1.575, 0.03], [-0.055, 1.62, -0.01]], 0.009, 8, 24))
  // Eye sockets (dark impression is faked by small inset spheres)
  return merge(parts)
}

function scapula(side: Side): BufferGeometry {
  const p = (q: Vec3) => sided(q, side)
  const parts: BufferGeometry[] = []
  // Clavicle (S-shaped)
  parts.push(tube([p([0.03, 1.43, 0.06]), p([0.07, 1.44, 0.065]), p([0.12, 1.445, 0.04]), p([0.165, 1.45, 0.005]), p([0.18, 1.45, -0.01])], 0.007, 8, 16))
  // Blade: triangle of edges plus a surface fan
  const sup = p([0.08, 1.45, -0.1])
  const inf = p([0.095, 1.27, -0.105])
  const glen = p([0.175, 1.41, -0.02])
  const lat = p([0.15, 1.33, -0.07])
  parts.push(tube([sup, p([0.072, 1.38, -0.11]), inf], 0.005, 6, 14))
  parts.push(tube([inf, lat, glen], 0.007, 6, 14))
  parts.push(tube([sup, p([0.13, 1.44, -0.07]), glen], 0.005, 6, 12))
  for (let i = 1; i < 6; i++) {
    const e = lerp3(sup, inf, i / 6)
    parts.push(tube([e, lerp3(e, glen, 0.5), glen], 0.006, 5, 8))
  }
  // Spine of the scapula and acromion
  parts.push(tube([p([0.075, 1.405, -0.112]), p([0.12, 1.43, -0.095]), p([0.165, 1.45, -0.04]), p([0.185, 1.452, -0.005])], (t) => 0.006 + t * 0.004, 8, 14))
  // Glenoid and coracoid
  parts.push(ellipsoid(glen, [0.012, 0.018, 0.016], 10))
  parts.push(tube([p([0.16, 1.415, 0.0]), p([0.155, 1.415, 0.03]), p([0.15, 1.405, 0.042])], 0.005, 6, 6))
  return merge(parts)
}

function humerus(side: Side): BufferGeometry {
  const p = (q: Vec3) => sided(q, side)
  const parts: BufferGeometry[] = []
  parts.push(ellipsoid(p([0.195, 1.41, -0.01]), [0.024, 0.024, 0.024], 16))
  parts.push(ellipsoid(p([0.212, 1.418, 0.0]), [0.014, 0.016, 0.014], 10)) // greater tubercle
  parts.push(tube([p([0.205, 1.4, -0.008]), p([0.21, 1.3, -0.006]), p([0.208, 1.2, -0.008]), p([0.205, 1.13, -0.01])], (t) => 0.013 - 0.003 * Math.sin(Math.PI * t), 10, 20))
  parts.push(ellipsoid(p([0.205, 1.115, -0.01]), [0.032, 0.012, 0.016], 12)) // condyles
  parts.push(ellipsoid(p([0.235, 1.118, -0.01]), [0.008, 0.009, 0.008], 8))
  parts.push(ellipsoid(p([0.172, 1.118, -0.012]), [0.009, 0.01, 0.009], 8))
  return merge(parts)
}

function forearm(side: Side): BufferGeometry {
  const p = (q: Vec3) => sided(q, side)
  const parts: BufferGeometry[] = []
  // Ulna (medial, with olecranon) and radius (lateral)
  parts.push(tube([p([0.2, 1.125, -0.03]), p([0.198, 1.1, -0.012]), p([0.2, 0.98, -0.01]), p([0.205, 0.88, -0.008])], (t) => 0.011 - 0.005 * t, 8, 18))
  parts.push(tube([p([0.222, 1.1, 0.0]), p([0.226, 1.0, 0.004]), p([0.224, 0.92, 0.006]), p([0.222, 0.875, 0.005])], (t) => 0.007 + 0.006 * t, 8, 18))
  return merge(parts)
}

function hand(side: Side): BufferGeometry {
  const p = (q: Vec3) => sided(q, side)
  const parts: BufferGeometry[] = []
  parts.push(ellipsoid(p([0.215, 0.85, 0.002]), [0.022, 0.012, 0.01], 10)) // carpals
  const fingers = [-0.016, -0.005, 0.006, 0.016]
  fingers.forEach((dx, i) => {
    const len = [0.075, 0.085, 0.08, 0.065][i]
    const x = 0.215 + dx
    parts.push(rod(p([x, 0.84, 0.003]), p([x + dx * 0.15, 0.775, 0.006]), 0.0045, 0.004, 6))
    parts.push(tube([p([x + dx * 0.15, 0.772, 0.006]), p([x + dx * 0.25, 0.772 - len * 0.5, 0.01]), p([x + dx * 0.3, 0.772 - len, 0.012])], 0.0036, 6, 8))
  })
  // Thumb (points forward-medially in anatomical position)
  parts.push(tube([p([0.2, 0.845, 0.01]), p([0.192, 0.81, 0.025]), p([0.188, 0.78, 0.035]), p([0.186, 0.755, 0.04])], 0.0045, 6, 10))
  return merge(parts)
}

function thigh(side: Side): BufferGeometry {
  const p = (q: Vec3) => sided(q, side)
  const parts: BufferGeometry[] = []
  parts.push(ellipsoid(p(REST.hip), [0.024, 0.024, 0.024], 16)) // femoral head
  parts.push(rod(p([0.09, 0.922, 0]), p([0.145, 0.895, -0.005]), 0.014, 0.017, 10)) // neck
  parts.push(ellipsoid(p([0.155, 0.9, -0.01]), [0.018, 0.024, 0.018], 10)) // greater trochanter
  parts.push(ellipsoid(p([0.078, 0.865, -0.012]), [0.009, 0.01, 0.009], 8)) // lesser trochanter
  parts.push(tube([p([0.145, 0.89, -0.005]), p([0.13, 0.8, 0.0]), p([0.11, 0.68, 0.005]), p([0.095, 0.56, 0.0])], (t) => 0.016 - 0.003 * Math.sin(Math.PI * t), 10, 20))
  parts.push(ellipsoid(p([0.122, 0.515, -0.008]), [0.02, 0.022, 0.027], 12)) // lateral condyle
  parts.push(ellipsoid(p([0.06, 0.515, -0.008]), [0.02, 0.022, 0.027], 12)) // medial condyle
  return merge(parts)
}

function shank(side: Side): BufferGeometry {
  const p = (q: Vec3) => sided(q, side)
  const parts: BufferGeometry[] = []
  parts.push(ellipsoid(p([0.09, 0.49, -0.003]), [0.04, 0.012, 0.03], 14)) // tibial plateau
  parts.push(tube([p([0.088, 0.48, 0.0]), p([0.088, 0.45, 0.012]), p([0.085, 0.3, 0.006]), p([0.078, 0.1, 0.0])], (t) => 0.02 - 0.008 * Math.sin(Math.PI * Math.min(1, t * 1.3)), 10, 20))
  parts.push(ellipsoid(p([0.068, 0.078, 0.002]), [0.011, 0.016, 0.012], 8)) // medial malleolus
  parts.push(tube([p([0.135, 0.475, -0.02]), p([0.132, 0.3, -0.015]), p([0.125, 0.07, -0.01])], 0.0065, 6, 16)) // fibula
  parts.push(ellipsoid(p([0.124, 0.068, -0.01]), [0.01, 0.016, 0.011], 8)) // lateral malleolus
  parts.push(ellipsoid(p([0.09, 0.535, 0.05]), [0.022, 0.026, 0.01], 12)) // patella (rides with the shank)
  return merge(parts)
}

function foot(side: Side): BufferGeometry {
  const p = (q: Vec3) => sided(q, side)
  const parts: BufferGeometry[] = []
  parts.push(ellipsoid(p([0.09, 0.06, -0.005]), [0.02, 0.014, 0.025], 10)) // talus
  parts.push(ellipsoid(p([0.09, 0.03, -0.045]), [0.02, 0.024, 0.035], 12)) // calcaneus
  parts.push(ellipsoid(p([0.085, 0.045, 0.04]), [0.03, 0.016, 0.03], 10)) // midfoot
  const rays = [0.07, 0.083, 0.095, 0.107, 0.118]
  rays.forEach((x, i) => {
    const toe = 0.15 + (i === 0 ? 0.0 : -0.006 * i)
    parts.push(rod(p([x + 0.004, 0.035, 0.065]), p([x, 0.012, toe - 0.012]), i === 0 ? 0.007 : 0.005, i === 0 ? 0.006 : 0.004, 6))
    parts.push(rod(p([x, 0.012, toe - 0.012]), p([x - 0.002, 0.008, toe + 0.035 - i * 0.006]), i === 0 ? 0.006 : 0.0038, 0.0035, 6))
  })
  return merge(parts)
}

let cache: Partial<Record<SegmentId, BufferGeometry>> | null = null

export function boneGeometries(): Record<SegmentId, BufferGeometry> {
  if (!cache) {
    cache = {
      pelvis: pelvis(),
      lumbar: lumbar(),
      thorax: thorax(),
      head: head(),
      scapulaL: scapula('L'),
      scapulaR: scapula('R'),
      humerusL: humerus('L'),
      humerusR: humerus('R'),
      forearmL: forearm('L'),
      forearmR: forearm('R'),
      handL: hand('L'),
      handR: hand('R'),
      thighL: thigh('L'),
      thighR: thigh('R'),
      shankL: shank('L'),
      shankR: shank('R'),
      footL: foot('L'),
      footR: foot('R'),
    }
  }
  return cache as Record<SegmentId, BufferGeometry>
}
