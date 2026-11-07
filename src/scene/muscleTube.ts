import { BufferAttribute, BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'

export const RADIAL = 12
export const SEGMENTS = 48

/**
 * A muscle drawn as a lofted tube with a fixed vertex layout, so its positions can be
 * rewritten every frame without allocating new geometry.
 */
export class MuscleTube {
  geometry = new BufferGeometry()
  private pos: Float32Array
  private nrm: Float32Array
  private col: Float32Array
  private uv: Float32Array

  constructor() {
    const ring = RADIAL + 1
    const n = (SEGMENTS + 1) * ring + 2 // + two cap centres
    this.pos = new Float32Array(n * 3)
    this.nrm = new Float32Array(n * 3)
    this.col = new Float32Array(n * 3)
    this.uv = new Float32Array(n * 2)
    const idx: number[] = []
    for (let i = 0; i < SEGMENTS; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = i * ring + j
        const b = (i + 1) * ring + j
        idx.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
    const capA = (SEGMENTS + 1) * ring
    const capB = capA + 1
    for (let j = 0; j < RADIAL; j++) {
      idx.push(capA, j + 1, j)
      const last = SEGMENTS * ring
      idx.push(capB, last + j, last + j + 1)
    }
    for (let i = 0; i <= SEGMENTS; i++) {
      for (let j = 0; j <= RADIAL; j++) {
        const k = i * ring + j
        this.uv[k * 2] = j / RADIAL
        this.uv[k * 2 + 1] = i / SEGMENTS
      }
    }
    this.geometry.setIndex(idx)
    this.geometry.setAttribute('position', new BufferAttribute(this.pos, 3))
    this.geometry.setAttribute('normal', new BufferAttribute(this.nrm, 3))
    this.geometry.setAttribute('color', new BufferAttribute(this.col, 3))
    this.geometry.setAttribute('uv', new BufferAttribute(this.uv, 2))
  }

  /**
   * @param points  polyline from origin to insertion (world space)
   * @param radius  radius at arc-length fraction t
   * @param color   colour at arc-length fraction t
   * @param fibreScale  texture repeat along the length (keeps fibres a constant size)
   */
  update(points: Vector3[], radius: (t: number) => number, color: (t: number, out: Color) => Color, fibreScale: number) {
    if (points.length < 2) return
    const pts = points.length === 2 ? [points[0], points[0].clone().lerp(points[1], 0.5), points[1]] : points
    const curve = new CatmullRomCurve3(pts, false, 'centripetal', 0.5)
    const centres: Vector3[] = curve.getSpacedPoints(SEGMENTS)
    const tangents: Vector3[] = centres.map((_, i) => {
      const a = centres[Math.max(0, i - 1)]
      const b = centres[Math.min(SEGMENTS, i + 1)]
      return b.clone().sub(a).normalize()
    })
    // Parallel-transport frames
    const normal = new Vector3()
    const t0 = tangents[0]
    const ref = Math.abs(t0.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
    normal.crossVectors(t0, ref).normalize()
    const binormal = new Vector3()
    const ring = RADIAL + 1
    const c = new Color()
    const tmp = new Vector3()
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = tangents[i]
      if (i > 0) {
        // project previous normal onto the plane perpendicular to the new tangent
        normal.addScaledVector(t, -normal.dot(t)).normalize()
      }
      binormal.crossVectors(t, normal).normalize()
      const f = i / SEGMENTS
      const r = radius(f)
      color(f, c)
      for (let j = 0; j <= RADIAL; j++) {
        const ang = (j / RADIAL) * Math.PI * 2
        const cs = Math.cos(ang)
        const sn = Math.sin(ang)
        tmp.copy(normal).multiplyScalar(cs).addScaledVector(binormal, sn)
        const k = (i * ring + j) * 3
        this.nrm[k] = tmp.x
        this.nrm[k + 1] = tmp.y
        this.nrm[k + 2] = tmp.z
        this.pos[k] = centres[i].x + tmp.x * r
        this.pos[k + 1] = centres[i].y + tmp.y * r
        this.pos[k + 2] = centres[i].z + tmp.z * r
        this.col[k] = c.r
        this.col[k + 1] = c.g
        this.col[k + 2] = c.b
        this.uv[(i * ring + j) * 2 + 1] = f * fibreScale
      }
    }
    const capA = (SEGMENTS + 1) * ring
    for (const [ci, si, sign] of [[capA, 0, -1], [capA + 1, SEGMENTS, 1]] as const) {
      const k = ci * 3
      this.pos[k] = centres[si].x
      this.pos[k + 1] = centres[si].y
      this.pos[k + 2] = centres[si].z
      this.nrm[k] = tangents[si].x * sign
      this.nrm[k + 1] = tangents[si].y * sign
      this.nrm[k + 2] = tangents[si].z * sign
      const kc = si * ring * 3
      this.col[k] = this.col[kc]
      this.col[k + 1] = this.col[kc + 1]
      this.col[k + 2] = this.col[kc + 2]
    }
    const g = this.geometry
    g.attributes.position.needsUpdate = true
    g.attributes.normal.needsUpdate = true
    g.attributes.color.needsUpdate = true
    g.attributes.uv.needsUpdate = true
    g.computeBoundingSphere()
  }

  dispose() {
    this.geometry.dispose()
  }
}

let fibre: CanvasTexture | null = null

/** Fine longitudinal stripes, used as both colour map and bump map. */
export function fibreTexture(): CanvasTexture {
  if (fibre) return fibre
  const w = 128
  const h = 32
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let x = 0; x < w; x++) {
    const shade = 200 + Math.floor(rnd() * 55)
    for (let y = 0; y < h; y++) {
      const wobble = Math.floor(rnd() * 12)
      const s = Math.min(255, shade + wobble - 6)
      ctx.fillStyle = `rgb(${s},${s},${s})`
      ctx.fillRect(x, y, 1, 1)
    }
  }
  // A few darker fascicle boundaries
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rnd() * w)
    ctx.fillStyle = 'rgba(90,90,90,0.55)'
    ctx.fillRect(x, 0, 1, h)
  }
  fibre = new CanvasTexture(canvas)
  fibre.wrapS = RepeatWrapping
  fibre.wrapT = RepeatWrapping
  fibre.repeat.set(3, 1)
  fibre.colorSpace = SRGBColorSpace
  fibre.anisotropy = 4
  return fibre
}

