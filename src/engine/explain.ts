import type { Compensation } from './compensation'
import { forwardKinematics } from './kinematics'
import type { StrandModel } from './model'
import { pathLength } from './musclePath'
import { DOF_BY_KEY, JOINT_BY_ID } from './skeleton'
import type { MuscleResult, SimulationResult } from './simulate'

const r0 = (v: number) => Math.round(v)
const pct = (v: number) => `${Math.round(v * 100)}%`

/** Plain description of a joint angle, e.g. "the hip is bent 95°". */
export function dofPhrase(key: string, value: number): string {
  const d = DOF_BY_KEY[key]
  const joint = JOINT_BY_ID[d.joint]
  const j = joint.label.replace(/^(Left|Right) /, '').toLowerCase()
  const side = joint.side ? (joint.side === 'L' ? 'left ' : 'right ') : ''
  const the = `the ${side}${j}`
  const v = r0(Math.abs(value))
  switch (d.name) {
    case 'flexion':
      if (d.joint === 'lumbar' || d.joint === 'thoracic' || d.joint === 'neck') {
        const part = d.joint === 'lumbar' ? 'lower back' : d.joint === 'thoracic' ? 'upper back' : 'neck'
        if (value > 3) return `the ${part} is rounded ${v}°`
        if (value < -3) return `the ${part} is arched ${v}°`
        return `the ${part} is neutral`
      }
      if (d.joint.startsWith('wrist')) return value > 3 ? `${the} is bent palm-side ${v}°` : value < -3 ? `${the} is bent back ${v}°` : `${the} is straight`
      if (value > 3) return `${the} is bent ${v}°`
      if (value < -3) return d.joint.startsWith('hip') ? `${the} is extended ${v}° behind the body` : `${the} is pushed ${v}° past straight`
      return `${the} is straight`
    case 'abduction':
      return value > 3 ? `${the} is out to the side ${v}°` : value < -3 ? `${the} is drawn in ${v}°` : `${the} is not turned out`
    case 'rotation':
      if (d.joint === 'lumbar' || d.joint === 'thoracic' || d.joint === 'neck') return `${the} is twisted ${v}° to the ${value > 0 ? 'left' : 'right'}`
      return value > 3 ? `${the} is rotated inward ${v}°` : value < -3 ? `${the} is rotated outward ${v}°` : `${the} is not rotated`
    case 'lateral':
      return `${the} is bent ${v}° to the ${value > 0 ? 'left' : 'right'}`
    case 'dorsiflexion':
      return value > 3 ? `${the} is bent ${v}° (shin tilted over the foot)` : value < -3 ? `the ${side}toes are pointed ${v}°` : `${the} is neutral`
    case 'inversion':
      return value > 3 ? `${the} is rolled out ${v}° (sole inward)` : `${the} is rolled in ${v}°`
    case 'elevation':
      if (d.joint.startsWith('scapula')) return value > 3 ? `the ${side}shoulder is shrugged ${v}°` : `the ${side}shoulder is pulled down ${v}°`
      return `the ${side}arm is raised ${v}°`
    case 'plane':
      return value > 45 ? `the ${side}arm is in front of the body` : value < -20 ? `the ${side}arm is behind the body` : `the ${side}arm is out to the side`
    case 'protraction':
      return value > 3 ? `the ${side}shoulder blade is pushed forward ${v}°` : `the ${side}shoulder blade is squeezed back ${v}°`
  }
  return `${d.label} ${r0(value)}°`
}

