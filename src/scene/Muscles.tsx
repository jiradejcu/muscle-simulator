import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, MeshStandardMaterial, Vector3, type Mesh } from 'three'
import { pathLength } from '../engine/musclePath'
import { useStore } from '../state/store'
import { fibreTexture, heatColor, MuscleTube } from './muscleTube'

const BELLY = new Color('#b03a32')
const BELLY_DEEP = new Color('#8f2f2c')
const TENDON = new Color('#ece4cf')

interface Item {
  key: string
  muscleKey: string
  layer: 'superficial' | 'deep'
  tube: MuscleTube
  material: MeshStandardMaterial
}

/** All muscle strands as lofted tubes, updated in place from the latest analysis. */
export function Muscles() {
  const model = useStore((s) => s.model)
  const view = useStore((s) => s.view)
  const selected = useStore((s) => s.selectedMuscle)
  const hovered = useStore((s) => s.hoveredMuscle)
  const selectMuscle = useStore((s) => s.selectMuscle)
  const hoverMuscle = useStore((s) => s.hoverMuscle)

  const items = useMemo<Item[]>(() => {
    const tex = fibreTexture()
    return model.map((s) => ({
      key: s.key,
      muscleKey: s.muscleKey,
      layer: s.muscle.layer,
      tube: new MuscleTube(),
      material: new MeshStandardMaterial({ vertexColors: true, map: tex, bumpMap: tex, bumpScale: 1.2, roughness: 0.55, metalness: 0 }),
    }))
  }, [model])

  useEffect(() => () => items.forEach((i) => (i.tube.dispose(), i.material.dispose())), [items])

  const lastVersion = useRef(-1)
  const lastHeat = useRef<boolean | null>(null)
  useEffect(() => {
    lastVersion.current = -1
  }, [items])

  useFrame(() => {
    const st = useStore.getState()
    if (st.version === lastVersion.current && lastHeat.current === st.view.heat) return
    lastVersion.current = st.version
    lastHeat.current = st.view.heat
    const { sim } = st.analysis
    const byKey = new Map(sim.strands.map((s) => [s.key, s]))
    const pts: Vector3[] = []
    const heatC = new Color()
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const sm = model[i]
      const res = byKey.get(it.key)
      if (!res) continue
      pts.length = 0
      pathLength(sim.pose, sm.nodes, pts)
      const L = res.length
      // Tendons keep their length; the belly takes up the stretch (and thins as it does).
      const tA = Math.min(0.45, (sm.def.tendon[0] * sm.restLength) / L)
      const tB = Math.min(0.45, (sm.def.tendon[1] * sm.restLength) / L)
      const bellyRest = sm.restLength * (1 - sm.def.tendon[0] - sm.def.tendon[1])
      const bellyNow = Math.max(0.01, L * (1 - tA - tB))
      const R = 1.6 * sm.def.radius * Math.sqrt(bellyRest / bellyNow) * (1 + 0.15 * Math.min(1, Math.max(0, res.activation)))
      const rT = Math.max(0.003, sm.def.radius * 0.3)
      const radius = (t: number) => {
        if (t <= tA || t >= 1 - tB) {
          // taper the very ends slightly
          const e = Math.min(t, 1 - t)
          return rT * (0.75 + 0.25 * Math.min(1, e * 20))
        }
        const u = (t - tA) / (1 - tA - tB)
        const shape = Math.pow(Math.sin(Math.PI * u), 0.55)
        return rT + (R - rT) * shape
      }
      const base = it.layer === 'deep' ? BELLY_DEEP : BELLY
      heatColor(res.heat, heatC)
      const heatOn = st.view.heat
      const color = (t: number, out: Color) => {
        const inTendon = t < tA || t > 1 - tB
        const edge = Math.min(Math.abs(t - tA), Math.abs(t - (1 - tB)))
        out.copy(base)
        if (heatOn) out.lerp(heatC, 0.18 + 0.67 * Math.min(1, res.heat))
        if (inTendon) out.lerp(TENDON, edge < 0.02 ? 0.5 + edge * 25 : 1)
        return out
      }
      it.tube.update(pts, radius, color, Math.max(1, L / 0.08))
    }
  })

  const onOver = (e: ThreeEvent<PointerEvent>, key: string) => {
    e.stopPropagation()
    hoverMuscle(key)
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    hoverMuscle(null)
    document.body.style.cursor = ''
  }
  const onClick = (e: ThreeEvent<MouseEvent>, key: string) => {
    e.stopPropagation()
    selectMuscle(key)
  }

  return (
    <group>
      {items.map((it) => {
        const visible = it.layer === 'superficial' ? view.superficial : view.deep
        const isSel = selected === it.muscleKey
        const isHover = hovered === it.muscleKey
        it.material.emissive.set(isSel ? '#ffffff' : isHover ? '#ffffff' : '#000000')
        it.material.emissiveIntensity = isSel ? 0.28 : isHover ? 0.14 : 0
        return (
          <mesh
            key={it.key}
            geometry={it.tube.geometry}
            material={it.material}
            visible={visible}
            castShadow
            frustumCulled={false}
            onPointerOver={(e) => onOver(e, it.muscleKey)}
            onPointerOut={onOut}
            onClick={(e) => onClick(e, it.muscleKey)}
            ref={(m: Mesh | null) => {
              if (m) m.renderOrder = it.layer === 'deep' ? 0 : 1
            }}
          />
        )
      })}
    </group>
  )
}
