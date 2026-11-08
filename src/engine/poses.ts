import { expandSides, neutralAngles, clampAngles, type Angles } from './skeleton'

export type LoadPoint = 'hands' | 'upperBack'

export interface PoseDef {
  id: string
  name: string
  category: 'Standing' | 'Floor' | 'Stretch' | 'Side'
  description: string
  /** Joint angles in degrees. "?" in a key sets both sides. Unlisted DOFs are 0. */
  angles: Record<string, number>
  /** Landmarks touching the floor ("?" = both sides). */
  contacts: string[]
  /** Tilt the whole body so the contacts sit level on the floor. */
  autoLevel: boolean
  /** Also tilt sideways (roll) to level the contacts: wide or one-sided stances. */
  levelRoll?: boolean
  /** Whole-body orientation used when autoLevel is false. */
  root?: { pitch: number; roll: number }
  /** Default external load. */
  load?: { point: LoadPoint; kg: number }
  /** Standing pose: the centre of mass should stay over the feet. */
  balance?: boolean
  /** Hands holding feet (the arm supports the lower leg). */
  holds?: { hand: 'L' | 'R'; foot: 'L' | 'R' }[]
  cues: string[]
}

const feet = ['heel?', 'ball?']

export const POSES: PoseDef[] = [
  {
    id: 'standing', name: 'Standing', category: 'Standing', autoLevel: true, balance: true, contacts: feet,
    description: 'Relaxed upright standing, the reference posture for every muscle\'s resting length.',
    // A slight forward lean: in quiet standing the line of gravity falls a few cm in front of
    // the ankles, so the calves stay lightly active.
    angles: { 'ankle?.dorsiflexion': 2 },
    cues: ['Weight spread over the whole foot', 'Ribs stacked over the pelvis', 'The calves quietly stop you tipping forward'],
  },
  {
    id: 'squat', name: 'Bodyweight squat', category: 'Standing', autoLevel: true, balance: true, contacts: feet,
    description: 'Parallel squat with the arms reaching forward for balance.',
    angles: {
      'ankle?.dorsiflexion': 30, 'knee?.flexion': 115, 'hip?.flexion': 112, 'hip?.abduction': 14, 'hip?.rotation': -14,
      'lumbar.flexion': 5, 'thoracic.flexion': 5, 'neck.flexion': -15,
      'shoulder?.elevation': 85, 'shoulder?.plane': 90,
      'wrist?.pronation': 90, 'wrist?.flexion': 0, 'shoulder?.rotation': 0,
    },
    cues: ['Knees track over the toes', 'Sit between the heels, not behind them', 'Keep the lower back neutral'],
  },
  {
    id: 'deepSquat', name: 'Deep squat', category: 'Standing', autoLevel: true, balance: true, contacts: feet,
    description: 'Full-depth squat. Needs good ankle and hip mobility.',
    angles: {
      'ankle?.dorsiflexion': 37, 'knee?.flexion': 145, 'hip?.flexion': 122, 'hip?.abduction': 20, 'hip?.rotation': -20,
      'lumbar.flexion': 15, 'thoracic.flexion': 10, 'neck.flexion': -20,
      'shoulder?.elevation': 80, 'shoulder?.plane': 90,
      'wrist?.pronation': 90, 'wrist?.flexion': 0, 'shoulder?.rotation': 0,
    },
    cues: ['Heels stay down', 'Let the knees travel forward', 'A little rounding at the very bottom is normal'],
  },
  {
    id: 'squatValgus', name: 'Squat: knees caving in', category: 'Standing', autoLevel: true, balance: true, contacts: feet,
    description: 'A common fault: the knees collapse inward because the hips rotate in and drift together.',
    angles: {
      'ankle?.dorsiflexion': 28, 'ankle?.inversion': -12, 'knee?.flexion': 110, 'hip?.flexion': 108, 'hip?.abduction': -6, 'hip?.rotation': 22,
      'lumbar.flexion': 8, 'thoracic.flexion': 8, 'neck.flexion': -15,
      'shoulder?.elevation': 85, 'shoulder?.plane': 90,
      'wrist?.pronation': 90, 'wrist?.flexion': 0, 'shoulder?.rotation': 0,
    },
    cues: ['Push the knees out over the little toes', 'Strengthen gluteus medius'],
  },
  {
    id: 'backSquat', name: 'Barbell back squat', category: 'Standing', autoLevel: true, balance: true, contacts: feet,
    load: { point: 'upperBack', kg: 40 },
    description: 'Parallel squat with a bar on the upper back.',
    angles: {
      'ankle?.dorsiflexion': 28, 'knee?.flexion': 112, 'hip?.flexion': 118, 'hip?.abduction': 14, 'hip?.rotation': -14,
      'lumbar.flexion': 3, 'thoracic.flexion': 0, 'neck.flexion': -10,
      'shoulder?.elevation': 40, 'shoulder?.plane': 30, 'elbow?.flexion': 150,
      'scapula?.protraction': -15,
      'wrist?.pronation': 80, 'wrist?.flexion': 0, 'shoulder?.rotation': -90,
    },
    cues: ['Brace the trunk before descending', 'Bar over the middle of the foot'],
  },
  {
    id: 'deadlift', name: 'Deadlift (start)', category: 'Standing', autoLevel: true, balance: true, contacts: feet,
    load: { point: 'hands', kg: 60 },
    description: 'Lift-off position with a neutral spine: the hips hinge and the hamstrings and glutes load up.',
    angles: {
      'ankle?.dorsiflexion': 15, 'knee?.flexion': 65, 'hip?.flexion': 105, 'hip?.abduction': 5, 'hip?.rotation': -5,
      'lumbar.flexion': 0, 'thoracic.flexion': 8, 'neck.flexion': -20,
      'shoulder?.elevation': 62, 'shoulder?.plane': 90, 'scapula?.protraction': 5,
      'wrist?.pronation': 170, 'wrist?.flexion': 0, 'shoulder?.rotation': 0,
    },
    cues: ['Bar close to the shins', 'Chest proud, back flat', 'Push the floor away'],
  },
  {
    id: 'deadliftRounded', name: 'Deadlift: rounded back', category: 'Standing', autoLevel: true, balance: true, contacts: feet,
    load: { point: 'hands', kg: 60 },
    description: 'The same lift with the lower back rounding instead of the hips hinging.',
    angles: {
      'ankle?.dorsiflexion': 12, 'knee?.flexion': 45, 'hip?.flexion': 70, 'lumbar.flexion': 40, 'thoracic.flexion': 30, 'neck.flexion': -30,
      'shoulder?.elevation': 107, 'shoulder?.plane': 90, 'scapula?.protraction': 20,
      'wrist?.pronation': 170, 'wrist?.flexion': 0, 'shoulder?.rotation': 10,
    },
    cues: ['Hinge from the hips', 'Bend the knees a little more', 'Lower the weight if you cannot keep the back flat'],
  },
  {
    id: 'overheadPress', name: 'Overhead press (lockout)', category: 'Standing', autoLevel: true, balance: true, contacts: feet,
    load: { point: 'hands', kg: 30 },
    description: 'Bar locked out overhead. Tight lats or chest force the lower back to arch.',
    angles: {
      'shoulder?.elevation': 168, 'shoulder?.plane': 75, 'elbow?.flexion': 5,
      'scapula?.elevation': 15, 'neck.flexion': 5,
      'wrist?.pronation': 165, 'wrist?.flexion': -20, 'shoulder?.rotation': -10,
    },
    cues: ['Squeeze the glutes so the back does not arch', 'Head through the window at the top'],
  },
  {
    id: 'lunge', name: 'Low lunge (knee down)', category: 'Stretch', autoLevel: true, balance: false, contacts: ['heelL', 'ballL', 'tibialTuberosityR', 'toeTipR'],
    description: 'Left leg forward, right knee resting on the floor: a classic hip-flexor stretch for the back leg.',
    angles: {
      'hipL.flexion': 92, 'kneeL.flexion': 98, 'ankleL.dorsiflexion': 1.5,
      'hipR.flexion': -12, 'kneeR.flexion': 89, 'ankleR.dorsiflexion': -45,
      'lumbar.flexion': 12, 'thoracic.flexion': 20, 'shoulder?.elevation': 10,
    },
    cues: ['Front shin roughly vertical', 'Tuck the pelvis under to stretch the back hip flexors'],
  },
  {
    id: 'pushupTop', name: 'Push-up (top) / high plank', category: 'Floor', autoLevel: true, contacts: ['palm?', 'toeTip?'],
    description: 'Arms straight, body in one line from head to heels.',
    angles: {
      'shoulder?.elevation': 78, 'shoulder?.plane': 90, 'elbow?.flexion': 0,
      'ankle?.dorsiflexion': 5, 'neck.flexion': -10, 'scapula?.protraction': 10,
      'wrist?.pronation': 170, 'wrist?.flexion': -80, 'shoulder?.rotation': 0,
    },
    cues: ['Brace the abs so the hips do not sag', 'Push the floor away to spread the shoulder blades'],
  },
  {
    id: 'pushupBottom', name: 'Push-up (bottom)', category: 'Floor', autoLevel: true, contacts: ['palm?', 'toeTip?'],
    description: 'Chest just above the floor, elbows at about 45° from the body.',
    angles: {
      'shoulder?.elevation': 40, 'shoulder?.plane': 35, 'elbow?.flexion': 110,
      'ankle?.dorsiflexion': 5, 'neck.flexion': -10, 'scapula?.protraction': -25,
      'wrist?.pronation': 130, 'wrist?.flexion': -80, 'shoulder?.rotation': 20,
    },
    cues: ['Elbows about 45° from the body', 'Lower the body as one unit'],
  },
  {
    id: 'plank', name: 'Forearm plank', category: 'Floor', autoLevel: true, contacts: ['olecranon?', 'toeTip?'],
    description: 'Body held straight on the forearms and toes; the weight goes through the elbows.',
    angles: {
      'shoulder?.elevation': 89, 'shoulder?.plane': 90, 'elbow?.flexion': 80.5,
      'ankle?.dorsiflexion': 5, 'neck.flexion': -5,
      'wrist?.pronation': 170, 'wrist?.flexion': -5, 'shoulder?.rotation': 15,
    },
    cues: ['Squeeze the glutes and brace', 'Do not let the lower back sag'],
  },
  {
    id: 'gluteBridge', name: 'Glute bridge', category: 'Floor', autoLevel: true, contacts: ['upperBack', 'heel?', 'ball?'],
    description: 'Lying on the back with the hips lifted in line with the thighs.',
    angles: {
      'hip?.flexion': -8, 'knee?.flexion': 100, 'ankle?.dorsiflexion': -15, 'hip?.abduction': 6,
      'shoulder?.elevation': 15, 'shoulder?.plane': -90, 'neck.flexion': 25,
    },
    cues: ['Drive through the heels', 'Ribs down: lift with the glutes, not the lower back'],
  },
  {
    id: 'downwardDog', name: 'Downward dog', category: 'Stretch', autoLevel: true, contacts: ['palm?', 'ball?'],
    description: 'Yoga inverted V: stretches hamstrings, calves and shoulders.',
    angles: {
      'hip?.flexion': 112, 'knee?.flexion': 30, 'ankle?.dorsiflexion': 11.5, 'scapula?.elevation': 18.5,
      'shoulder?.elevation': 122.5, 'shoulder?.plane': 90, 'elbow?.flexion': 0,
      'lumbar.flexion': 0, 'thoracic.flexion': -5, 'neck.flexion': 5,
      'wrist?.pronation': 170, 'wrist?.flexion': -80, 'shoulder?.rotation': -15,
    },
    cues: ['Knees softly bent so the hamstrings let the hips lift', 'Press the chest toward the thighs', 'Straighten the legs only if the back stays long'],
  },
  {
    id: 'forwardFold', name: 'Standing forward fold', category: 'Stretch', autoLevel: true, balance: true, contacts: feet,
    description: 'Fold forward with straight knees. Hamstring tightness shows up as a rounded back.',
    angles: {
      'hip?.flexion': 105, 'knee?.flexion': 0, 'ankle?.dorsiflexion': -6, 'lumbar.flexion': 35, 'thoracic.flexion': 30, 'neck.flexion': 25,
      'shoulder?.elevation': 130, 'shoulder?.plane': 90,
    },
    cues: ['Hinge at the hips first', 'Soft knees are fine'],
  },
  {
    id: 'seatedFold', name: 'Seated forward bend', category: 'Stretch', autoLevel: true, contacts: ['ischialTuberosity?', 'heel?'],
    description: 'Sitting with straight legs reaching for the toes.',
    angles: {
      'hip?.flexion': 95, 'knee?.flexion': 0, 'ankle?.dorsiflexion': 5, 'lumbar.flexion': 35, 'thoracic.flexion': 30, 'neck.flexion': 20,
      'shoulder?.elevation': 5, 'shoulder?.plane': 90,
    },
    cues: ['Sit tall on the sit bones first', 'Reach with the chest, not the head'],
  },
  {
    id: 'quadStretch', name: 'Standing quad stretch', category: 'Stretch', autoLevel: true, balance: true, contacts: ['heelR', 'ballR'], holds: [{ hand: 'L', foot: 'L' }],
    description: 'Standing on the right leg, the left heel pulled toward the buttock.',
    angles: {
      'kneeL.flexion': 140, 'hipL.flexion': -8, 'ankleL.dorsiflexion': -30, 'hipR.abduction': -8, 'lumbar.lateral': 16, 'hipL.abduction': -1,
      'shoulderL.elevation': 50, 'shoulderL.plane': -90, 'shoulderL.rotation': 40, 'elbowL.flexion': 30, 'wristL.pronation': 120,
      'shoulderR.elevation': 90, 'shoulderR.plane': 20,
    },
    cues: ['Knees side by side', 'Tuck the pelvis to feel it at the front of the hip'],
  },
  {
    id: 'cobra', name: 'Cobra (back bend)', category: 'Stretch', autoLevel: true, contacts: ['pubicSymphysis', 'toeTip?', 'palm?'],
    description: 'Lying face down and pressing the chest up: lumbar extension.',
    angles: {
      'lumbar.flexion': -30, 'thoracic.flexion': -26, 'neck.flexion': -20,
      'hip?.flexion': -25, 'ankle?.dorsiflexion': -50,
      'shoulder?.elevation': 16, 'shoulder?.plane': 70, 'elbow?.flexion': 21,
      'wrist?.pronation': 170, 'wrist?.flexion': -78, 'shoulder?.rotation': 0,
    },
    cues: ['Keep the hips down', 'Stop where the lower back feels comfortable'],
  },
  // ---------------------------------------------------------------- Side stretches
  {
    id: 'sideBend', name: 'Standing side bend', category: 'Side', autoLevel: true, balance: true, contacts: feet,
    description: 'Reach the right arm over the head and bend to the left: stretches the right side of the trunk.',
    angles: {
      'hip?.abduction': 5, 'ankle?.inversion': -5,
      'lumbar.lateral': 22, 'thoracic.lateral': 24, 'neck.lateral': 8,
      'shoulderR.elevation': 165, 'shoulderR.plane': 10, 'shoulderR.rotation': -30, 'elbowR.flexion': 10, 'wristR.pronation': 90,
      'shoulderL.elevation': 10, 'wristL.pronation': 80,
    },
    cues: ['Lengthen up before you bend', 'Keep the hips over the feet and both feet heavy', 'Feel it from the hip to the armpit'],
  },
  {
    id: 'triangle', name: 'Triangle pose', category: 'Side', autoLevel: true, levelRoll: true, balance: true, contacts: feet,
    description: 'Wide stance, trunk tipped sideways over the left leg, right arm to the ceiling (simplified: no foot turn-out).',
    angles: {
      'hipL.abduction': 15, 'hipR.abduction': 50, 'hipL.flexion': 10, 'ankleL.inversion': 0, 'ankleR.inversion': 0,
      'lumbar.lateral': 18, 'thoracic.lateral': 18, 'neck.rotation': 30,
      'shoulderR.elevation': 90, 'shoulderR.plane': 0, 'shoulderL.elevation': 15, 'wristL.pronation': 80, 'wristR.pronation': 90,
    },
    cues: ['Long spine: tip from the hip, do not collapse the waist', 'Top arm in line with the bottom arm', 'Press the outer edge of the back foot down'],
  },
  {
    id: 'sideLunge', name: 'Side lunge (Cossack)', category: 'Side', autoLevel: true, levelRoll: true, balance: true, contacts: feet,
    description: 'Sit into the left leg with the right leg straight out to the side: stretches the right inner thigh.',
    angles: {
      'hipL.flexion': 80, 'hipL.abduction': 30, 'hipL.rotation': -20, 'kneeL.flexion': 110, 'ankleL.dorsiflexion': 30,
      'hipR.flexion': 20, 'hipR.abduction': 45, 'hipR.rotation': -20, 'kneeR.flexion': 0, 'ankleR.dorsiflexion': 5,
      'lumbar.flexion': 10, 'thoracic.flexion': 10, 'neck.flexion': -15,
      'shoulder?.elevation': 80, 'shoulder?.plane': 90, 'wrist?.pronation': 90,
    },
    cues: ['Keep the bent knee over the toes', 'Chest up, heel of the bent leg down', 'Straight-leg toes can point up'],
  },
  {
    id: 'gatePose', name: 'Gate pose (kneeling side stretch)', category: 'Side', autoLevel: true, levelRoll: true, contacts: ['tibialTuberosityR', 'toeTipR', 'heelL', 'ballL'],
    description: 'Kneel on the right knee, left leg out to the side, bend over the left leg with the right arm overhead.',
    angles: {
      'hipR.flexion': 0, 'kneeR.flexion': 98, 'ankleR.dorsiflexion': -45,
      'hipL.abduction': 51, 'hipL.flexion': -3, 'kneeL.flexion': 0, 'ankleL.dorsiflexion': 4, 'ankleL.inversion': -2,
      'lumbar.lateral': 20, 'thoracic.lateral': 20, 'neck.lateral': 5,
      'shoulderR.elevation': 160, 'shoulderR.plane': 10, 'shoulderR.rotation': -30, 'wristR.pronation': 90,
      'shoulderL.elevation': 30, 'wristL.pronation': 80, 'hipR.abduction': 18,
    },
    cues: ['Hips stacked over the kneeling knee', 'Reach long through the top arm', 'Breathe into the stretched side ribs'],
  },
  {
    id: 'neckSide', name: 'Neck side stretch', category: 'Side', autoLevel: true, balance: true, contacts: feet,
    description: 'Tip the left ear toward the left shoulder and let the right shoulder sink: stretches the right upper trapezius.',
    angles: { 'neck.lateral': 40, 'neck.flexion': 5, 'scapulaR.elevation': -10, 'wrist?.pronation': 80 },
    cues: ['Let the opposite shoulder drop', 'Keep the nose pointing forward', 'Gentle: no bouncing'],
  },
  {
    id: 'seatedTwist', name: 'Seated spinal twist', category: 'Side', autoLevel: true, contacts: ['ischialTuberosity?', 'heel?'],
    description: 'Sitting tall with straight legs, turning the trunk to the left: stretches the obliques and back rotators.',
    angles: {
      'hip?.flexion': 96, 'knee?.flexion': 0, 'ankle?.dorsiflexion': 13,
      'thoracic.rotation': 40, 'lumbar.rotation': 12, 'neck.rotation': 45, 'thoracic.flexion': 5,
      'shoulderL.elevation': 30, 'shoulderL.plane': -60, 'elbowL.flexion': 10,
      'shoulderR.elevation': 60, 'shoulderR.plane': 120, 'elbowR.flexion': 60, 'wrist?.pronation': 80, 'lumbar.flexion': 2,
    },
    cues: ['Grow tall first, then turn', 'Turn from the ribs, not the neck alone', 'Keep both sit bones down'],
  },
  // ---------------------------------------------------------------- Other stretches
  {
    id: 'butterfly', name: 'Butterfly stretch', category: 'Stretch', autoLevel: true, contacts: ['ischialTuberosity?', 'latMalleolus?'],
    description: 'Seated with the soles together and the knees falling out: stretches the inner thighs.',
    angles: {
      'hip?.flexion': 80, 'hip?.abduction': 47, 'hip?.rotation': -49, 'knee?.flexion': 117, 'ankle?.dorsiflexion': -15, 'ankle?.inversion': 20,
      'lumbar.flexion': 25, 'thoracic.flexion': 15, 'neck.flexion': 10,
      'shoulder?.elevation': 37, 'shoulder?.plane': 90, 'elbow?.flexion': 30, 'wrist?.pronation': 90,
    },
    cues: ['Sit tall on the sit bones', 'Let the knees drop, do not push them', 'Bring the heels closer for more stretch'],
  },
  {
    id: 'straddle', name: 'Seated straddle', category: 'Stretch', autoLevel: true, contacts: ['ischialTuberosity?', 'heel?'],
    description: 'Sitting with the legs straight and wide, folding forward: stretches the inner thighs and hamstrings.',
    angles: {
      'hip?.flexion': 93, 'hip?.abduction': 38, 'hip?.rotation': -15, 'knee?.flexion': 0, 'ankle?.dorsiflexion': 3,
      'lumbar.flexion': 18, 'thoracic.flexion': 13, 'neck.flexion': 10,
      'shoulder?.elevation': 70, 'shoulder?.plane': 70, 'wrist?.pronation': 150, 'wrist?.flexion': -40,
    },
    cues: ['Kneecaps point to the ceiling', 'Hinge from the hips with a long back', 'Walk the hands forward only as far as the back stays long'],
  },
  {
    id: 'childsPose', name: "Child's pose", category: 'Stretch', autoLevel: true, contacts: ['tibialTuberosity?', 'toeTip?', 'palm?', 'forehead'],
    description: 'Sitting back on the heels with the arms reaching forward on the floor: stretches the back and lats.',
    angles: {
      'hip?.flexion': 131, 'knee?.flexion': 150, 'ankle?.dorsiflexion': -45, 'hip?.abduction': 10,
      'lumbar.flexion': 15, 'thoracic.flexion': 17, 'neck.flexion': 27,
      'shoulder?.elevation': 173, 'shoulder?.plane': 90, 'elbow?.flexion': 0, 'wrist?.pronation': 170, 'wrist?.flexion': -38,
    },
    cues: ['Sink the hips toward the heels', 'Walk the hands forward to feel the lats', 'Breathe into the back'],
  },
  {
    id: 'chestOpener', name: 'Chest opener (hands behind back)', category: 'Stretch', autoLevel: true, balance: true, contacts: feet,
    description: 'Hands clasped behind the back, arms drawn back and down: stretches the chest and front shoulders.',
    angles: {
      'shoulder?.elevation': 35, 'shoulder?.plane': -80, 'shoulder?.rotation': -20, 'elbow?.flexion': 0, 'wrist?.pronation': 60,
      'scapula?.protraction': -20, 'scapula?.elevation': -5, 'thoracic.flexion': -8, 'neck.flexion': -5,
    },
    cues: ['Squeeze the shoulder blades together', 'Lift the chest, do not arch the lower back', 'Lift the hands away from the back'],
  },
  {
    id: 'tricepsStretch', name: 'Overhead triceps stretch', category: 'Stretch', autoLevel: true, balance: true, contacts: feet,
    description: 'Right hand reaches down the back with the elbow pointing up: stretches the right triceps.',
    angles: {
      'shoulderR.elevation': 165, 'shoulderR.plane': 60, 'shoulderR.rotation': -40, 'elbowR.flexion': 145, 'wristR.pronation': 60,
      'shoulderL.elevation': 140, 'shoulderL.plane': 100, 'elbowL.flexion': 110, 'wristL.pronation': 60,
    },
    cues: ['Elbow points straight up', 'Keep the head upright', 'The other hand gently draws the elbow back'],
  },
  {
    id: 'calfStretch', name: 'Wall calf stretch', category: 'Stretch', autoLevel: true, balance: true, contacts: feet,
    description: 'Left leg forward and bent, right leg back and straight with the heel down: stretches the right calf.',
    angles: {
      'hipL.flexion': 30, 'kneeL.flexion': 35, 'ankleL.dorsiflexion': 15,
      'hipR.flexion': -15, 'kneeR.flexion': 0, 'ankleR.dorsiflexion': 15,
      'shoulder?.elevation': 85, 'shoulder?.plane': 90, 'elbow?.flexion': 20, 'wrist?.pronation': 90,
    },
    cues: ['Back heel stays on the floor', 'Back knee straight for the gastrocnemius; bend it for the soleus', 'Toes point forward'],
  },
]

export const POSE_BY_ID: Record<string, PoseDef> = Object.fromEntries(POSES.map((p) => [p.id, p]))

export function poseAngles(pose: PoseDef): Angles {
  const a = neutralAngles()
  for (const [k, v] of Object.entries(pose.angles)) for (const key of expandSides(k)) a[key] = v
  return clampAngles(a)
}

export function poseContacts(pose: PoseDef): string[] {
  return pose.contacts.flatMap((c) => expandSides(c))
}
