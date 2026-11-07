import { useState } from 'react'
import { CONDITIONS, DOFS, JOINTS, MUSCLE_BY_ID, POSES, POSE_BY_ID, PROFILE_ITEMS, PROFILE_PRESETS, type StrengthLevel } from '../engine'
import { useStore } from '../state/store'
import { Section, Slider, Toggle } from './controls'

type Tab = 'poses' | 'joints' | 'profile'

export function LeftPanel() {
  const [tab, setTab] = useState<Tab>('poses')
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-slate-700/60 bg-slate-900/95">
      <nav className="flex border-b border-slate-700/60">
        {(['poses', 'joints', 'profile'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-[13px] font-semibold capitalize ${tab === t ? 'border-b-2 border-sky-400 text-sky-100' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {t === 'profile' ? 'My body' : t}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {tab === 'poses' && <PosesTab />}
        {tab === 'joints' && <JointsTab />}
        {tab === 'profile' && <ProfileTab />}
      </div>
    </aside>
  )
}

function PosesTab() {
  const poseId = useStore((s) => s.poseId)
  const setPose = useStore((s) => s.setPose)
  const loadPoint = useStore((s) => s.loadPoint)
  const loadKg = useStore((s) => s.loadKg)
  const setLoadKg = useStore((s) => s.setLoadKg)
  const compensate = useStore((s) => s.compensate)
  const setCompensate = useStore((s) => s.setCompensate)
  const pose = poseId ? POSE_BY_ID[poseId] : null
  const categories = ['Standing', 'Floor', 'Stretch'] as const
  return (
    <>
      {categories.map((cat) => (
        <Section key={cat} title={cat}>
          <div className="grid grid-cols-2 gap-1.5">
            {POSES.filter((p) => p.category === cat).map((p) => (
              <button
                key={p.id}
                onClick={() => setPose(p.id)}
                className={`rounded-md border px-2 py-1.5 text-left text-[12px] leading-tight transition ${
                  poseId === p.id ? 'border-sky-400 bg-sky-500/20 text-white' : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </Section>
      ))}
      {pose && (
        <Section title="About this pose">
          <p className="text-[12.5px] leading-snug text-slate-300">{pose.description}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-slate-400">
            {pose.cues.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Section>
      )}
      {loadPoint && (
        <Section title={loadPoint === 'hands' ? 'Weight in the hands' : 'Bar on the back'}>
          <Slider label="Load" value={loadKg} min={0} max={160} step={2.5} unit=" kg" onChange={setLoadKg} />
        </Section>
      )}
      <Section title="Body linkage">
        <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-slate-300">
          <input type="checkbox" checked={compensate} onChange={(e) => setCompensate(e.target.checked)} className="mt-0.5 accent-sky-400" />
          <span>
            Let the body compensate for tight muscles (e.g. tight hamstrings round the lower back). Turn off to see the pose exactly as set.
          </span>
        </label>
      </Section>
    </>
  )
}

const JOINT_GROUPS: { title: string; joints: string[] }[] = [
  { title: 'Spine and head', joints: ['lumbar', 'thoracic', 'neck'] },
  { title: 'Left arm', joints: ['scapulaL', 'shoulderL', 'elbowL', 'wristL'] },
  { title: 'Right arm', joints: ['scapulaR', 'shoulderR', 'elbowR', 'wristR'] },
  { title: 'Left leg', joints: ['hipL', 'kneeL', 'ankleL'] },
  { title: 'Right leg', joints: ['hipR', 'kneeR', 'ankleR'] },
]

function JointsTab() {
  const target = useStore((s) => s.target)
  const actual = useStore((s) => s.analysis.sim.angles)
  const setAngle = useStore((s) => s.setAngle)
  const resetToPose = useStore((s) => s.resetToPose)
  const mirror = useStore((s) => s.mirrorLeftToRight)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const selectedJoint = useStore((s) => s.selectedJoint)
  const [open, setOpen] = useState<string>('Spine and head')
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Toggle label="3D joint handles" checked={view.gizmos} onChange={(v) => setView({ gizmos: v })} title="Click a joint in the 3D view, then drag its coloured rings" />
        <button onClick={resetToPose} className="rounded-md border border-slate-600 bg-slate-800/60 px-2 py-1 text-[12px] text-slate-300 hover:text-white">
          Reset to pose
        </button>
        <button onClick={mirror} className="rounded-md border border-slate-600 bg-slate-800/60 px-2 py-1 text-[12px] text-slate-300 hover:text-white">
          Copy left → right
        </button>
      </div>
      {view.gizmos && (
        <p className="mb-3 rounded-md bg-slate-800/80 p-2 text-[12px] text-slate-400">
          {selectedJoint ? (
            <>
              Dragging rings of <b className="text-slate-200">{JOINTS.find((j) => j.id === selectedJoint)?.label}</b>. Ring colours follow the slider order below.
            </>
          ) : (
            'Click a blue joint marker in the 3D view, then drag one of its rings.'
          )}
        </p>
      )}
      {JOINT_GROUPS.map((g) => {
        const isOpen = open === g.title || g.joints.includes(selectedJoint ?? '')
        return (
          <div key={g.title} className="mb-2 rounded-md border border-slate-700/70">
            <button onClick={() => setOpen(isOpen ? '' : g.title)} className="flex w-full items-center justify-between px-3 py-2 text-[12.5px] font-semibold text-slate-200">
              {g.title}
              <span className="text-slate-500">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && (
              <div className="border-t border-slate-700/70 px-3 pb-2 pt-1">
                {g.joints.map((jid) => {
                  const joint = JOINTS.find((j) => j.id === jid)!
                  return (
                    <div key={jid} className={`mb-1.5 ${selectedJoint === jid ? 'rounded bg-amber-300/10 px-1' : ''}`}>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{joint.label.replace(/^(Left|Right) /, '')}</div>
                      {DOFS.filter((d) => d.joint === jid).map((d) => (
                        <Slider
                          key={d.key}
                          label={d.label}
                          hint={`+ = ${d.positive}, − = ${d.negative}`}
                          value={target[d.key]}
                          actual={actual[d.key]}
                          min={d.min}
                          max={d.max}
                          onChange={(v) => setAngle(d.key, v)}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

function ProfileTab() {
  const profile = useStore((s) => s.profile)
  const preset = useStore((s) => s.profilePreset)
  const setFlexibility = useStore((s) => s.setFlexibility)
  const applyPreset = useStore((s) => s.applyProfilePreset)
  const setBodyMass = useStore((s) => s.setBodyMass)
  const setStrength = useStore((s) => s.setStrength)
  const setCondition = useStore((s) => s.setCondition)
  const muscleStrength = useStore((s) => s.profile.muscleStrength)
  const setMuscleStrength = useStore((s) => s.setMuscleStrength)
  const resetMuscleStrength = useStore((s) => s.resetMuscleStrength)
  const selectMuscle = useStore((s) => s.selectMuscle)
  const changedMuscles = Object.entries(muscleStrength).filter(([, v]) => v !== 1)
  const activeConditions = CONDITIONS.filter((c) => (profile.conditions[c.id] ?? 0) > 0).length
  return (
    <>
      <Section title="Start from">
        <div className="grid grid-cols-2 gap-1.5">
          {PROFILE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              title={p.description}
              className={`rounded-md border px-2 py-1.5 text-left text-[12px] ${preset === p.id ? 'border-sky-400 bg-sky-500/20 text-white' : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:text-white'}`}
            >
              <div className="font-semibold">{p.label}</div>
              <div className="text-[11px] leading-tight text-slate-400">{p.description}</div>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Body">
        <Slider label="Body mass" value={profile.bodyMass} min={40} max={130} unit=" kg" onChange={setBodyMass} />
        <div className="mt-1 flex gap-1.5">
          {(['untrained', 'average', 'trained'] as StrengthLevel[]).map((s) => (
            <Toggle key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} checked={profile.strength === s} onChange={() => setStrength(s)} />
          ))}
        </div>
      </Section>
      <Section
        title={`Conditions${activeConditions ? ` (${activeConditions} active)` : ''}`}
        right={
          activeConditions ? (
            <button onClick={() => CONDITIONS.forEach((c) => setCondition(c.id, 0))} className="text-[11px] text-sky-300 hover:text-sky-200">
              Clear all
            </button>
          ) : null
        }
      >
        <p className="mb-2 text-[12px] leading-snug text-slate-400">
          Postural conditions change your habitual posture in every pose and can weaken muscles. 0% = not present.
        </p>
        {CONDITIONS.map((c) => (
          <div key={c.id} className="mb-1">
            <Slider
              label={c.name}
              hint={`${c.summary} 100% = ${c.scale}.`}
              value={Math.round((profile.conditions[c.id] ?? 0) * 100)}
              min={0}
              max={100}
              step={5}
              unit="%"
              onChange={(v) => setCondition(c.id, v / 100)}
            />
            {(profile.conditions[c.id] ?? 0) > 0 && <p className="-mt-0.5 mb-1 text-[11px] leading-snug text-slate-500">{c.summary}</p>}
          </div>
        ))}
      </Section>
      <Section
        title={`Muscle strength${changedMuscles.length ? ` (${changedMuscles.length} changed)` : ''}`}
        right={
          changedMuscles.length ? (
            <button onClick={resetMuscleStrength} className="text-[11px] text-sky-300 hover:text-sky-200">
              Reset all
            </button>
          ) : null
        }
      >
        <p className="mb-2 text-[12px] leading-snug text-slate-400">
          Click any muscle and use its strength slider in the right panel to weaken it (injury, disuse) and see which muscles take over.
        </p>
        {changedMuscles.map(([key, v]) => (
          <div key={key} className="mb-1">
            <Slider
              label={
                <button className="text-left hover:text-white" onClick={() => selectMuscle(key)}>
                  {key.endsWith('L') ? 'Left' : 'Right'} {MUSCLE_BY_ID[key.split('.')[0]].name}
                </button>
              }
              value={Math.round(v * 100)}
              min={0}
              max={150}
              step={5}
              unit="%"
              marker={100}
              onChange={(x) => setMuscleStrength(key, Math.max(0.01, x / 100))}
            />
          </div>
        ))}
      </Section>
      <Section title="Flexibility tests">
        <p className="mb-2 text-[12px] leading-snug text-slate-400">
          Set the angle you reach in each test. The green tick is typical. Lower values shorten that muscle's comfortable range everywhere it is used.
        </p>
        {PROFILE_ITEMS.map((item) => (
          <div key={item.key} className="mb-1">
            <Slider
              label={
                <span>
                  {item.label} <span className="text-slate-500">· {item.muscles}</span>
                </span>
              }
              hint={item.help}
              value={profile.flexibility[item.key]}
              marker={item.normal}
              min={item.min}
              max={item.max}
              onChange={(v) => setFlexibility(item.key, v)}
            />
          </div>
        ))}
      </Section>
    </>
  )
}
