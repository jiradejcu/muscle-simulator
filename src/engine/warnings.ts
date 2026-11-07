import { Vector3 } from 'three'
import type { Compensation } from './compensation'
import { DOFS, JOINT_BY_ID, type Angles, type Side } from './skeleton'
import type { SimulationResult } from './simulate'

export type Severity = 'info' | 'caution' | 'warning'

export interface Warning {
  id: string
  severity: Severity
  title: string
  detail: string
  /** Muscle keys or DOF keys to highlight. */
  muscles?: string[]
  dofs?: string[]
}

const sideName = (s: Side) => (s === 'L' ? 'Left' : 'Right')
const r0 = (v: number) => Math.round(v)
const pct = (v: number) => `${Math.round(v * 100)}%`

export interface WarningContext {
  sim: SimulationResult
  contacts: string[]
  loadKg: number
  compensations: Compensation[]
}

export function computeWarnings({ sim, contacts, loadKg, compensations }: WarningContext): Warning[] {
  const a = sim.angles
  const out: Warning[] = []
  const handsLoaded = loadKg > 0 || contacts.some((c) => c.startsWith('palm') || c.startsWith('knuckles') || c.startsWith('olecranon'))
  const loaded = loadKg > 0 || handsLoaded

  // --- Rounded lower back under load ------------------------------------
  const lumbarFlex = a['lumbar.flexion']
  const trunkLean = trunkInclination(sim)
  if (lumbarFlex > 20 && loadKg > 0) {
    out.push({
      id: 'rounded-back',
      severity: 'warning',
      title: 'Rounded lower back under load',
      detail: `The lower back is rounded ${r0(lumbarFlex)}° while holding ${loadKg} kg. Discs and spinal ligaments take more of the strain and the back muscles work stretched. Hinge from the hips and keep the spine closer to neutral.`,
      muscles: ['erectorSpinae.L', 'erectorSpinae.R', 'multifidus.L', 'multifidus.R'],
      dofs: ['lumbar.flexion'],
    })
  } else if (lumbarFlex > 30 && trunkLean > 35 && !handsLoaded) {
    out.push({
      id: 'rounded-back',
      severity: 'caution',
      title: 'Rounded lower back',
      detail: `The lower back is rounded ${r0(lumbarFlex)}° with the trunk leaning forward. That is fine for a gentle stretch, but lifting anything like this loads the discs and ligaments. Bend the knees a little to let the hips hinge.`,
      muscles: ['erectorSpinae.L', 'erectorSpinae.R', 'multifidus.L', 'multifidus.R'],
      dofs: ['lumbar.flexion'],
    })
  }

  // --- Lower back arched under load --------------------------------------
  if (lumbarFlex < -18 && loaded) {
    out.push({
      id: 'arched-back',
      severity: lumbarFlex < -25 ? 'warning' : 'caution',
      title: 'Lower back hyperextended',
      detail: `The lower back is arched ${r0(-lumbarFlex)}° while carrying load. This compresses the small facet joints at the back of the spine. Brace the abdominals and squeeze the glutes.`,
      muscles: ['rectusAbdominis.L', 'rectusAbdominis.R'],
      dofs: ['lumbar.flexion'],
    })
  }

  // --- Knees caving in (valgus) ------------------------------------------
  for (const s of ['L', 'R'] as Side[]) {
    if (a[`knee${s}.flexion`] < 25) continue
    const dev = kneeValgus(sim, s)
    if (dev > 0.03) {
      out.push({
        id: `valgus-${s}`,
        severity: dev > 0.05 ? 'warning' : 'caution',
        title: `${sideName(s)} knee caving inward`,
        detail: `The ${s === 'L' ? 'left' : 'right'} knee sits ${r0(dev * 100)} cm inside the line from hip to ankle. This twists the knee and loads its inner ligaments. Push the knee out over the little toes; gluteus medius controls this.`,
        muscles: [`gluteusMedius.${s}`, `adductors.${s}`],
        dofs: [`hip${s}.abduction`, `hip${s}.rotation`],
      })
    }
  }

  // --- Shoulder impingement ---------------------------------------------
  for (const s of ['L', 'R'] as Side[]) {
    const elev = a[`shoulder${s}.elevation`]
    const rot = a[`shoulder${s}.rotation`]
    if ((elev >= 60 && elev <= 130 && rot > 25) || (elev > 130 && rot > 15)) {
      out.push({
        id: `impingement-${s}`,
        severity: 'caution',
        title: `${sideName(s)} shoulder impingement angle`,
        detail: `The arm is raised ${r0(elev)}° while rotated inward ${r0(rot)}°. In this position the rotator cuff tendons can pinch under the bony roof of the shoulder (acromion). Turn the arm outward (thumb up) when raising it.`,
        muscles: [`rotatorCuff.${s}`, `deltoid.${s}`],
        dofs: [`shoulder${s}.rotation`],
      })
    }
  }

  // --- Hyperextension ----------------------------------------------------
  for (const s of ['L', 'R'] as Side[]) {
    const footDown = contacts.some((c) => c.endsWith(s) && (c.startsWith('heel') || c.startsWith('ball') || c.startsWith('toe')))
    if (a[`knee${s}.flexion`] < -3 && footDown) {
      out.push({
        id: `knee-hyper-${s}`,
        severity: 'caution',
        title: `${sideName(s)} knee locked into hyperextension`,
        detail: `The knee is pushed ${r0(-a[`knee${s}.flexion`])}° past straight while bearing weight, so ligaments rather than muscles hold it. Keep a soft knee.`,
        dofs: [`knee${s}.flexion`],
      })
    }
    const handDown = contacts.some((c) => c.endsWith(s) && (c.startsWith('palm') || c.startsWith('knuckles')))
    if (a[`elbow${s}.flexion`] < -3 && (handDown || loadKg > 0)) {
      out.push({
        id: `elbow-hyper-${s}`,
        severity: 'caution',
        title: `${sideName(s)} elbow hyperextended`,
        detail: `The elbow is locked ${r0(-a[`elbow${s}.flexion`])}° past straight under load. Keep a micro-bend so the triceps share the load.`,
        dofs: [`elbow${s}.flexion`],
      })
    }
  }
  if (a['neck.flexion'] < -40) {
    out.push({
      id: 'neck-extension',
      severity: 'caution',
      title: 'Neck strongly extended',
      detail: `The head is tipped back ${r0(-a['neck.flexion'])}°. Holding this compresses the back of the neck; look a little further down.`,
      dofs: ['neck.flexion'],
    })
  }

  // --- End of range ------------------------------------------------------
  for (const d of DOFS) {
    const v = a[d.key]
    const range = d.max - d.min
    const nearMax = d.max - v < Math.max(3, range * 0.03) && d.max > 0
    const nearMin = v - d.min < Math.max(3, range * 0.03) && d.min < 0
    if ((nearMax && d.max !== 0) || (nearMin && d.min !== 0)) {
      const joint = JOINT_BY_ID[d.joint]
      out.push({
        id: `range-${d.key}`,
        severity: 'info',
        title: `${joint.label}: end of range`,
        detail: `${d.label} is at ${r0(v)}° (limit ${nearMax ? d.max : d.min}°). Joints at the end of their range rely on ligaments and capsule rather than muscle.`,
        dofs: [d.key],
      })
    }
  }

  // --- Muscles over-stretched / over-loaded -----------------------------
  const seen = new Set<string>()
  for (const m of [...sim.muscles].sort((x, y) => y.stretch - x.stretch)) {
    if (m.stretch <= 1.05 || seen.has(m.def.id)) continue
    seen.add(m.def.id)
    const both = sim.muscleByKey[`${m.def.id}.${m.side === 'L' ? 'R' : 'L'}`]?.stretch > 1.05
    out.push({
      id: `stretch-${m.def.id}`,
      severity: m.stretch > 1.3 ? 'warning' : 'caution',
      title: `${m.def.name} past comfortable stretch`,
      detail: `${both ? 'Both sides are' : `${sideName(m.side)} side is`} at ${pct(m.stretch)} of the comfortable stretch range${partOf(m)}. Expect a strong pull${m.stretch > 1.3 ? ' or pain; ease off' : ''}.`,
      muscles: both ? [`${m.def.id}.L`, `${m.def.id}.R`] : [m.key],
    })
  }
  const seenLoad = new Set<string>()
  for (const m of [...sim.muscles].sort((x, y) => y.activation - x.activation)) {
    if (m.activation <= 1 || seenLoad.has(m.def.id)) continue
    seenLoad.add(m.def.id)
    out.push({
      id: `overload-${m.def.id}`,
      severity: 'warning',
      title: `${m.def.name} overloaded`,
      detail: `Needs about ${pct(m.activation)} of its estimated maximum strength. The pose could not be held for long${loadKg > 0 ? '; reduce the load' : ''}.`,
      muscles: [m.key],
    })
  }

  // --- Balance -----------------------------------------------------------
  if (sim.imbalance > 0.03) {
    out.push({
      id: 'balance',
      severity: 'warning',
      title: 'Off balance',
      detail: `The centre of mass is about ${r0(sim.imbalance * 100)} cm outside the area supported by the floor. You would tip over without holding on.`,
    })
  }

  // --- Compensations -----------------------------------------------------
  for (const c of compensations) {
    out.push({
      id: `comp-${c.id}`,
      severity: 'info',
      title: c.id === 'balance' ? 'Balance adjustment' : 'Body compensation',
      detail: c.text,
      muscles: c.muscleId ? c.sides.map((s) => `${c.muscleId}.${s}`) : undefined,
      dofs: Object.keys(c.changes),
    })
  }

  const order: Record<Severity, number> = { warning: 0, caution: 1, info: 2 }
  return out.sort((x, y) => order[x.severity] - order[y.severity])
}

