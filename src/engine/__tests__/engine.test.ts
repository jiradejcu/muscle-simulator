import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  analyse,
  buildModel,
  clampAngles,
  defaultProfile,
  DOFS,
  explainMuscle,
  neutralAngles,
  POSE_BY_ID,
  POSES,
  poseAngles,
  poseContacts,
  PROFILE_PRESETS,
  SEGMENTS,
  type Angles,
  type PoseDef,
  type Profile,
} from '../index'
import { forwardKinematics, transformPoint } from '../kinematics'
import { LANDMARKS } from '../landmarks'
import { pathLength } from '../musclePath'
import { GRAVITY } from '../statics'
import { kneeValgus } from '../warnings'

const ROOT = { pitch: 0, roll: 0, position: new Vector3(0, 0.925, 0) }
const normal = defaultProfile()
const model = buildModel(normal)

function run(pose: PoseDef, profile: Profile = normal, compensate = true, override: Partial<Angles> = {}) {
  const m = profile === normal ? model : buildModel(profile)
  return analyse({
    target: { ...poseAngles(pose), ...override } as Angles,
    pose: { ...pose, contacts: poseContacts(pose) },
    root: pose.root ?? { pitch: 0, roll: 0 },
    load: { point: pose.load?.point ?? null, kg: pose.load?.kg ?? 0 },
    profile,
    model: m,
    compensate,
  })
}

function strandLength(key: string, angles: Angles) {
  const s = model.find((m) => m.key === key)!
  return pathLength(forwardKinematics(angles, ROOT), s.nodes)
}

describe('skeleton and forward kinematics', () => {
  it('has about 20 joints and 30+ muscle groups', () => {
    expect(new Set(DOFS.map((d) => d.joint)).size).toBeGreaterThanOrEqual(17)
    expect(new Set(model.map((s) => s.muscle.id)).size).toBeGreaterThanOrEqual(30)
  })

  it('reproduces the rest skeleton at neutral', () => {
    const pose = forwardKinematics(neutralAngles(), ROOT)
    for (const s of SEGMENTS) {
      const t = pose[s.id].t
      expect(t.x).toBeCloseTo(s.origin[0], 6)
      expect(t.y).toBeCloseTo(s.origin[1], 6)
      expect(t.z).toBeCloseTo(s.origin[2], 6)
    }
  })

  it('bends the knee backward and the hip forward', () => {
    const a = { ...neutralAngles(), 'kneeL.flexion': 90 }
    const pose = forwardKinematics(a, ROOT)
    expect(pose.footL.t.z).toBeLessThan(pose.shankL.t.z - 0.3) // ankle behind knee
    const b = { ...neutralAngles(), 'hipL.flexion': 90 }
    const pose2 = forwardKinematics(b, ROOT)
    expect(pose2.shankL.t.z).toBeGreaterThan(0.35) // knee in front of hip
  })

  it('mirrors the right side', () => {
    const a = { ...neutralAngles(), 'hipL.abduction': 30, 'hipR.abduction': 30 }
    const pose = forwardKinematics(a, ROOT)
    expect(pose.shankL.t.x).toBeCloseTo(-pose.shankR.t.x, 6)
    expect(pose.shankL.t.x).toBeGreaterThan(0.2)
  })

  it('raises the arm in front with plane 90 and to the side with plane 0', () => {
    const front = forwardKinematics({ ...neutralAngles(), 'shoulderL.elevation': 90, 'shoulderL.plane': 90 }, ROOT)
    const side = forwardKinematics({ ...neutralAngles(), 'shoulderL.elevation': 90, 'shoulderL.plane': 0 }, ROOT)
    expect(front.forearmL.t.z).toBeGreaterThan(0.25)
    expect(side.forearmL.t.x).toBeGreaterThan(0.4)
  })

  it('clamps angles to joint limits', () => {
    const a = clampAngles({ ...neutralAngles(), 'kneeL.flexion': 400, 'elbowR.flexion': -90 })
    expect(a['kneeL.flexion']).toBe(150)
    expect(a['elbowR.flexion']).toBe(-8)
  })
})