/** What a muscle does when it produces torque in a DOF's positive (+1) or negative (-1) direction. */
export function actionPhrase(key: string, sign: number): string {
  const d = DOF_BY_KEY[key]
  const joint = JOINT_BY_ID[d.joint]
  const j = joint.label.replace(/^(Left|Right) /, '').toLowerCase()
  const spine = d.joint === 'lumbar' || d.joint === 'thoracic' || d.joint === 'neck'
  const part = d.joint === 'lumbar' ? 'lower back' : d.joint === 'thoracic' ? 'upper back' : d.joint === 'neck' ? 'head and neck' : j
  switch (d.name) {
    case 'flexion':
      if (spine) return sign > 0 ? `curling the ${part} forward` : `holding the ${part} up (extending it)`
      if (d.joint.startsWith('knee')) return sign > 0 ? 'bending the knee' : 'straightening the knee'
      if (d.joint.startsWith('elbow')) return sign > 0 ? 'bending the elbow' : 'straightening the elbow'
      if (d.joint.startsWith('wrist')) return sign > 0 ? 'bending the wrist palm-side' : 'pulling the back of the hand up'
      return sign > 0 ? 'bending (flexing) the hip' : 'extending the hip'
    case 'abduction':
      return sign > 0 ? 'pushing the thigh out to the side' : 'pulling the thigh inward'
    case 'rotation':
      if (spine) return `turning the ${part} to the ${sign > 0 ? 'left' : 'right'}`
      return sign > 0 ? `rotating the ${j} inward` : `rotating the ${j} outward`
    case 'lateral':
      return `side-bending the ${part} to the ${sign > 0 ? 'left' : 'right'}`
    case 'dorsiflexion':
      return sign > 0 ? 'pulling the toes up / the shin forward' : 'pointing the foot (pushing through the forefoot)'
    case 'inversion':
      return sign > 0 ? 'rolling the sole inward' : 'rolling the sole outward'
    case 'elevation':
      if (d.joint.startsWith('scapula')) return sign > 0 ? 'lifting the shoulder blade' : 'pulling the shoulder blade down'
      return sign > 0 ? 'raising the arm' : 'pulling the arm down'
    case 'plane':
      return sign > 0 ? 'swinging the arm forward' : 'swinging the arm back'
    case 'protraction':
      return sign > 0 ? 'pushing the shoulder blade forward around the ribs' : 'squeezing the shoulder blades together'
  }
  return d.label
}

export interface MuscleExplanation {
  title: string
  stretchText: string
  loadText: string
  feel: string
  reasons: { dof: string; phrase: string; mm: number }[]
  compensation?: string
}

/** Which joints are making this muscle longer or shorter than when standing, in mm. */
export function lengthContributions(sim: SimulationResult, model: StrandModel[], muscle: MuscleResult) {
  const strands = model.filter((s) => s.muscleKey === muscle.key)
  // Representative strand: the most stretched one
  let rep = strands[0]
  let best = -Infinity
  for (const s of strands) {
    const r = sim.strands.find((x) => x.key === s.key)!
    if (r.stretch > best) {
      best = r.stretch
      rep = s
    }
  }
  const base = pathLength(sim.pose, rep.nodes)
  const out: { dof: string; mm: number }[] = []
  for (const key of Object.keys(sim.angles)) {
    if (Math.abs(sim.angles[key]) < 1) continue
    const a = { ...sim.angles, [key]: 0 }
    const l = pathLength(forwardKinematics(a, sim.root), rep.nodes)
    const mm = (base - l) * 1000
    if (Math.abs(mm) >= 3) out.push({ dof: key, mm })
  }
  return out.sort((x, y) => Math.abs(y.mm) - Math.abs(x.mm))
}

