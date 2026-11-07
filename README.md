# Muscle Simulator

An educational desktop web app that shows what human muscles do in common exercise poses:
which muscles contract, which stretch, how much tension they carry, and why a pose can hurt
or feel stiff. Pick a preset pose or move any joint by hand, then click a muscle to read a
plain-language explanation.

> Educational model, not a medical tool. Explanations come from simplified rules about
> stretch, load and joint position. It does not simulate real tissue.

## Running it

Requires Node.js 20 or later.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (Vitest)
npm run lint
npm run build      # type-check + production build into dist/
```

## Using it

- **Poses tab**: 18 presets (squats, deadlifts, push-ups, plank, lunge, yoga poses, stretches).
  Changing pose animates. Loaded poses have a weight slider. "Body linkage" lets tight
  muscles push the movement into neighbouring joints.
- **Joints tab**: a slider for every degree of freedom (37 in total). When the body
  compensates, the value it actually uses is shown in amber next to your setting.
  Turn on **Joint handles** to click a joint in 3D and drag its coloured rings.
- **My body tab**: flexibility given as clinical test angles (straight-leg raise, Thomas test,
  knee-to-wall, ...), body mass, strength level and **postural conditions** (scoliosis,
  hyperkyphosis, hyperlordosis / anterior pelvic tilt, flat back, forward head, rounded
  shoulders, knock knees, bow legs, flat feet, knee hyperextension, weak glutes, weak core),
  each with a severity slider.
- **Weak muscles**: select any muscle and drag its *Strength* slider (this side, or both
  sides). A muscle can never exceed 100 % of its strength, so its work passes to the other
  muscles that can help; if they also run out, the joint is flagged as "cannot hold" (ligaments
  would be strained). *Who takes over* lists the muscles working harder or less than at normal
  strength, and the toolbar's *Change vs normal strength* colours the body the same way.
- **3D view toolbar**: heat overlay, superficial/deep muscle layers, bones, labels,
  forces (floor reaction, load, centre of mass) and joint handles.
- **Right panel**: the selected muscle's length, stretch against your comfortable range,
  effort, tension and an explanation, plus warnings and the most demanding muscles.

## How the model works (`src/engine`, pure TypeScript)

| Step | File | What it does |
|---|---|---|
| Skeleton | `skeleton.ts` | 18 segments, 17 joints, 39 DOFs with limits (including forearm rotation). Y up, Z forward, X to the body's left, metres. |
| Kinematics | `kinematics.ts` | Forward kinematics; every segment maps rest-world points to the current pose. |
| Muscles | `muscles.ts`, `landmarks.ts`, `musclePath.ts` | 33 muscle groups per side (120 strands). Paths run through bony landmarks and wrap around joint cylinders with a fixed winding, so moment arms stay continuous. |
| Comfortable range | `model.ts`, `profile.ts` | Comfortable length comes from a library of normal full-range positions. The person's test angles scale it. |
| Placement | `statics.ts` | Tilts the body so the pose's contact points sit level on the floor, then grounds it. |
| Statics | `simulate.ts` | Gravity and external load give the torque needed at each joint (virtual work by finite differences). One optimisation (active-set QP in `linalg.ts`) chooses muscle forces, floor forces at every contact (push plus moderately priced friction), hand-holds-foot tension and small joint "reserve" torques together, minimising summed squared activation subject to joint and whole-body balance. So the body puts its weight where that costs the least effort. Passive stretch forces are included. |
| Linkage | `compensation.ts` | Rules such as "tight hamstrings → less hip flexion, more lumbar flexion"; a balance step keeps the centre of mass over the feet. |
| Conditions | `conditions.ts` | Postural offsets and muscle weakness scaled by severity. |
| Warnings | `warnings.ts` | Rounded back under load, hyperextension, knee valgus, shoulder impingement, end of range, over-stretch, overload, balance. |
| Explanations | `explain.ts` | Which joints lengthen each muscle (in mm), what it is working against, how it feels. |

Per-muscle metrics:

- **Length** is current length ÷ length when standing.
- **Stretch** is 0 when slack and 100% at the comfortable maximum for your profile.
- **Effort** is active force ÷ estimated strength.
- **Tension** is active plus passive force.

The heat colour shows the larger of effort and felt stretch.

## Anatomical look

Bones are generated in code (`src/scene/boneGeometry.ts`): vertebrae, ribs, pelvis, long
bones, hands and feet, placed on the same landmarks the muscles use. Muscles are lofted tubes
with fusiform bellies and pale tendons (`muscleTube.ts`). They thin as they stretch, bulge
slightly when active, and carry a fibre texture.

**Real bone meshes**: drop GLB files (rest-world metres, same frame as `skeleton.ts`) into
`public/models/bones/` and list them in `public/models/bones/manifest.json`, for example
`{ "thighL": "femur_left.glb" }`. Segments without a file keep the procedural bone. Datasets
such as Z-Anatomy or BodyParts3D are CC BY-SA, so attribution is required and modified
assets must be shared under the same licence.

## Checking the poses

`npm run audit` prints every preset's hand orientation, top muscle efforts, stretches,
warnings and key joint torques (`POSES=pushupBottom,plank npm run audit` for a subset).

## Known simplifications

- Two spinal joints (lumbar and thoracic) plus the neck, so scoliosis is a single sideways bend
  with twist, not a curve spread over many vertebrae.
- No scapulohumeral rhythm. The shoulder blade only moves when its sliders are set.
- Only static poses: no inertia, no force–length–velocity curves for active muscle.
- Muscle sharing follows the minimum-effort rule. Deliberate cues such as "squeeze the glutes"
  are not predicted, so in a glute bridge the model lets the hamstrings carry the small hip
  load.
- Friction is a soft cost rather than a strict friction cone, and push-up pec activity is
  probably underestimated (real hands also push outward).
- Muscle strengths and paths are rounded literature values for one average 1.75 m adult.