describe('muscle geometry', () => {
  it('lengthens the hamstrings with hip flexion and shortens them with knee flexion', () => {
    const n = neutralAngles()
    const rest = strandLength('hamstrings.L.0', n)
    expect(strandLength('hamstrings.L.0', { ...n, 'hipL.flexion': 90 })).toBeGreaterThan(rest * 1.15)
    expect(strandLength('hamstrings.L.0', { ...n, 'kneeL.flexion': 90 })).toBeLessThan(rest)
  })

  it('gives the knee extensors a consistent moment arm through the full range', () => {
    for (let k = 0; k <= 140; k += 10) {
      const a = { ...neutralAngles(), 'kneeL.flexion': k }
      const dl = strandLength('vasti.L.0', { ...a, 'kneeL.flexion': k + 1 }) - strandLength('vasti.L.0', a)
      const arm = dl / (Math.PI / 180)
      expect(arm).toBeGreaterThan(0.03)
      expect(arm).toBeLessThan(0.07)
    }
  })

  it('keeps gluteus maximus a hip extensor in deep flexion', () => {
    for (const k of ['gluteusMaximus.L.1', 'gluteusMaximus.L.2']) {
      for (let h = 0; h <= 120; h += 20) {
        const a = { ...neutralAngles(), 'hipL.flexion': h }
        expect(strandLength(k, { ...a, 'hipL.flexion': h + 1 })).toBeGreaterThan(strandLength(k, a))
      }
    }
  })

  it('makes tight hamstrings reach their comfortable limit sooner', () => {
    const tight = { ...normal, flexibility: { ...normal.flexibility, slr: 50 } }
    const tm = buildModel(tight)
    const a = model.find((s) => s.key === 'hamstrings.L.0')!
    const b = tm.find((s) => s.key === 'hamstrings.L.0')!
    expect(b.comfortLength).toBeLessThan(a.comfortLength - 0.02)
    expect(b.restLength).toBeCloseTo(a.restLength, 9)
  })
})

describe('statics', () => {
  it('supports exactly the body weight through the floor', () => {
    for (const id of ['standing', 'squat', 'pushupTop', 'plank']) {
      const res = run(POSE_BY_ID[id])
      const up = res.sim.forces.filter((f) => f.kind === 'ground').reduce((s, f) => s + f.force.y, 0)
      expect(up).toBeCloseTo(normal.bodyMass * GRAVITY, 3)
    }
  })

  it('adds an external load to the floor reaction', () => {
    const res = run(POSE_BY_ID.deadlift)
    const up = res.sim.forces.filter((f) => f.kind === 'ground').reduce((s, f) => s + f.force.y, 0)
    expect(up).toBeCloseTo((normal.bodyMass + 60) * GRAVITY, 3)
  })

  it('needs very little muscle effort to stand', () => {
    const res = run(POSE_BY_ID.standing)
    for (const m of res.sim.muscles) expect(m.activation).toBeLessThan(0.2)
  })

  it('loads the knee and hip extensors in a squat', () => {
    const stand = run(POSE_BY_ID.standing).sim
    const squat = run(POSE_BY_ID.backSquat).sim
    expect(squat.muscleByKey['vasti.L'].activation).toBeGreaterThan(stand.muscleByKey['vasti.L'].activation + 0.2)
    expect(squat.muscleByKey['gluteusMaximus.L'].activation).toBeGreaterThan(0.2)
    expect(squat.jointTorque['kneeL.flexion']).toBeLessThan(-40) // extension torque needed
  })

  it('loads the back extensors in a deadlift, more when the back rounds', () => {
    const good = run(POSE_BY_ID.deadlift).sim.muscleByKey['erectorSpinae.L']
    const bad = run(POSE_BY_ID.deadliftRounded).sim.muscleByKey['erectorSpinae.L']
    expect(good.activation).toBeGreaterThan(0.4)
    expect(bad.activation).toBeGreaterThan(good.activation)
  })

  it('works the abdominals and hip flexors in a plank', () => {
    const sim = run(POSE_BY_ID.plank).sim
    expect(sim.muscleByKey['rectusAbdominis.L'].activation + sim.muscleByKey['iliopsoas.L'].activation).toBeGreaterThan(0.3)
  })

  it('is left-right symmetric for symmetric poses', () => {
    const sim = run(POSE_BY_ID.squat).sim
    for (const m of sim.muscles.filter((x) => x.side === 'L')) {
      const r = sim.muscleByKey[m.key.replace('.L', '.R')]
      expect(m.activation).toBeCloseTo(r.activation, 2)
      expect(m.lengthRatio).toBeCloseTo(r.lengthRatio, 4)
    }
  })
})