function partOf(m: SimulationResult['muscles'][number]): string {
  const rep = m.strands.reduce((a, b) => (b.stretch > a.stretch ? b : a))
  const name = m.strands.length > 1 ? `${m.def.strands[m.strands.indexOf(rep)].name}, ` : ''
  return ` (${name}${pct(rep.lengthRatio)} of resting length)`
}

/** Angle of the trunk (pelvis to neck) from vertical, degrees. */
export function trunkInclination(sim: SimulationResult): number {
  const v = sim.pose.head.t.clone().sub(sim.pose.lumbar.t)
  return (Math.acos(Math.min(1, Math.max(-1, v.normalize().y))) * 180) / Math.PI
}

/** How far (m) the knee sits medial to the hip-ankle line, in the body's frontal plane. */
export function kneeValgus(sim: SimulationResult, s: Side): number {
  const hip = sim.pose[`thigh${s}`].t
  const knee = sim.pose[`shank${s}`].t
  const ankle = sim.pose[`foot${s}`].t
  const line = ankle.clone().sub(hip)
  const t = knee.clone().sub(hip).dot(line) / line.lengthSq()
  const closest = hip.clone().addScaledVector(line, t)
  const lateral = new Vector3(1, 0, 0).applyQuaternion(sim.pose.pelvis.q) // body's left
  const off = knee.clone().sub(closest).dot(lateral)
  // Medial means toward the midline: -X for the left leg, +X for the right.
  return s === 'L' ? -off : off
}

/** Convenience for the explanation text. */
export function describeAngles(a: Angles): string {
  return Object.entries(a)
    .filter(([, v]) => Math.abs(v) > 1)
    .map(([k, v]) => `${k}=${r0(v)}`)
    .join(', ')
}
