import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Mesh, MeshStandardMaterial, Vector3 } from 'three'

const noRaycast = () => {}
import { pathLength } from '../engine/musclePath'
import { useStore } from '../state/store'
import { changeColor, fibreTexture, heatColor, MuscleTube } from './muscleTube'

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
  const lastHeat = useRef<string | null>(null)
  useEffect(() => {
    lastVersion.current = -1
  }, [items])

  useFrame(() => {
    const st = useStore.getState()
    const heatKey = `${st.view.heat}|${st.view.heatMode}`
    if (st.version === lastVersion.current && lastHeat.current === heatKey) return
    lastVersion.current = st.version
    lastHeat.current = heatKey
    const { sim, baseline } = st.analysis
    const byKey = new Map(sim.strands.map((s) => [s.key, s]))
    const baseByKey = baseline ? new Map(baseline.strands.map((s) => [s.key, s])) : null
    const changeMode = st.view.heatMode === 'change' && !!baseByKey
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
      if (changeMode) changeColor(res.activation - (baseByKey!.get(it.key)?.activation ?? 0), heatC)
      else heatColor(res.heat, heatC)
      const heatOn = st.view.heat
      const color = (t: number, out: Color) => {
        const inTendon = t < tA || t > 1 - tB
        const edge = Math.min(Math.abs(t - tA), Math.abs(t - (1 - tB)))
        out.copy(base)
        // Mostly the heat colour, so muscles match the legend (a weak blend of red and
        // blue reads as an off-scale purple). Heat off shows the natural muscle red.
        if (heatOn) out.lerp(heatC, 0.8)
        if (inTendon) out.lerp(TENDON, edge < 0.02 ? 0.5 + edge * 25 : 1)
        return out
      }
      it.tube.update(pts, radius, color, Math.max(1, L / 0.08))
    }
  })

  // Highlight every strand of the selected / hovered muscle (outside render).
  useEffect(() => {
    for (const it of items) {
      const isSel = selected === it.muscleKey
      const isHover = hovered === it.muscleKey
      it.material.emissive.set(isSel || isHover ? '#ffffff' : '#000000')
      it.material.emissiveIntensity = isSel ? (isHover ? 0.36 : 0.26) : isHover ? 0.18 : 0
    }
  }, [items, selected, hovered])

  // Pointer "over" can arrive before the previous strand's "out", so set on over/move and
  // only clear when leaving the muscle that is currently highlighted.
  const onOver = (e: ThreeEvent<PointerEvent>, key: string) => {
    e.stopPropagation()
    if (useStore.getState().hoveredMuscle !== key) hoverMuscle(key)
    document.body.style.cursor = 'pointer'
  }
  const onOut = (key: string) => {
    if (useStore.getState().hoveredMuscle === key) {
      hoverMuscle(null)
      document.body.style.cursor = ''
    }
  }
  const onClick = (e: ThreeEvent<MouseEvent>, key: string) => {
    e.stopPropagation()
    selectMuscle(key)
  }

  return (
    <group>
      {items.map((it) => {
        const visible = it.layer === 'superficial' ? view.superficial : view.deep
        return (
          <mesh
            key={it.key}
            geometry={it.tube.geometry}
            material={it.material}
            visible={visible}
            // Three.js raycasts invisible meshes too; a hidden layer must not catch the mouse
            raycast={visible ? Mesh.prototype.raycast : noRaycast}
            castShadow
            frustumCulled={false}
            onPointerOver={(e) => onOver(e, it.muscleKey)}
            onPointerMove={(e) => onOver(e, it.muscleKey)}
            onPointerOut={() => onOut(it.muscleKey)}
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
