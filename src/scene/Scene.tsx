import { ContactShadows, Grid, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useStore } from '../state/store'
import { Bones } from './Bones'
import { JointGizmos } from './JointGizmos'
import { Muscles } from './Muscles'
import { Forces, Labels, LoadProp } from './Overlays'
import { Skin } from './Skin'

function Animator() {
  useFrame(() => {
    if (useStore.getState().anim) useStore.getState().tick(performance.now())
  })
  return null
}

export function Scene() {
  const selectJoint = useStore((s) => s.selectJoint)
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [2.2, 1.5, 3.05], fov: 36, near: 0.05, far: 50 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => selectJoint(null)}
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
        <Skin />
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
      <OrbitControls makeDefault target={[0, 0.82, 0]} minDistance={0.6} maxDistance={7} maxPolarAngle={Math.PI * 0.95} />
    </Canvas>
  )
}
