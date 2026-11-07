import type { Vector3 } from 'three'

export type ViewName = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'

/** Camera commands, registered by <CameraControls> so DOM menus can drive the 3D view. */
export const cameraActions: {
  view: (v: ViewName) => void
  frameBody: () => void
  focus: (point: Vector3, radius?: number) => void
} = {
  view: () => {},
  frameBody: () => {},
  focus: () => {},
}

/** Right-click context menu state (null = closed). */
export interface ContextMenuState {
  x: number
  y: number
  muscleKey: string | null
}
