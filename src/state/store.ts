import { create } from 'zustand'
import {
  analyse,
  buildModel,
  clampAngle,
  defaultProfile,
  DOFS,
  POSE_BY_ID,
  poseAngles,
  poseContacts,
  PROFILE_PRESETS,
  type Analysis,
  type ConditionId,
  type Angles,
  type LoadPoint,
  type Profile,
  type ProfileKey,
  type StrandModel,
  type StrengthLevel,
} from '../engine'
import { placeBody } from '../engine/statics'
import type { ContextMenuState } from '../scene/cameraActions'

export interface ViewOptions {
  heat: boolean
  /** Colour by effort/stretch, or by change versus normal strength. */
  heatMode: 'effort' | 'change'
  superficial: boolean
  deep: boolean
  bones: boolean
  labels: boolean
  gizmos: boolean
  forces: boolean
}

interface Animation {
  from: Angles
  to: Angles
  fromPitch: number
  toPitch: number
  fromRoll: number
  toRoll: number
  start: number
  duration: number
}

export interface AppState {
  poseId: string | null
  /** Angles the user asked for (preset or sliders). */
  target: Angles
  /** Angles currently shown (animated toward target). */
  current: Angles
  contacts: string[]
  autoLevel: boolean
  balance: boolean
  levelRoll: boolean
  root: { pitch: number; roll: number }
  loadPoint: LoadPoint | null
  holds: { hand: 'L' | 'R'; foot: 'L' | 'R' }[]
  loadKg: number
  profile: Profile
  profilePreset: string | null
  model: StrandModel[]
  compensate: boolean
  analysis: Analysis
  /** Bumped whenever `analysis` changes, so render loops can skip work. */
  version: number
  anim: Animation | null
  selectedMuscle: string | null
  hoveredMuscle: string | null
  selectedJoint: string | null
  view: ViewOptions