const HEAT_STOPS: [number, Color][] = [
  [0, new Color('#4a86f0')],
  [0.33, new Color('#2fb36b')],
  [0.66, new Color('#f39c12')],
  [1, new Color('#e0302c')],
]

/** Blue (relaxed) -> green -> orange -> red (working or stretched hard). */
export function heatColor(v: number, out = new Color()): Color {
  const x = Math.min(1, Math.max(0, v))
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [b, cb] = HEAT_STOPS[i]
    const [a, ca] = HEAT_STOPS[i - 1]
    if (x <= b) return out.copy(ca).lerp(cb, (x - a) / (b - a))
  }
  return out.copy(HEAT_STOPS[HEAT_STOPS.length - 1][1])
}

export const HEAT_GRADIENT_CSS = 'linear-gradient(90deg, #2f6fde 0%, #2fb36b 33%, #f39c12 66%, #e0302c 100%)'

const LESS = new Color('#2f6fde')
const SAME = new Color('#6b7280')
const MORE = new Color('#e0302c')

/** Diverging colour for a change in effort: blue = less than normal, grey = same, red = more. */
export function changeColor(delta: number, out = new Color()): Color {
  const t = Math.max(-1, Math.min(1, delta / 0.3))
  return t >= 0 ? out.copy(SAME).lerp(MORE, Math.sqrt(t)) : out.copy(SAME).lerp(LESS, Math.sqrt(-t))
}

export const CHANGE_GRADIENT_CSS = 'linear-gradient(90deg, #2f6fde 0%, #6b7280 50%, #e0302c 100%)'
