import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Quaternion, Vector3 } from 'three'
import { useLabelStore, viewState } from './labelState'
import { transformPoint } from '../engine/kinematics'
import { pathLength } from '../engine/musclePath'
import { useStore } from '../state/store'

/** Works out which muscles to label and where; renders nothing itself. */
export function Labels() {
  const show = useStore((s) => s.view.labels)
  const analysis = useStore((s) => s.analysis)
  const model = useStore((s) => s.model)
  const selected = useStore((s) => s.selectedMuscle)
  const view = useStore((s) => s.view)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    viewState.camera = camera
  }, [camera])

  useEffect(() => {
    if (!show) {
      useLabelStore.setState({ items: [] })
      return
    }
    const { sim } = analysis
    // One label per muscle group: the side with the larger heat
    const best = new Map<string, (typeof sim.muscles)[number]>()
    for (const m of sim.muscles) {
      const visible = m.def.layer === 'superficial' ? view.superficial : view.deep
      if (!visible) continue
      const cur = best.get(m.def.id)
      if (!cur || m.heat > cur.heat) best.set(m.def.id, m)
    }
    const top = [...best.values()].sort((a, b) => b.heat - a.heat).filter((m) => m.heat > 0.35).slice(0, 6)
    const sel = selected ? sim.muscleByKey[selected] : null
    if (sel && !top.includes(sel)) top.push(sel)
    const items = top.map((m) => {
      const strand = model.filter((s) => s.muscleKey === m.key).sort((a, b) => b.def.fmax - a.def.fmax)[0]
      const pts: Vector3[] = []
      pathLength(sim.pose, strand.nodes, pts)
      let total = 0
      for (let i = 1; i < pts.length; i++) total += pts[i].distanceTo(pts[i - 1])
      let acc = 0
      let mid = pts[0]
      for (let i = 1; i < pts.length; i++) {
        const d = pts[i].distanceTo(pts[i - 1])
        if (acc + d >= total / 2) {
          mid = pts[i - 1].clone().lerp(pts[i], (total / 2 - acc) / d)
          break
        }
        acc += d
      }
      return { key: m.key, name: m.def.name, pos: mid, selected: m.key === selected }
    })
    useLabelStore.setState({ items })
  }, [show, analysis, model, selected, view.superficial, view.deep])

  return null
}

/** Floor reaction arrows, external load and the centre of mass. */
export function Forces() {
  const show = useStore((s) => s.view.forces)
  const analysis = useStore((s) => s.analysis)
  if (!show) return null
  const { sim } = analysis
  const scale = 0.6 / sim.bodyWeight // 0.6 m arrow for full body weight
  const up = new Vector3(0, 1, 0)
  return (
    <group>
      {sim.forces
        .filter((f) => f.kind !== 'gravity' && f.force.length() > 1)
        .map((f, i) => {
          const p = transformPoint(sim.pose, f.seg, f.p)
          const len = f.force.length() * scale
          const dir = f.force.clone().normalize()
          const q = new Quaternion().setFromUnitVectors(up, dir)
          // Ground arrows point up from the floor; load arrows hang down from the hand
          const start = f.kind === 'ground' ? p : p
          const color = f.kind === 'ground' ? '#22d3ee' : '#f472b6'
          return (
            <group key={i} position={start} quaternion={q}>
              <mesh position={[0, len / 2, 0]} raycast={() => null}>
                <cylinderGeometry args={[0.006, 0.006, len, 8]} />
                <meshBasicMaterial color={color} depthTest={false} transparent />
              </mesh>
              <mesh position={[0, len, 0]} raycast={() => null}>
                <coneGeometry args={[0.016, 0.04, 12]} />
                <meshBasicMaterial color={color} depthTest={false} transparent />
              </mesh>
            </group>
          )
        })}
      <group position={sim.com}>
        <mesh raycast={() => null} renderOrder={30}>
          <sphereGeometry args={[0.025, 16, 12]} />
          <meshBasicMaterial color="#fde047" depthTest={false} transparent />
        </mesh>
        <mesh position={[0, -sim.com.y / 2, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.002, 0.002, sim.com.y, 6]} />
          <meshBasicMaterial color="#fde047" depthTest={false} transparent opacity={0.6} />
        </mesh>
      </group>
    </group>
  )
}

/** A simple barbell drawn at the hands or across the upper back when there is a load. */
export function LoadProp() {
  const analysis = useStore((s) => s.analysis)
  const loadPoint = useStore((s) => s.loadPoint)
  const loadKg = useStore((s) => s.loadKg)
  if (!loadPoint || loadKg <= 0) return null
  const { sim } = analysis
  let a: Vector3
  let b: Vector3
  if (loadPoint === 'hands') {
    a = transformPoint(sim.pose, 'handL', [0.215, 0.79, 0.0])
    b = transformPoint(sim.pose, 'handR', [-0.215, 0.79, 0.0])
  } else {
    a = transformPoint(sim.pose, 'thorax', [0.25, 1.45, -0.11])
    b = transformPoint(sim.pose, 'thorax', [-0.25, 1.45, -0.11])
  }
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const dir = b.clone().sub(a).normalize()
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir)
  const plate = 0.1 + Math.min(0.12, loadKg / 600)
  return (
    <group position={mid} quaternion={q}>
      <mesh raycast={() => null} castShadow>
        <cylinderGeometry args={[0.013, 0.013, 1.9, 12]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} />
      </mesh>
      {[-0.78, 0.78].map((y) => (
        <mesh key={y} position={[0, y, 0]} raycast={() => null} castShadow>
          <cylinderGeometry args={[plate, plate, 0.05, 32]} />
          <meshStandardMaterial color="#1f2937" roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}
