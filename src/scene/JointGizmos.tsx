import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Group, Quaternion, Vector3 } from 'three'
import { JOINTS, JOINT_BY_ID, type Angles } from '../engine/skeleton'
import type { BodyPose } from '../engine/kinematics'
import { useStore } from '../state/store'

const AXES = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) }
const RING_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308']

interface RingInfo {
  dof: string
  axis: Vector3
  /** Change in DOF degrees per degree of rotation about `axis`. */
  gain: number
}

/** World axes of each rotation step of a joint at the current pose. */
function jointRings(jointId: string, angles: Angles, pose: BodyPose): RingInfo[] {
  const j = JOINT_BY_ID[jointId]
  const acc = j.parent ? pose[j.parent].q.clone() : new Quaternion()
  const seen = new Set<string>()
  const out: RingInfo[] = []
  for (const step of j.steps) {
    const key = `${j.id}.${step.dof}`
    const mirror = j.side === 'R' && step.axis !== 'x' ? -1 : 1
    if (!seen.has(step.dof)) {
      seen.add(step.dof)
      out.push({ dof: key, axis: AXES[step.axis].clone().applyQuaternion(acc), gain: 1 / (step.factor * mirror) })
    }
    const angle = ((angles[key] ?? 0) * step.factor * mirror * Math.PI) / 180
    acc.multiply(new Quaternion().setFromAxisAngle(AXES[step.axis], angle))
  }
  return out
}

/** Clickable joint handles; the selected joint shows one drag ring per degree of freedom. */
export function JointGizmos() {
  const enabled = useStore((s) => s.view.gizmos)
  const selectedJoint = useStore((s) => s.selectedJoint)
  const selectJoint = useStore((s) => s.selectJoint)
  const analysis = useStore((s) => s.analysis)
  const { camera, gl, controls } = useThree() as unknown as {
    camera: import('three').Camera
    gl: import('three').WebGLRenderer
    controls: { enabled: boolean } | null
  }
  const [hoverRing, setHoverRing] = useState<string | null>(null)
  const groupRef = useRef<Group>(null)
  const joints = JOINTS

  if (!enabled) return null
  const { sim } = analysis

  const startDrag = (e: ThreeEvent<PointerEvent>, ring: RingInfo, centre: Vector3) => {
    e.stopPropagation()
    if (controls) controls.enabled = false
    const rect = gl.domElement.getBoundingClientRect()
    const centreScreen = centre.clone().project(camera)
    const cx = rect.left + ((centreScreen.x + 1) / 2) * rect.width
    const cy = rect.top + ((1 - centreScreen.y) / 2) * rect.height
    const angleAt = (x: number, y: number) => Math.atan2(-(y - cy), x - cx)
    const startAngle = angleAt(e.nativeEvent.clientX, e.nativeEvent.clientY)
    const camDir = camera.position.clone().sub(centre).normalize()
    const facing = ring.axis.dot(camDir) >= 0 ? 1 : -1
    const startValue = useStore.getState().target[ring.dof]
    let last = startAngle
    let total = 0
    const move = (ev: PointerEvent) => {
      const a = angleAt(ev.clientX, ev.clientY)
      let d = a - last
      if (d > Math.PI) d -= 2 * Math.PI
      if (d < -Math.PI) d += 2 * Math.PI
      total += d
      last = a
      const deg = (total * 180) / Math.PI
      useStore.getState().setAngle(ring.dof, startValue + facing * ring.gain * deg)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <group ref={groupRef}>
      {joints.map((j) => {
        const centre = sim.pose[j.segment].t
        const isSel = selectedJoint === j.id
        return (
          <group key={j.id}>
            <mesh
              position={centre}
              onClick={(e) => {
                e.stopPropagation()
                selectJoint(isSel ? null : j.id)
              }}
              onPointerOver={() => (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = '')}
              renderOrder={20}
            >
              <sphereGeometry args={[isSel ? 0.022 : 0.016, 16, 12]} />
              <meshBasicMaterial color={isSel ? '#facc15' : '#38bdf8'} depthTest={false} transparent opacity={0.9} />
            </mesh>
            {isSel &&
              jointRings(j.id, sim.angles, sim.pose).map((ring, i) => {
                const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), ring.axis.clone().normalize())
                const r = 0.09 + i * 0.022
                const hot = hoverRing === ring.dof
                return (
                  <mesh
                    key={ring.dof}
                    position={centre}
                    quaternion={q}
                    onPointerDown={(e) => startDrag(e, ring, centre.clone())}
                    onPointerOver={(e) => {
                      e.stopPropagation()
                      setHoverRing(ring.dof)
                      document.body.style.cursor = 'grab'
                    }}
                    onPointerOut={() => {
                      setHoverRing(null)
                      document.body.style.cursor = ''
                    }}
                    renderOrder={20}
                  >
                    <torusGeometry args={[r, hot ? 0.007 : 0.0045, 8, 64]} />
                    <meshBasicMaterial color={RING_COLORS[i % RING_COLORS.length]} depthTest={false} transparent opacity={hot ? 1 : 0.85} />
                  </mesh>
                )
              })}
          </group>
        )
      })}
    </group>
  )
}