  setPose: (id: string) => void
  setAngle: (key: string, value: number) => void
  setAngles: (values: Angles) => void
  resetToPose: () => void
  mirrorLeftToRight: () => void
  tick: (now: number) => void
  setLoadKg: (kg: number) => void
  setCompensate: (on: boolean) => void
  setFlexibility: (key: ProfileKey, value: number) => void
  setBodyMass: (kg: number) => void
  setStrength: (s: StrengthLevel) => void
  setCondition: (id: ConditionId, severity: number) => void
  setMuscleStrength: (key: string, strength: number, bothSides?: boolean) => void
  resetMuscleStrength: () => void
  applyProfilePreset: (id: string) => void
  selectMuscle: (key: string | null) => void
  hoverMuscle: (key: string | null) => void
  selectJoint: (id: string | null) => void
  contextMenu: ContextMenuState | null
  openContextMenu: (m: ContextMenuState | null) => void
  setView: (patch: Partial<ViewOptions>) => void
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

type RunInput = Pick<AppState, 'current' | 'contacts' | 'autoLevel' | 'balance' | 'levelRoll' | 'root' | 'loadPoint' | 'loadKg' | 'holds' | 'profile' | 'model' | 'compensate'>

/**
 * Run the analysis. `override` fixes the whole-body orientation (used while animating between
 * poses); otherwise the pose levels itself on its contacts, starting from `hint`.
 */
function run(s: RunInput, override?: { pitch: number; roll: number }, hint?: { pitch: number; roll: number }): Analysis {
  const levelled = override === undefined && s.autoLevel
  return analyse({
    target: s.current,
    pose: { contacts: s.contacts, autoLevel: levelled, balance: s.balance && levelled, levelRoll: s.levelRoll && levelled },
    root: override ?? s.root,
    load: { point: s.loadPoint, kg: s.loadKg, holds: s.holds },
    profile: s.profile,
    model: s.model,
    compensate: s.compensate && override === undefined,
    pitchHint: hint?.pitch,
    rollHint: hint?.roll,
  })
}

const initialPose = POSE_BY_ID.squat
const initialProfile = defaultProfile()
const initialModel = buildModel(initialProfile)
const initialAngles = poseAngles(initialPose)
const initialBase = {
  current: initialAngles,
  contacts: poseContacts(initialPose),
  autoLevel: initialPose.autoLevel,
  balance: !!initialPose.balance,
  levelRoll: !!initialPose.levelRoll,
  root: initialPose.root ?? { pitch: 0, roll: 0 },
  loadPoint: initialPose.load?.point ?? null,
  holds: initialPose.holds ?? [],
  loadKg: initialPose.load?.kg ?? 0,
  profile: initialProfile,
  model: initialModel,
  compensate: true,
}

export const useStore = create<AppState>((set, get) => {
  /** Re-run the analysis after an input change (no animation). */
  const recompute = (patch: Partial<AppState>) => {
    const s = { ...get(), ...patch }
    const prev = get().analysis?.sim.root
    const analysis = run(s, undefined, prev && { pitch: prev.pitch, roll: prev.roll })
    set({ ...patch, analysis, version: get().version + 1 })
  }

  return {
    poseId: initialPose.id,
    target: initialAngles,
    ...initialBase,
    profilePreset: 'normal',
    analysis: run(initialBase),
    version: 0,
    anim: null,
    selectedMuscle: 'vasti.L',
    hoveredMuscle: null,
    selectedJoint: null,
    view: { heat: true, heatMode: 'effort', superficial: true, deep: true, bones: true, labels: true, gizmos: false, forces: false },

    setPose: (id) => {
      const pose = POSE_BY_ID[id]
      const s = get()
      const to = poseAngles(pose)
      const contacts = poseContacts(pose)
      const root = pose.root ?? { pitch: 0, roll: 0 }
      const toRoot = pose.autoLevel ? placeBody(to, contacts, true, root, undefined, { levelRoll: pose.levelRoll }).root : root
      set({
        poseId: id,
        target: to,
        contacts,
        autoLevel: pose.autoLevel,
        balance: !!pose.balance,
        levelRoll: !!pose.levelRoll,
        root,
        loadPoint: pose.load?.point ?? null,
        holds: pose.holds ?? [],
        loadKg: pose.load?.kg ?? 0,
        anim: { from: { ...s.current }, to, fromPitch: s.analysis.sim.root.pitch, toPitch: toRoot.pitch, fromRoll: s.analysis.sim.root.roll, toRoll: toRoot.roll, start: performance.now(), duration: 900 },
      })
    },

    setAngle: (key, value) => {
      const v = clampAngle(key, value)
      const target = { ...get().target, [key]: v }
      recompute({ target, current: target, anim: null })
    },

    setAngles: (values) => {
      const target = { ...get().target }
      for (const [k, v] of Object.entries(values)) target[k] = clampAngle(k, v)
      recompute({ target, current: target, anim: null })
    },

    resetToPose: () => {
      const id = get().poseId
      if (id) get().setPose(id)
    },

    mirrorLeftToRight: () => {
      const t = { ...get().target }
      for (const d of DOFS) {
        if (d.key.includes('L.')) t[d.key.replace('L.', 'R.')] = t[d.key]
      }
      t['lumbar.lateral'] = 0
      t['lumbar.rotation'] = 0
      t['thoracic.lateral'] = 0
      t['thoracic.rotation'] = 0
      t['neck.lateral'] = 0
      t['neck.rotation'] = 0
      recompute({ target: t, current: t, anim: null })
    },

    tick: (now) => {
      const s = get()
      if (!s.anim) return
      const t = Math.min(1, (now - s.anim.start) / s.anim.duration)
      const e = easeInOut(t)
      const current: Angles = {}
      for (const d of DOFS) {
        const a = s.anim.from[d.key] ?? 0
        const b = s.anim.to[d.key] ?? 0
        current[d.key] = a + (b - a) * e
      }
      if (t >= 1) {
        const analysis = run({ ...s, current: s.anim.to }, undefined, { pitch: s.anim.toPitch, roll: s.anim.toRoll })
        set({ current: s.anim.to, anim: null, analysis, version: s.version + 1 })
      } else {
        const pitch = s.anim.fromPitch + (s.anim.toPitch - s.anim.fromPitch) * e
        const roll = s.anim.fromRoll + (s.anim.toRoll - s.anim.fromRoll) * e
        const analysis = run({ ...s, current }, { pitch, roll })
        set({ current, analysis, version: s.version + 1 })
      }
    },

    setLoadKg: (kg) => recompute({ loadKg: kg }),
    setCompensate: (on) => recompute({ compensate: on }),

    setFlexibility: (key, value) => {
      const profile = { ...get().profile, flexibility: { ...get().profile.flexibility, [key]: value } }
      recompute({ profile, model: buildModel(profile), profilePreset: null })
    },
    setBodyMass: (kg) => {
      const profile = { ...get().profile, bodyMass: kg }
      recompute({ profile })
    },
    setStrength: (strength) => {
      const profile = { ...get().profile, strength }
      recompute({ profile })
    },
    setMuscleStrength: (key, strength, bothSides) => {
      const [id, side] = key.split('.')
      const keys = bothSides ? [`${id}.L`, `${id}.R`] : [`${id}.${side}`]
      const muscleStrength = { ...get().profile.muscleStrength }
      for (const k of keys) {
        if (Math.abs(strength - 1) < 1e-6) delete muscleStrength[k]
        else muscleStrength[k] = strength
      }
      recompute({ profile: { ...get().profile, muscleStrength } })
    },
    resetMuscleStrength: () => {
      recompute({ profile: { ...get().profile, muscleStrength: {} }, view: { ...get().view, heatMode: 'effort' } })
    },
    setCondition: (id, severity) => {
      const profile = { ...get().profile, conditions: { ...get().profile.conditions, [id]: severity } }
      recompute({ profile })
    },
    applyProfilePreset: (id) => {
      const preset = PROFILE_PRESETS.find((p) => p.id === id)!
      const base = defaultProfile()
      const profile = { ...get().profile, flexibility: { ...base.flexibility, ...preset.values } }
      recompute({ profile, model: buildModel(profile), profilePreset: id })
    },

    selectMuscle: (key) => set({ selectedMuscle: key }),
    hoverMuscle: (key) => set({ hoveredMuscle: key }),
    selectJoint: (id) => set({ selectedJoint: id }),
    contextMenu: null,
    openContextMenu: (m) => set({ contextMenu: m }),
    setView: (patch) => set({ view: { ...get().view, ...patch } }),
  }
})
