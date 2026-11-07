import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CapsuleGeometry, Group, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { segmentMatrix } from '../engine/kinematics'
import { SEGMENTS, type SegmentId, type Vec3 } from '../engine/skeleton'
import { useStore } from '../state/store'

/** Simple translucent body envelope so the muscles can be seen in context. */
function capsule(a: Vec3, b: Vec3, r: number, scale: Vec3 = [1, 1, 1]): BufferGeometry {
  const A = new Vector3(...a)
  const B = new Vector3(...b)
  const len = Math.max(0.001, A.distanceTo(B))
  const g = new CapsuleGeometry(r, len, 6, 16)
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), B.clone().sub(A).normalize())
  g.applyMatrix4(new Matrix4().makeScale(...scale))
  g.applyMatrix4(new Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new Vector3(1, 1, 1)))
  return g
}

function blob(c: Vec3, s: Vec3): BufferGeometry {
  const g = new SphereGeometry(1, 20, 14)
  g.applyMatrix4(new Matrix4().compose(new Vector3(...c), new Quaternion(), new Vector3(...s)))
  return g
}

function skinGeometries(): Partial<Record<SegmentId, BufferGeometry>> {
  const m = (list: BufferGeometry[]) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false)!
  const out: Partial<Record<SegmentId, BufferGeometry>> = {
    pelvis: m([blob([0, 0.95, -0.01], [0.17, 0.11, 0.12])]),
    lumbar: m([blob([0, 1.1, 0.0], [0.15, 0.11, 0.11])]),
    thorax: m([blob([0, 1.3, 0.0], [0.17, 0.17, 0.12])]),
    head: m([blob([0, 1.665, 0.01], [0.085, 0.11, 0.1]), capsule([0, 1.48, -0.03], [0, 1.58, -0.01], 0.05)]),
  }
  for (const s of ['L', 'R'] as const) {
    const x = s === 'L' ? 1 : -1
    out[`humerus${s}`] = m([capsule([0.2 * x, 1.4, -0.01], [0.205 * x, 1.12, -0.01], 0.045)])
    out[`forearm${s}`] = m([capsule([0.205 * x, 1.1, -0.01], [0.215 * x, 0.87, 0], 0.036)])
    out[`hand${s}`] = m([capsule([0.215 * x, 0.85, 0.003], [0.215 * x, 0.72, 0.008], 0.022, [1.5, 1, 0.6])])
    out[`thigh${s}`] = m([capsule([0.09 * x, 0.88, 0], [0.09 * x, 0.52, 0.005], 0.07)])
    out[`shank${s}`] = m([capsule([0.09 * x, 0.48, -0.005], [0.09 * x, 0.1, -0.005], 0.048)])
    out[`foot${s}`] = m([capsule([0.09 * x, 0.04, -0.05], [0.085 * x, 0.025, 0.17], 0.035, [1.2, 0.8, 1])])
    out[`scapula${s}`] = m([blob([0.16 * x, 1.43, -0.01], [0.06, 0.04, 0.06])])
  }
  return out
}

export function Skin() {
  const visible = useStore((s) => s.view.skin)
  const geos = useMemo(() => skinGeometries(), [])
  const material = useMemo(
    () => new MeshStandardMaterial({ color: '#e8b89a', roughness: 0.8, transparent: true, opacity: 0.2, depthWrite: false }),
    [],
  )
  const groups = useRef<Partial<Record<SegmentId, Group>>>({})
  const last = useRef(-1)
  const m = useMemo(() => new Matrix4(), [])
  useFrame(() => {
    const { version, analysis } = useStore.getState()
    if (version === last.current) return
    last.current = version
    for (const s of SEGMENTS) {
      const g = groups.current[s.id]
      if (!g) continue
      g.matrix.copy(segmentMatrix(analysis.sim.pose, s.id, m))
      g.matrixWorldNeedsUpdate = true
    }
  })
  return (
    <group visible={visible}>
      {SEGMENTS.map((s) =>
        geos[s.id] ? (
          <group
            key={s.id}
            matrixAutoUpdate={false}
            ref={(g) => {
              if (g) {
                groups.current[s.id] = g
                last.current = -1
              }
            }}
          >
            <mesh geometry={geos[s.id]} material={material} renderOrder={5} raycast={() => null} />
          </group>
        ) : null,
      )}
    </group>
  )
}