export function explainMuscle(
  sim: SimulationResult,
  model: StrandModel[],
  key: string,
  ctx: { loadKg: number; contacts: string[]; compensations: Compensation[] },
): MuscleExplanation {
  const m = sim.muscleByKey[key]
  const name = `${m.side === 'L' ? 'Left' : 'Right'} ${m.def.name.charAt(0).toLowerCase()}${m.def.name.slice(1)}`
  const contrib = lengthContributions(sim, model, m)
  const lengthening = contrib.filter((c) => c.mm > 0).slice(0, 2)
  const shortening = contrib.filter((c) => c.mm < 0).slice(0, 1)

  // Stretch: describe the most stretched strand when the muscle has several parts
  let stretchText: string
  const repStrand = m.strands.reduce((a, b) => (b.stretch > a.stretch ? b : a))
  const repIdx = m.strands.indexOf(repStrand)
  const partName = m.strands.length > 1 ? `${m.def.name} (${m.def.strands[repIdx].name})` : m.def.name
  const lengthRatio = m.strands.length > 1 ? repStrand.lengthRatio : m.lengthRatio
  const ratio = pct(lengthRatio)
  if (lengthRatio > 1.03 && lengthening.length) {
    const because = lengthening.map((c) => dofPhrase(c.dof, sim.angles[c.dof]))
    // A crossed joint that is near neutral and would otherwise slacken the muscle ("with the knee straight")
    const neutralNote = neutralCrossed(sim, model, m)
    stretchText = `${partName} at ${ratio} of resting length because ${joinAnd(because)}${neutralNote ? ` with ${neutralNote}` : ''}.`
    if (shortening.length) stretchText += ` ${capital(dofPhrase(shortening[0].dof, sim.angles[shortening[0].dof]))}, which gives back some slack.`
  } else if (lengthRatio < 0.97 && shortening.length) {
    const because = contrib.filter((c) => c.mm < 0).slice(0, 2).map((c) => dofPhrase(c.dof, sim.angles[c.dof]))
    stretchText = `${partName} is shortened to ${ratio} of resting length because ${joinAnd(because)}.`
  } else {
    stretchText = `${partName} is close to its resting length (${ratio}).`
  }
  if (m.stretch > 1) stretchText += ` That is past the comfortable range for your profile (${pct(m.stretch)}).`
  else if (m.stretch > 0.7) stretchText += ` It is near the end of its comfortable range (${pct(m.stretch)}).`

  // Load
  let loadText: string
  // Rank by useful contribution: torque in the direction the joint actually needs.
  // Left/right pairs that cancel each other (e.g. side-bending) score close to zero.
  const useful = (k: string, t: number) => {
    const need = sim.jointTorque[k] ?? 0
    return (t * need) / (Math.abs(need) + 5)
  }
  const entries = Object.entries(m.torque)
    .filter(([k, t]) => useful(k, t) > 0)
    .sort((a, b) => useful(b[0], b[1]) - useful(a[0], a[1]))
  if (!entries.length) entries.push(...Object.entries(m.torque).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])))
  if (m.activation < 0.05) {
    loadText = m.passive > 0.05 ? `Not actively working, but the stretch itself creates about ${Math.round(m.force)} N of passive tension.` : 'Barely working in this pose.'
  } else {
    const main = entries[0]
    const action = main ? actionPhrase(main[0], Math.sign(main[1])) : 'stabilising the joint'
    const against = ctx.loadKg > 0 ? `the body's weight and the ${ctx.loadKg} kg load` : contactsAgainst(ctx.contacts)
    loadText = `Working at about ${pct(m.activation)} of estimated strength, mainly ${action}${main ? ` (${Math.abs(main[1]).toFixed(0)} N·m)` : ''} against ${against}.`
    if (entries[1] && Math.abs(entries[1][1]) > Math.abs(entries[0][1]) * 0.4) loadText += ` It also helps with ${actionPhrase(entries[1][0], Math.sign(entries[1][1]))}.`
    if (lengthRatio > 1.08) loadText += ' It is working while lengthened, which is the most demanding way for a muscle to work.'
  }

  // Feel
  let feel: string
  if (m.stretch > 1.25) feel = 'Strong, possibly painful stretch.'
  else if (m.stretch > 1) feel = 'Strong stretch.'
  else if (m.activation > 0.9) feel = 'Close to maximum effort; it would tire within seconds.'
  else if (m.activation > 0.5) feel = 'Hard work; burning after a while.'
  else if (m.stretch > 0.7) feel = 'Noticeable stretch.'
  else if (m.activation > 0.2) feel = 'Moderate effort.'
  else feel = 'Relaxed.'

  const comp = ctx.compensations.find((c) => c.muscleId === m.def.id && c.sides.includes(m.side))

  return {
    title: name,
    stretchText,
    loadText,
    feel,
    reasons: contrib.slice(0, 4).map((c) => ({ dof: c.dof, phrase: dofPhrase(c.dof, sim.angles[c.dof]), mm: c.mm })),
    compensation: comp?.text,
  }
}

function neutralCrossed(sim: SimulationResult, model: StrandModel[], m: MuscleResult): string | null {
  // Joints this muscle crosses that are near 0 but would shorten the muscle if bent.
  const strands = model.filter((s) => s.muscleKey === m.key)
  const rep = strands[0]
  const base = pathLength(sim.pose, rep.nodes)
  for (const key of Object.keys(sim.angles)) {
    const d = DOF_BY_KEY[key]
    if (d.name !== 'flexion' || Math.abs(sim.angles[key]) > 10) continue
    if (!d.joint.startsWith('knee') && !d.joint.startsWith('elbow')) continue
    const l = pathLength(forwardKinematics({ ...sim.angles, [key]: 45 }, sim.root), rep.nodes)
    if (base - l > 0.01) return dofPhrase(key, sim.angles[key]).replace(' is ', ' ')
  }
  return null
}

function contactsAgainst(contacts: string[]): string {
  if (contacts.some((c) => c.startsWith('palm') || c.startsWith('olecranon'))) return 'gravity, with the body propped on the hands and feet'
  return "the body's weight"
}

const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