describe('preset poses', () => {
  for (const pose of POSES) {
    it(`${pose.id}: valid, grounded and fast`, () => {
      const t0 = performance.now()
      const res = run(pose)
      const ms = performance.now() - t0
      expect(ms).toBeLessThan(200)
      // Every requested angle is inside the joint limits
      const target = poseAngles(pose)
      for (const d of DOFS) {
        expect(target[d.key]).toBeGreaterThanOrEqual(d.min)
        expect(target[d.key]).toBeLessThanOrEqual(d.max)
      }
      // Contacts rest on the floor, nothing sinks into it
      const ys = poseContacts(pose).map((c) => transformPoint(res.sim.pose, LANDMARKS[c].seg, LANDMARKS[c].p).y)
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(-1e-6)
      expect(Math.min(...ys)).toBeLessThan(0.03)
      for (const s of SEGMENTS) expect(res.sim.pose[s.id].t.y).toBeGreaterThan(-0.005)
      expect(res.sim.imbalance).toBeLessThan(0.03)
    })
  }
})

describe('compensation, warnings and explanations', () => {
  it('rounds the lower back when tight hamstrings limit a forward fold', () => {
    const tight = { ...normal, flexibility: { ...normal.flexibility, slr: 45 } }
    const flexible = { ...normal, flexibility: { ...normal.flexibility, slr: 120 } }
    const t = run(POSE_BY_ID.forwardFold, tight)
    const f = run(POSE_BY_ID.forwardFold, flexible)
    expect(t.sim.angles['hipL.flexion']).toBeLessThan(f.sim.angles['hipL.flexion'] - 15)
    expect(t.sim.angles['lumbar.flexion']).toBeGreaterThan(f.sim.angles['lumbar.flexion'] + 8)
    expect(t.compensations.some((c) => c.id === 'hamstrings-pelvis')).toBe(true)
    // The pelvis ends up tilted back (less whole-body pitch toward the floor)
    expect(t.sim.root.pitch).toBeLessThan(f.sim.root.pitch)
  })

  it('does not compensate when compensation is switched off', () => {
    const tight = { ...normal, flexibility: { ...normal.flexibility, slr: 45 } }
    const res = run(POSE_BY_ID.forwardFold, tight, false)
    expect(res.compensations).toHaveLength(0)
    expect(res.sim.angles['hipL.flexion']).toBe(poseAngles(POSE_BY_ID.forwardFold)['hipL.flexion'])
  })

  it('arches the back when tight lats limit an overhead press', () => {
    const tight = { ...normal, flexibility: { ...normal.flexibility, shoulderFlexion: 120 } }
    const res = run(POSE_BY_ID.overheadPress, tight)
    expect(res.compensations.some((c) => c.id === 'lats-arch')).toBe(true)
    expect(res.sim.angles['lumbar.flexion']).toBeLessThan(0)
  })

  it('warns about a rounded back under load', () => {
    expect(run(POSE_BY_ID.deadliftRounded).warnings.some((w) => w.id === 'rounded-back' && w.severity === 'warning')).toBe(true)
    expect(run(POSE_BY_ID.deadlift).warnings.some((w) => w.id === 'rounded-back')).toBe(false)
  })

  it('warns about knees caving in only in the valgus squat', () => {
    expect(run(POSE_BY_ID.squatValgus).warnings.some((w) => w.id.startsWith('valgus'))).toBe(true)
    expect(run(POSE_BY_ID.squat).warnings.some((w) => w.id.startsWith('valgus'))).toBe(false)
  })

  it('warns about shoulder impingement angles', () => {
    const res = run(POSE_BY_ID.standing, normal, true, { 'shoulderL.elevation': 90, 'shoulderL.plane': 10, 'shoulderL.rotation': 50 })
    expect(res.warnings.some((w) => w.id === 'impingement-L')).toBe(true)
  })

  it('warns about knee hyperextension under body weight', () => {
    const res = run(POSE_BY_ID.standing, normal, true, { 'kneeL.flexion': -8, 'kneeR.flexion': -8 })
    expect(res.warnings.some((w) => w.id === 'knee-hyper-L')).toBe(true)
  })

  it('warns about end-of-range joints', () => {
    const res = run(POSE_BY_ID.standing, normal, true, { 'neck.rotation': 75 })
    expect(res.warnings.some((w) => w.id === 'range-neck.rotation')).toBe(true)
  })

  it('has no serious warnings when simply standing', () => {
    expect(run(POSE_BY_ID.standing).warnings.filter((w) => w.severity !== 'info')).toHaveLength(0)
  })

  it('explains hamstring stretch in plain language', () => {
    const res = run(POSE_BY_ID.forwardFold)
    const ex = explainMuscle(res.sim, model, 'hamstrings.L', { loadKg: 0, contacts: poseContacts(POSE_BY_ID.forwardFold), compensations: res.compensations })
    expect(ex.stretchText).toMatch(/Hamstrings .* at \d+% of resting length because the left hip is bent \d+°/)
    expect(ex.stretchText).toMatch(/knee straight/)
    expect(ex.compensation).toBeTruthy()
  })

  it('explains what a working muscle is doing', () => {
    const res = run(POSE_BY_ID.deadlift)
    const ex = explainMuscle(res.sim, model, 'erectorSpinae.L', { loadKg: 60, contacts: poseContacts(POSE_BY_ID.deadlift), compensations: [] })
    expect(ex.loadText).toMatch(/holding the lower back up/)
    expect(ex.loadText).toMatch(/60 kg/)
  })

  it('every profile preset produces a valid analysis', () => {
    for (const preset of PROFILE_PRESETS) {
      const p = { ...normal, flexibility: { ...normal.flexibility, ...preset.values } }
      for (const id of ['squat', 'forwardFold', 'overheadPress']) {
        const res = run(POSE_BY_ID[id], p)
        for (const m of res.sim.muscles) {
          expect(Number.isFinite(m.activation)).toBe(true)
          expect(Number.isFinite(m.stretch)).toBe(true)
        }
      }
    }
  })
})

