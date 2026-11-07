import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Group, Matrix4, MeshStandardMaterial, type BufferGeometry } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { segmentMatrix } from '../engine/kinematics'
import { SEGMENTS, type SegmentId } from '../engine/skeleton'
import { useStore } from '../state/store'
import { boneGeometries } from './boneGeometry'

/**
 * Optional real bone meshes. Put GLB files in public/models/bones/ and list them in
 * public/models/bones/manifest.json as { "<segmentId>": "file.glb", ... }. Each file must be
 * in rest-world metres (the same frame as engine/skeleton.ts). Segments without a file use
 * the procedural bones.
 */
function useBoneOverrides(): Partial<Record<SegmentId, BufferGeometry[]>> {
  const [over, setOver] = useState<Partial<Record<SegmentId, BufferGeometry[]>>>({})
  useEffect(() => {
    let cancelled = false
    fetch('models/bones/manifest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then(async (manifest: Record<string, string> | null) => {
        if (!manifest || cancelled) return
        const loader = new GLTFLoader()
        const out: Partial<Record<SegmentId, BufferGeometry[]>> = {}
        for (const [seg, file] of Object.entries(manifest)) {
          try {
            const gltf = await loader.loadAsync(`models/bones/${file}`)
            const geos: BufferGeometry[] = []
            gltf.scene.updateMatrixWorld(true)
            gltf.scene.traverse((o) => {
              const mesh = o as unknown as { isMesh?: boolean; geometry: BufferGeometry; matrixWorld: Matrix4 }
              if (mesh.isMesh) geos.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld))
            })
            out[seg as SegmentId] = geos
          } catch {
            // keep the procedural bone for this segment
          }
        }
        if (!cancelled) setOver(out)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return over
}

export function Bones() {
  const visible = useStore((s) => s.view.bones)
  const geos = useMemo(() => boneGeometries(), [])
  const overrides = useBoneOverrides()
  const material = useMemo(() => new MeshStandardMaterial({ color: '#e9e2cf', roughness: 0.62, metalness: 0.0 }), [])
  const groups = useRef<Partial<Record<SegmentId, Group>>>({})
  const lastVersion = useRef(-1)
  const m = useMemo(() => new Matrix4(), [])

  useFrame(() => {
    const { version, analysis } = useStore.getState()
    if (version === lastVersion.current) return
    lastVersion.current = version
    for (const s of SEGMENTS) {
      const g = groups.current[s.id]
      if (!g) continue
      segmentMatrix(analysis.sim.pose, s.id, m)
      g.matrix.copy(m)
      g.matrixWorldNeedsUpdate = true
    }
  })

  return (
    <group visible={visible}>
      {SEGMENTS.map((s) => (
        <group
          key={s.id}
          matrixAutoUpdate={false}
          ref={(g) => {
            if (g) {
              groups.current[s.id] = g
              lastVersion.current = -1
            }
          }}
        >
          {(overrides[s.id] ?? [geos[s.id]]).map((g, i) => (
            <mesh key={i} geometry={g} material={material} castShadow receiveShadow />
          ))}
        </group>
      ))}
    </group>
  )
}
