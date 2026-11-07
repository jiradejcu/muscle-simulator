import type { Camera, Vector3 } from 'three'
import { create } from 'zustand'

export interface LabelItem {
  key: string
  name: string
  pos: Vector3
  selected: boolean
}

/** Labels computed inside the canvas and drawn by <LabelOverlay> outside it (plain DOM). */
export const useLabelStore = create<{ items: LabelItem[] }>(() => ({ items: [] }))

/** The live camera, shared with the DOM overlay for projecting label positions. */
export const viewState: { camera: Camera | null } = { camera: null }
