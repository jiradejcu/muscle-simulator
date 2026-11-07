import { ContactShadows, Grid } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useStore } from '../state/store'
import { Bones } from './Bones'
import { isPlainClick, rememberPointerDown } from './pointer'
import { CameraControls } from './CameraControls'
import { JointGizmos } from './JointGizmos'
import { Muscles } from './Muscles'
import { Forces, Labels, LoadProp } from './Overlays'

function Animator() {
  useFrame(() => {
    if (useStore.getState().anim) useStore.getState().tick(performance.now())
  })
  return null
}

export function Scene() {
  const selectJoint = useStore((s) => s.selectJoint)
  const selectMuscle = useStore((s) => s.selectMuscle)
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [2.2, 1.5, 3.05], fov: 36, near: 0.05, far: 50 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerDown={rememberPointerDown}
      onPointerMissed={(e) => {
        // A left click on empty space clears the selection; drags (orbiting) do not.
        if (!isPlainClick(e)) return
        selectJoint(null)
        selectMuscle(null)
      }}
    >
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 6, 14]} />
      <hemisphereLight args={['#e0ecff', '#334155', 1.1]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}>
        <orthographicCamera attach="shadow-camera" args={[-1.5, 1.5, 1.5, -1.5, 0.1, 10]} />
      </directionalLight>
      <directionalLight position={[-3, 2, -2]} intensity={0.55} color="#fde68a" />
      <Animator />
      <group>
        <Bones />
        <Muscles />
        <JointGizmos />
        <Labels />
        <Forces />
        <LoadProp />
      </group>
      <Grid
        position={[0, 0, 0]}
        args={[10, 10]}
        cellSize={0.1}
        cellThickness={0.5}
        cellColor="#334155"
        sectionSize={0.5}
        sectionThickness={1}
        sectionColor="#475569"
        fadeDistance={8}
        infiniteGrid
      />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.5} scale={4} blur={2.2} far={1.5} resolution={512} />
      <CameraControls />
    </Canvas>
  )
}
