// Pose audit: prints hand orientation, top muscle efforts, stretches, warnings and key joint
// torques for every preset (or POSES=id1,id2). Run with: npm run audit
import { test } from 'vitest'
import { Vector3 } from 'three'
import { analyse, buildModel, defaultProfile, POSES, POSE_BY_ID, poseAngles, poseContacts } from '../src/engine/index'
import { transformDir, transformPoint } from '../src/engine/kinematics'
import { LANDMARKS } from '../src/engine/landmarks'

const f = (v: Vector3) => `(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)})`
test('audit', () => {
  const p = defaultProfile(); const model = buildModel(p)
  const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
  const ids = env.POSES ? env.POSES.split(',') : POSES.map(x => x.id)
  for (const id of ids) {
    const pose = POSE_BY_ID[id]
    const r = analyse({ target: poseAngles(pose), pose: { ...pose, contacts: poseContacts(pose) }, root: pose.root ?? { pitch: 0, roll: 0 }, load: { point: pose.load?.point ?? null, kg: pose.load?.kg ?? 0, holds: pose.holds }, profile: p, model, compensate: true })
    const s = r.sim
    // body "head" direction (pelvis up axis) to express hand directions in body terms
    const up = new Vector3(0, 1, 0).applyQuaternion(s.pose.thorax.q)
    console.log(`== ${id}  imbalance ${s.imbalance.toFixed(3)}  bodyUp ${f(up)}`)
    for (const side of ['L', 'R']) {
      const w = s.pose[`hand${side}` as 'handL'].t
      const tip = transformPoint(s.pose, `hand${side}` as 'handL', LANDMARKS[`fingerTip${side}`].p)
      const fingers = tip.clone().sub(w).normalize()
      const palm = transformDir(s.pose, `hand${side}` as 'handL', [0, 0, 1])
      console.log(`   hand${side} fingers ${f(fingers)} palm ${f(palm)} wrist y ${w.y.toFixed(2)}`)
    }
    const top = s.muscles.filter(m => m.side === 'L').sort((a, b) => b.activation - a.activation).slice(0, 7)
    console.log('   effort:', top.map(m => `${m.def.id} ${(m.activation * 100).toFixed(0)}`).join(', '))
    const str = s.muscles.filter(m => m.side === 'L' && m.stretch > 0.8).map(m => `${m.def.id} ${(m.stretch * 100).toFixed(0)}`)
    console.log('   stretch>80:', str.join(', '))
    console.log('   warnings:', r.warnings.filter(w => w.severity !== 'info').map(w => w.title).join(' | '))
    const el = ['elbowL.flexion', 'shoulderL.elevation', 'hipL.flexion', 'kneeL.flexion', 'lumbar.flexion'].map(k => `${k}:${s.jointTorque[k].toFixed(0)}`)
    console.log('   torques:', el.join(' '))
  }
})
