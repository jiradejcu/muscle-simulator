# Muscle Simulator: Project Plan

An educational desktop web app that shows what human muscles do in common exercise poses:
which muscles contract, which stretch, how much tension they carry, and why a pose
can hurt or feel stiff. Users can pick a preset pose or move any joint by hand.

> This is an educational model, not a medical tool. Its explanations come from simplified
> rules about stretch, load and joint position. It does not simulate real tissue.

## Decisions so far

| Topic | Decision |
|---|---|
| Visual style | **Anatomical**: shaped muscle bellies, tendons and real bone shapes, in 3D |
| Body coverage | **Full body**. The spine, pelvis and legs are linked, e.g. tight hamstrings tilt the pelvis back and round the lower back |
| Personalization | Yes. Settings such as "tight hamstrings" or "limited ankle dorsiflexion" change each muscle's comfortable range |
| Platform | Desktop browser, English UI. Mobile is out of scope |
| Development | Run locally on the user's machine |

## Tech stack

- **TypeScript + Vite** for the build and dev server
- **React** for the UI panels
- **Three.js through React Three Fiber, with `@react-three/drei`** for the 3D scene, camera controls and joint-drag gizmos
- **Zustand** for state: joint angles, the selected pose, the selected muscle and personal settings
- **Vitest** for unit tests of the biomechanics engine
- **Tailwind CSS** for styling

## How the anatomical look works

Good rigged full-body muscle models are rare, so the plan uses a hybrid:

1. **Bones** are real meshes taken from an open anatomy dataset such as
   [Z-Anatomy](https://www.z-anatomy.com/) or BodyParts3D (both CC BY-SA, so attribution is
   required and modified assets must be shared under the same license). Bones are rigid, so
   each one simply follows its body segment and no skinning is needed.
2. **Muscles** are generated in code. Each muscle is a smooth tube built along a curve from its
   origin to its insertion, passing through wrap points so it bends around joints. The tube is
   thick in the middle and thin at the tendon ends, with a fibre texture and pale tendons. It
   stretches and thickens exactly as the biomechanics engine says, so the picture always
   matches the numbers.
3. **Heat overlay**: an optional tint from blue (relaxed) through green and orange to red
   (working hard or stretched hard), blended over the muscle colour.
4. **Later option**: swap in sculpted muscle meshes from the anatomy dataset and bend them
   along the same curves. The engine stays the same.

## Biomechanics engine (`src/engine`, pure TypeScript functions)

- **Skeleton**: about 20 joints, including pelvis, lumbar, thoracic, neck, shoulders, elbows,
  wrists, hips, knees and ankles. Each joint has realistic angle limits.
- **Muscles**: about 30 muscle groups, each defined by origin, insertion and wrap points on the
  bones. Examples: quadriceps, hamstrings, glutes, hip flexors, adductors, calves, tibialis,
  erector spinae, abdominals and obliques, lats, pecs, deltoids, rotator cuff, traps, biceps
  and triceps.
- **Per-muscle metrics**:
  - *Stretch*: current length ÷ resting length, compared with the comfortable maximum
    (lowered by personal settings)
  - *Active load*: torque from gravity on body segments ÷ the muscle's moment arm
  - *Tension*: active load plus passive stretch, shown as the heat colour
- **Warnings**: end-of-range joints, rounded lower back under load, knees caving inward,
  shoulder impingement angles, hyperextension
- **Explanations**: plain-language text for each muscle, e.g. "Hamstrings at 118% of
  resting length because the hip is bent 95° with the knee straight"

## Features

1. Preset poses: squat, deadlift, plank, push-up, lunge, downward dog, forward fold, overhead
   press, glute bridge and more. Moving between poses is animated.
2. Manual joint control: drag gizmos in 3D, or use per-joint sliders.
3. Click a muscle to see its stretch, load and explanation.
4. A personal profile panel for tightness and mobility limits.
5. Toggles for the heat overlay, showing or hiding layers (skin, superficial muscles, deep
   muscles, bones) and labels.

## Milestones

1. Scaffold the project with Vite, React and React Three Fiber, plus a lint and test setup
2. Skeleton engine: joints and forward kinematics, with unit tests
3. Bone meshes loaded and attached to segments, plus a temporary procedural fallback
4. Procedural anatomical muscles: lofted tubes, tendons and fibre material
5. Muscle metrics, heat overlay and the selected-muscle panel
6. Preset poses and animated transitions
7. Manual joint gizmos and sliders
8. Personal profile settings
9. Warnings and explanation text, then polish