describe('postural conditions', () => {
  const withCond = (c: Profile['conditions']) => ({ ...normal, conditions: c })

  it('scoliosis bends and twists the spine and makes the trunk asymmetric', () => {
    const res = run(POSE_BY_ID.standing, withCond({ scoliosis: 1 }))
    expect(res.sim.angles['thoracic.lateral']).toBeGreaterThan(15)
    expect(res.sim.angles['lumbar.lateral']).toBeLessThan(-10)
    expect(res.sim.angles['thoracic.rotation']).toBeLessThan(-5)
    const l = res.sim.muscleByKey['quadratusLumborum.L'].lengthRatio
    const r = res.sim.muscleByKey['quadratusLumborum.R'].lengthRatio
    expect(Math.abs(l - r)).toBeGreaterThan(0.05)
    expect(res.warnings.some((w) => w.id === 'condition-scoliosis')).toBe(true)
  })

  it('scales posture with severity and leaves the pose alone at 0', () => {
    const half = run(POSE_BY_ID.standing, withCond({ kyphosis: 0.5 })).sim.angles['thoracic.flexion']
    const full = run(POSE_BY_ID.standing, withCond({ kyphosis: 1 })).sim.angles['thoracic.flexion']
    expect(full).toBeCloseTo(2 * half, 5)
    expect(run(POSE_BY_ID.standing, withCond({ kyphosis: 0 })).sim.angles['thoracic.flexion']).toBe(0)
  })

  it('anterior pelvic tilt arches the lower back', () => {
    expect(run(POSE_BY_ID.standing, withCond({ lordosis: 1 })).sim.angles['lumbar.flexion']).toBeLessThan(-15)
  })

  it('knock knees move the knees inward in a squat', () => {
    const base = kneeValgus(run(POSE_BY_ID.squat).sim, 'L')
    const knock = kneeValgus(run(POSE_BY_ID.squat, withCond({ kneeValgus: 1, flatFeet: 1 })).sim, 'L')
    expect(knock).toBeGreaterThan(base + 0.03)
  })

  it('weak glutes shift hip extension work to other muscles', () => {
    const base = run(POSE_BY_ID.backSquat).sim
    const weak = run(POSE_BY_ID.backSquat, withCond({ weakGlutes: 1 })).sim
    expect(weak.muscleByKey['gluteusMaximus.L'].force).toBeLessThan(base.muscleByKey['gluteusMaximus.L'].force)
    expect(weak.muscleByKey['hamstrings.L'].activation + weak.muscleByKey['adductors.L'].activation).toBeGreaterThan(
      base.muscleByKey['hamstrings.L'].activation + base.muscleByKey['adductors.L'].activation,
    )
  })

  it('knee hyperextension condition raises the hyperextension warning', () => {
    expect(run(POSE_BY_ID.standing, withCond({ kneeHyperextension: 1 })).warnings.some((w) => w.id === 'knee-hyper-L')).toBe(true)
  })
})
