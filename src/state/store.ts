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
  skin: boolean
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
  root: { pitch: number; roll: number }
  loadPoint: LoadPoint | null
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
  applyProfilePreset: (id: string) => void
  selectMuscle: (key: string | null) => void
  hoverMuscle: (key: string | null) => void
  selectJoint: (id: string | null) => void
  contextMenu: ContextMenuState | null
  openContextMenu: (m: ContextMenuState | null) => void
  setView: (patch: Partial<ViewOptions>) => void
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function run(s: Pick<AppState, 'current' | 'contacts' | 'autoLevel' | 'balance' | 'root' | 'loadPoint' | 'loadKg' | 'profile' | 'model' | 'compensate'>, pitchOverride?: number, prevPitch?: number): Analysis {
  const levelled = pitchOverride === undefined && s.autoLevel
  return analyse({
    target: s.current,
    pose: { contacts: s.contacts, autoLevel: levelled, balance: s.balance && levelled },
    root: pitchOverride === undefined ? s.root : { pitch: pitchOverride, roll: s.root.roll },
    load: { point: s.loadPoint, kg: s.loadKg },
    profile: s.profile,
    model: s.model,
    compensate: s.compensate && pitchOverride === undefined,
    pitchHint: prevPitch,
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
  root: initialPose.root ?? { pitch: 0, roll: 0 },
  loadPoint: initialPose.load?.point ?? null,
  loadKg: initialPose.load?.kg ?? 0,
  profile: initialProfile,
  model: initialModel,
  compensate: true,
}

export const useStore = create<AppState>((set, get) => {
  /** Re-run the analysis after an input change (no animation). */
  const recompute = (patch: Partial<AppState>) => {
    const s = { ...get(), ...patch }
    const analysis = run(s, undefined, get().analysis?.sim.root.pitch)
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
    view: { heat: true, skin: false, superficial: true, deep: true, bones: true, labels: true, gizmos: false, forces: false },

    setPose: (id) => {
      const pose = POSE_BY_ID[id]
      const s = get()
      const to = poseAngles(pose)
      const contacts = poseContacts(pose)
      const root = pose.root ?? { pitch: 0, roll: 0 }
      const toPitch = pose.autoLevel ? placeBody(to, contacts, true, root).root.pitch : root.pitch
      set({
        poseId: id,
        target: to,
        contacts,
        autoLevel: pose.autoLevel,
        balance: !!pose.balance,
        root,
        loadPoint: pose.load?.point ?? null,
        loadKg: pose.load?.kg ?? 0,
        anim: { from: { ...s.current }, to, fromPitch: s.analysis.sim.root.pitch, toPitch, start: performance.now(), duration: 900 },
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
        const analysis = run({ ...s, current: s.anim.to }, undefined, s.anim.toPitch)
        set({ current: s.anim.to, anim: null, analysis, version: s.version + 1 })
      } else {
        const pitch = s.anim.fromPitch + (s.anim.toPitch - s.anim.fromPitch) * e
        const analysis = run({ ...s, current }, pitch)
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
