import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Box3, MOUSE, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { SEGMENTS } from '../engine/skeleton'
import { useStore } from '../state/store'
import { cameraActions, type ViewName } from './cameraActions'

/*
 * Blender-style navigation:
 *   middle-drag          orbit
 *   Shift + middle-drag  pan            (OrbitControls pans when Shift is held while rotating)
 *   scroll               zoom
 *   Alt + left-drag      orbit          (Blender's "Emulate 3 Button Mouse", for laptops)
 *   left-click           select only    (muscles, joints, rings)
 *   1 / Ctrl+1           front / back view
 *   3 / Ctrl+3           right / left side view (the body's right / left)
 *   7 / Ctrl+7           top / bottom view
 *   Home                 frame the whole body
 *   right-click          context menu (muscle actions, views)
 * Top-row digits work as well as the numpad.
 */

const NO_BUTTON = -1 as unknown as MOUSE
const BLENDER_BUTTONS = { LEFT: NO_BUTTON, MIDDLE: MOUSE.ROTATE, RIGHT: NO_BUTTON }

interface Flight {
  fromPos: Vector3
  toPos: Vector3
  fromTarget: Vector3
  toTarget: Vector3
  start: number
}

/** Centre and radius of the posed skeleton. */
function bodyBounds(): { centre: Vector3; radius: number } {
  const { sim } = useStore.getState().analysis
  const box = new Box3()
  for (const s of SEGMENTS) box.expandByPoint(sim.pose[s.id].t)
  box.expandByPoint(sim.pose.head.t.clone().add(new Vector3(0, 0.28, 0)))
  const centre = box.getCenter(new Vector3())
  const radius = Math.max(0.45, box.getSize(new Vector3()).length() / 2)
  return { centre, radius }
}

export function CameraControls() {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, gl } = useThree()
  const flight = useRef<Flight | null>(null)

  // Alt + left-drag orbits: switch the left button to rotate just for that drag. A capture
  // listener runs before OrbitControls' own pointerdown handler.
  useEffect(() => {
    const el = gl.domElement
    const down = (e: PointerEvent) => {
      const c = controls.current
      if (!c) return
      c.mouseButtons.LEFT = e.button === 0 && e.altKey ? MOUSE.ROTATE : NO_BUTTON
    }
    // Right-click opens our context menu (like Blender) instead of the browser's
    const noMenu = (e: MouseEvent) => {
      e.preventDefault()
      useStore.getState().openContextMenu({ x: e.clientX, y: e.clientY, muscleKey: useStore.getState().hoveredMuscle })
    }
    el.addEventListener('pointerdown', down, { capture: true })
    el.addEventListener('contextmenu', noMenu)
    return () => {
      el.removeEventListener('pointerdown', down, { capture: true })
      el.removeEventListener('contextmenu', noMenu)
    }
  }, [gl])

  // Camera moves, shared by the keyboard shortcuts and the right-click menu
  useEffect(() => {
    const fov = ((camera as unknown as { fov?: number }).fov ?? 36) * (Math.PI / 180)
    const fly = (toTarget: Vector3, dir: Vector3, radius: number) => {
      const c = controls.current
      if (!c) return
      const dist = (radius / Math.sin(fov / 2)) * 1.05
      flight.current = {
        fromPos: camera.position.clone(),
        toPos: toTarget.clone().addScaledVector(dir.clone().normalize(), dist),
        fromTarget: c.target.clone(),
        toTarget: toTarget.clone(),
        start: performance.now(),
      }
    }
    const currentDir = () => camera.position.clone().sub(controls.current?.target ?? new Vector3())
    const VIEW_DIRS: Record<ViewName, Vector3> = {
      front: new Vector3(0, 0, 1), // the body faces +Z
      back: new Vector3(0, 0, -1),
      right: new Vector3(-1, 0, 0), // the body's right is -X
      left: new Vector3(1, 0, 0),
      top: new Vector3(0, 1, 0.001),
      bottom: new Vector3(0, -1, -0.001),
    }
    cameraActions.view = (v) => {
      const { centre, radius } = bodyBounds()
      fly(centre, VIEW_DIRS[v], radius)
    }
    cameraActions.frameBody = () => {
      const { centre, radius } = bodyBounds()
      fly(centre, currentDir(), radius)
    }
    cameraActions.focus = (point, radius = 0.25) => fly(point, currentDir(), radius)

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const key = e.code.replace('Numpad', '').replace('Digit', '')
      let handled = true
      if (key === '1') cameraActions.view(e.ctrlKey ? 'back' : 'front')
      else if (key === '3') cameraActions.view(e.ctrlKey ? 'left' : 'right')
      else if (key === '7') cameraActions.view(e.ctrlKey ? 'bottom' : 'top')
      else if (e.code === 'Home') cameraActions.frameBody()
      else handled = false
      if (handled) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [camera])

  // Smooth camera moves between views
  useFrame(() => {
    const f = flight.current
    const c = controls.current
    if (!f || !c) return
    const t = Math.min(1, (performance.now() - f.start) / 450)
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    camera.position.lerpVectors(f.fromPos, f.toPos, e)
    c.target.lerpVectors(f.fromTarget, f.toTarget, e)
    c.update()
    if (t >= 1) flight.current = null
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[0, 0.82, 0]}
      minDistance={0.6}
      maxDistance={7}
      mouseButtons={BLENDER_BUTTONS}
      zoomToCursor
    />
  )
}
