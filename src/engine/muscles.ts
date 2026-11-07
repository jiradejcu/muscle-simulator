import type { PathNode } from './musclePath'
import type { TestId } from './profile'
import type { Side } from './skeleton'

export type Layer = 'superficial' | 'deep'
export type Region = 'Legs' | 'Hips' | 'Trunk' | 'Shoulders' | 'Arms' | 'Neck'

export interface StrandDef {
  name: string
  path: PathNode[]
  /** Maximum isometric force (N) for an average adult. */
  fmax: number
  /** Belly radius in metres at resting length. */
  radius: number
  /** Tendon length at each end as a fraction of resting length. */
  tendon: [number, number]
  test?: TestId
}

export interface MuscleDef {
  id: string
  name: string
  region: Region
  layer: Layer
  description: string
  /** What the muscle does, in plain words. */
  actions: string
  test: TestId
  strands: StrandDef[]
}

const hipWrap = (r = 0.06): PathNode => ({ centre: 'hipWrapCentre?', radius: r, keep: [0, -0.7, -0.7] })
const kneeBackWrap: PathNode = { centre: 'kneeWrapCentre?', radius: 0.036, keep: [0, 0, -1] }
const hipFrontWrap: PathNode = { centre: 'hipWrapCentre?', radius: 0.033, keep: [0, 0.3, 1] }
const kneeWrap: PathNode = { centre: 'kneeWrapCentre?', radius: 0.05, keep: [0, 0, 1] }
const elbowWrap: PathNode = { centre: 'elbowWrapCentre?', radius: 0.024, keep: [0, 0, -1] }
/** Keeps the elbow flexors in front of the joint even when the elbow is fully bent. */
const elbowFrontWrap: PathNode = { centre: 'elbowWrapCentre?', radius: 0.022, keep: [0, 0, 1] }
const headWrap = (keep: [number, number, number], axis: [number, number, number]): PathNode => ({ centre: 'shoulderWrapCentre?', radius: 0.03, keep, axis })

export const MUSCLES: MuscleDef[] = [
  // ------------------------------------------------------------------ Hips
  {
    id: 'gluteusMaximus', name: 'Gluteus maximus', region: 'Hips', layer: 'superficial', test: 'kneeToChest',
    description: 'The large muscle of the buttock and the most powerful hip extensor in the body.',
    actions: 'Extends the hip (stands you up from a squat), rotates the thigh outward.',
    strands: [
      { name: 'upper fibres', path: ['gluteMaxIlium?', hipWrap(), 'greaterTrochanter?'], fmax: 500, radius: 0.028, tendon: [0.04, 0.12] },
      { name: 'middle fibres', path: ['sacrumLat?', hipWrap(), 'glutealTuberosity?'], fmax: 550, radius: 0.032, tendon: [0.04, 0.1] },
      { name: 'lower fibres', path: ['coccyxLat?', hipWrap(0.055), 'glutealTuberosity?'], fmax: 550, radius: 0.03, tendon: [0.04, 0.1] },
    ],
  },
  {
    id: 'gluteusMedius', name: 'Gluteus medius', region: 'Hips', layer: 'superficial', test: 'hipAbductorStretch',
    description: 'Fan-shaped muscle on the side of the hip.',
    actions: 'Abducts the hip and keeps the pelvis level when standing on one leg; stops the knee caving in.',
    strands: [
      { name: 'posterior fibres', path: ['gluteMedOrigin?', 'greaterTrochanter?'], fmax: 600, radius: 0.024, tendon: [0.03, 0.15] },
      { name: 'anterior fibres', path: ['gluteMedOriginAnt?', 'greaterTrochanter?'], fmax: 600, radius: 0.022, tendon: [0.03, 0.15] },
    ],
  },
  {
    id: 'iliopsoas', name: 'Iliopsoas (hip flexors)', region: 'Hips', layer: 'deep', test: 'hipExtension',
    description: 'Psoas runs from the lumbar spine and iliacus from the inside of the pelvis to the inner thigh bone.',
    actions: 'Flexes the hip (lifts the knee); the psoas also pulls the lower back forward.',
    strands: [
      { name: 'psoas major', path: ['psoasOrigin?', 'psoasVia?', hipFrontWrap, 'lesserTrochanter?'], fmax: 550, radius: 0.02, tendon: [0.05, 0.12] },
      { name: 'iliacus', path: ['iliacFossa?', 'psoasVia?', hipFrontWrap, 'lesserTrochanter?'], fmax: 500, radius: 0.02, tendon: [0.03, 0.12] },
    ],
  },
  {
    id: 'tensorFasciaeLatae', name: 'Tensor fasciae latae & IT band', region: 'Hips', layer: 'superficial', test: 'hipExtension',
    description: 'Small muscle at the front of the hip that pulls on the long iliotibial (IT) band.',
    actions: 'Flexes, abducts and internally rotates the hip; steadies the outside of the knee.',
    strands: [{ name: 'TFL', path: ['asis?', 'greaterTrochanter?', 'itBandMid?', 'gerdyTubercle?'], fmax: 300, radius: 0.013, tendon: [0.03, 0.62] }],
  },
  {
    id: 'piriformis', name: 'Piriformis (deep rotators)', region: 'Hips', layer: 'deep', test: 'hipCrossBody',
    description: 'Deep muscle under the glutes, close to the sciatic nerve.',
    actions: 'Rotates the thigh outward and steadies the hip joint.',
    strands: [{ name: 'piriformis', path: ['piriformisOrigin?', 'greaterTrochanter?'], fmax: 400, radius: 0.013, tendon: [0.05, 0.2] }],
  },
  {
    id: 'adductors', name: 'Adductors', region: 'Hips', layer: 'superficial', test: 'hipAbduction',
    description: 'Group on the inner thigh: adductor longus, brevis and magnus.',
    actions: 'Pull the legs together; adductor magnus also helps extend the hip at the bottom of a squat.',
    strands: [
      { name: 'adductor longus', path: ['pubicTubercle?', 'lineaAsperaMid?'], fmax: 600, radius: 0.02, tendon: [0.05, 0.08] },
      { name: 'adductor brevis', path: ['pubicRamus?', 'lineaAsperaUpper?'], fmax: 500, radius: 0.018, tendon: [0.05, 0.08] },
      { name: 'adductor magnus', path: ['ischialTuberosity?', 'adductorTubercle?'], fmax: 900, radius: 0.026, tendon: [0.04, 0.12] },
    ],
  },
  // ------------------------------------------------------------------ Legs
  {
    id: 'rectusFemoris', name: 'Rectus femoris', region: 'Legs', layer: 'superficial', test: 'rectusFemoris',
    description: 'The quadriceps head that crosses both the hip and the knee.',
    actions: 'Straightens the knee and flexes the hip.',
    strands: [{ name: 'rectus femoris', path: ['aiis?', 'quadDistal?', kneeWrap, 'tibialTuberosity?'], fmax: 1100, radius: 0.024, tendon: [0.08, 0.16] }],
  },
  {
    id: 'vasti', name: 'Vasti (quadriceps)', region: 'Legs', layer: 'superficial', test: 'kneeFlexion',
    description: 'Vastus lateralis, medialis and intermedius, the bulk of the front thigh.',
    actions: 'Straighten the knee; they do most of the work rising out of a squat or lunge.',
    strands: [
      { name: 'vastus lateralis', path: ['vastusLatOrigin?', 'itBandMid?', 'quadDistal?', kneeWrap, 'tibialTuberosity?'], fmax: 2000, radius: 0.03, tendon: [0.03, 0.14] },
      { name: 'vastus intermedius', path: ['vastusIntOrigin?', 'quadDistal?', kneeWrap, 'tibialTuberosity?'], fmax: 1100, radius: 0.024, tendon: [0.03, 0.14] },
      { name: 'vastus medialis', path: ['vastusMedOrigin?', 'quadDistal?', kneeWrap, 'tibialTuberosity?'], fmax: 1500, radius: 0.028, tendon: [0.03, 0.12] },
    ],
  },
  {
    id: 'hamstrings', name: 'Hamstrings', region: 'Legs', layer: 'superficial', test: 'slr',
    description: 'Biceps femoris, semitendinosus and semimembranosus on the back of the thigh.',
    actions: 'Extend the hip and bend the knee. They cross both joints, so they are stretched most with the hip bent and the knee straight.',
    strands: [
      { name: 'biceps femoris', path: ['ischialTuberosity?', kneeBackWrap, 'fibularHead?'], fmax: 1200, radius: 0.026, tendon: [0.12, 0.12] },
      { name: 'semitendinosus / semimembranosus', path: ['ischialTuberosity?', kneeBackWrap, 'tibiaMedCondylePost?'], fmax: 1300, radius: 0.026, tendon: [0.12, 0.14] },
    ],
  },
  {
    id: 'gastrocnemius', name: 'Gastrocnemius', region: 'Legs', layer: 'superficial', test: 'dfKneeStraight',
    description: 'The two-headed calf muscle that crosses the knee and the ankle.',
    actions: 'Points the foot and helps bend the knee. Stretched most with the knee straight and the ankle bent.',
    strands: [
      { name: 'lateral head', path: ['gastrocLatOrigin?', kneeBackWrap, 'achillesVia?', 'calcaneusTuber?'], fmax: 800, radius: 0.024, tendon: [0.05, 0.42] },
      { name: 'medial head', path: ['gastrocMedOrigin?', kneeBackWrap, 'achillesVia?', 'calcaneusTuber?'], fmax: 1100, radius: 0.027, tendon: [0.05, 0.38] },
    ],
  },
  {
    id: 'soleus', name: 'Soleus', region: 'Legs', layer: 'deep', test: 'dfKneeBent',
    description: 'Broad calf muscle under the gastrocnemius; it only crosses the ankle.',
    actions: 'Points the foot and controls how far the shin can tip forward over the foot (squats, lunges).',
    strands: [
      { name: 'lateral', path: ['soleusOrigin?', 'achillesVia?', 'calcaneusTuber?'], fmax: 1500, radius: 0.022, tendon: [0.03, 0.3] },
      { name: 'medial', path: ['soleusOriginMed?', 'achillesVia?', 'calcaneusTuber?'], fmax: 1500, radius: 0.022, tendon: [0.03, 0.3] },
    ],
  },
  {
    id: 'tibialisAnterior', name: 'Tibialis anterior', region: 'Legs', layer: 'superficial', test: 'plantarflexion',
    description: 'Muscle along the front of the shin.',
    actions: 'Lifts the toes (dorsiflexion) and pulls the body forward over the foot.',
    strands: [{ name: 'tibialis anterior', path: ['tibialisAntOrigin?', 'ankleFrontVia?', 'medialCuneiform?'], fmax: 900, radius: 0.016, tendon: [0.04, 0.36] }],
  },
  // ------------------------------------------------------------------ Trunk
  {
    id: 'erectorSpinae', name: 'Erector spinae', region: 'Trunk', layer: 'superficial', test: 'spineFlexion',
    description: 'Long columns of muscle either side of the spine (longissimus and iliocostalis).',
    actions: 'Extend the spine and hold the trunk up when you lean forward.',
    strands: [
      { name: 'longissimus', path: ['sacrumLat?', 'lumbarErectorVia?', 'thoracicErectorVia?', 'thoracicTransverse?'], fmax: 1900, radius: 0.022, tendon: [0.06, 0.06] },
      { name: 'iliocostalis', path: ['iliacCrestPost?', 'lumbarErectorViaLat?', 'ribAngleLower?', 'ribAngleUpper?'], fmax: 1700, radius: 0.02, tendon: [0.06, 0.06] },
    ],
  },
  {
    id: 'multifidus', name: 'Multifidus', region: 'Trunk', layer: 'deep', test: 'spineFlexion',
    description: 'Short deep muscles that stiffen each segment of the lower spine.',
    actions: 'Stabilise and extend the lumbar spine.',
    strands: [{ name: 'multifidus', path: ['psis?', 'lumbarMultifidus?', 'l1Spinous'], fmax: 1100, radius: 0.014, tendon: [0.05, 0.05] }],
  },
  {
    id: 'quadratusLumborum', name: 'Quadratus lumborum', region: 'Trunk', layer: 'deep', test: 'sideBend',
    description: 'Deep square muscle between the pelvis, the lowest rib and the lumbar spine.',
    actions: 'Side-bends the spine and hitches the hip up; stiffens the lower back.',
    strands: [{ name: 'QL', path: ['iliacCrestPost?', 'qlVia?', 'rib12Post?'], fmax: 500, radius: 0.016, tendon: [0.05, 0.05] }],
  },
  {
    id: 'rectusAbdominis', name: 'Rectus abdominis', region: 'Trunk', layer: 'superficial', test: 'spineExtension',
    description: 'The "six-pack" muscle running from the pubic bone to the ribs.',
    actions: 'Flexes the trunk and resists the lower back sagging (planks, push-ups).',
    strands: [{ name: 'rectus abdominis', path: ['pubicTubercle?', 'rectusAbdLumbarVia?', 'rib5Front?'], fmax: 600, radius: 0.02, tendon: [0.03, 0.03] }],
  },
  {
    id: 'externalOblique', name: 'External oblique', region: 'Trunk', layer: 'superficial', test: 'sideBend',
    description: 'Outer abdominal wall, fibres running down and inward.',
    actions: 'Rotates and side-bends the trunk, flexes the spine, braces the abdomen.',
    strands: [
      { name: 'upper fibres', path: ['ribsLatMid?', 'obliqueLumbarVia?', 'pubicTubercle?'], fmax: 450, radius: 0.016, tendon: [0.03, 0.12] },
      { name: 'lateral fibres', path: ['lowerRibsLat?', 'iliacCrestAnt?'], fmax: 450, radius: 0.016, tendon: [0.03, 0.06] },
    ],
  },
  {
    id: 'internalOblique', name: 'Internal oblique', region: 'Trunk', layer: 'deep', test: 'sideBend',
    description: 'Middle layer of the abdominal wall, fibres running up and inward.',
    actions: 'Rotates and side-bends the trunk, braces the abdomen.',
    strands: [{ name: 'internal oblique', path: ['iliacCrestLat?', 'intObliqueLumbarVia?', 'costalMargin?'], fmax: 800, radius: 0.015, tendon: [0.04, 0.06] }],
  },
  // ------------------------------------------------------------------ Shoulders
  {
    id: 'latissimusDorsi', name: 'Latissimus dorsi', region: 'Shoulders', layer: 'superficial', test: 'shoulderFlexion',
    description: 'The broad back muscle running from the spine and pelvis to the upper arm.',
    actions: 'Pulls the arm down and back, rotates it inward; limits reaching overhead when tight.',
    strands: [
      { name: 'upper fibres', path: ['latThoracicOrigin?', 'latWrapUpper?', 'latInsertion?'], fmax: 350, radius: 0.02, tendon: [0.03, 0.12] },
      { name: 'middle fibres', path: ['thoracolumbarFascia?', 'latLowerRibs?', 'latWrapUpper?', 'latInsertion?'], fmax: 350, radius: 0.02, tendon: [0.08, 0.1] },
      { name: 'lower fibres', path: ['iliacCrestPost?', 'latLowerRibs?', 'latInsertion?'], fmax: 300, radius: 0.019, tendon: [0.06, 0.1] },
    ],
  },
  {
    id: 'pectoralisMajor', name: 'Pectoralis major', region: 'Shoulders', layer: 'superficial', test: 'chestOpener',
    description: 'The large chest muscle from the collarbone and breastbone to the upper arm.',
    actions: 'Pushes the arm forward and across the body (push-ups), rotates it inward.',
    strands: [
      { name: 'clavicular head', path: ['clavicleMid?', 'pecInsertion?'], fmax: 400, radius: 0.02, tendon: [0.02, 0.14] },
      { name: 'sternal head', path: ['sternumMid?', 'pecInsertion?'], fmax: 450, radius: 0.023, tendon: [0.02, 0.12] },
      { name: 'abdominal head', path: ['costalMargin?', 'sternumLow?', 'pecInsertion?'], fmax: 300, radius: 0.019, tendon: [0.02, 0.12] },
    ],
  },
  {
    id: 'pectoralisMinor', name: 'Pectoralis minor', region: 'Shoulders', layer: 'deep', test: 'scapulaRetraction',
    description: 'Small muscle under the pecs from the ribs to the front of the shoulder blade.',
    actions: 'Tips the shoulder blade forward; when tight it rounds the shoulders.',
    strands: [{ name: 'pec minor', path: ['rib5Front?', 'coracoid?'], fmax: 250, radius: 0.012, tendon: [0.03, 0.1] }],
  },
  {
    id: 'deltoid', name: 'Deltoid', region: 'Shoulders', layer: 'superficial', test: 'crossBody',
    description: 'The rounded cap of the shoulder with front, side and rear parts.',
    actions: 'Raises the arm forward (front), sideways (side) and backward (rear).',
    strands: [
      { name: 'anterior', path: ['clavicleLateral?', 'deltoidTuberosity?'], fmax: 600, radius: 0.021, tendon: [0.03, 0.1], test: 'chestOpener' },
      { name: 'lateral', path: ['acromion?', 'deltoidTuberosity?'], fmax: 900, radius: 0.024, tendon: [0.03, 0.1], test: 'shoulderAdduction' },
      { name: 'posterior', path: ['scapulaSpine?', 'deltoidTuberosity?'], fmax: 500, radius: 0.02, tendon: [0.03, 0.1], test: 'crossBody' },
    ],
  },
  {
    id: 'rotatorCuff', name: 'Rotator cuff', region: 'Shoulders', layer: 'deep', test: 'internalRotation',
    description: 'Supraspinatus, infraspinatus, teres minor and subscapularis wrapped around the ball of the shoulder.',
    actions: 'Hold the ball of the humerus centred in its socket and rotate the arm.',
    strands: [
      { name: 'supraspinatus', path: ['supraspinousFossa?', headWrap([0, 1, 0], [0, 0, 1]), 'greaterTubercleTop?'], fmax: 400, radius: 0.014, tendon: [0.03, 0.2], test: 'shoulderAdduction' },
      { name: 'infraspinatus / teres minor', path: ['infraspinousFossa?', headWrap([0, 0, -1], [0, 1, 0]), 'greaterTuberclePost?'], fmax: 600, radius: 0.018, tendon: [0.03, 0.18], test: 'internalRotation' },
      { name: 'subscapularis', path: ['subscapularFossa?', headWrap([0, 0, 1], [0, 1, 0]), 'lesserTubercle?'], fmax: 600, radius: 0.017, tendon: [0.03, 0.18], test: 'externalRotation' },
    ],
  },
  {
    id: 'trapezius', name: 'Trapezius', region: 'Shoulders', layer: 'superficial', test: 'upperTrap',
    description: 'The diamond-shaped muscle of the upper back and neck with upper, middle and lower parts.',
    actions: 'Upper part shrugs, middle part squeezes the shoulder blades together, lower part pulls them down; together they rotate the blade upward for overhead work.',
    strands: [
      { name: 'upper', path: ['occiput?', 'levatorVia?', 'clavicleLateral?'], fmax: 400, radius: 0.016, tendon: [0.04, 0.05], test: 'upperTrap' },
      { name: 'middle', path: ['trapMidOrigin?', 'scapulaSpine?'], fmax: 400, radius: 0.017, tendon: [0.05, 0.05], test: 'scapulaProtraction' },
      { name: 'lower', path: ['trapLowOrigin?', 'scapulaSpineRoot?'], fmax: 300, radius: 0.015, tendon: [0.05, 0.05], test: 'scapulaElevation' },
    ],
  },
  {
    id: 'rhomboids', name: 'Rhomboids', region: 'Shoulders', layer: 'deep', test: 'scapulaProtraction',
    description: 'Muscles between the spine and the inner edge of the shoulder blade.',
    actions: 'Squeeze the shoulder blades together and hold them against the ribs.',
    strands: [
      { name: 'rhomboid minor', path: ['rhomboidOrigin?', 'scapulaMedialBorder?'], fmax: 250, radius: 0.013, tendon: [0.04, 0.04] },
      { name: 'rhomboid major', path: ['rhomboidOrigin?', 'scapulaInferiorAngle?'], fmax: 250, radius: 0.013, tendon: [0.04, 0.04] },
    ],
  },
  {
    id: 'serratusAnterior', name: 'Serratus anterior', region: 'Shoulders', layer: 'deep', test: 'scapulaRetraction',
    description: 'Saw-toothed muscle on the side of the ribs that wraps under the shoulder blade.',
    actions: 'Pushes the shoulder blade forward around the ribs (top of a push-up) and holds it flat.',
    strands: [
      { name: 'upper digitations', path: ['serratusUpper?', 'serratusVia?', 'scapulaMedialBorder?'], fmax: 450, radius: 0.014, tendon: [0.03, 0.03] },
      { name: 'lower digitations', path: ['serratusLower?', 'serratusVia?', 'scapulaInferiorAngle?'], fmax: 450, radius: 0.014, tendon: [0.03, 0.03] },
    ],
  },
  // ------------------------------------------------------------------ Arms
  {
    id: 'bicepsBrachii', name: 'Biceps brachii', region: 'Arms', layer: 'superficial', test: 'shoulderExtension',
    description: 'Two-headed muscle on the front of the upper arm.',
    actions: 'Bends the elbow, turns the palm up and helps raise the arm forward.',
    strands: [
      { name: 'long head', path: ['supraglenoid?', 'bicepsVia?', elbowFrontWrap, 'radialTuberosity?'], fmax: 320, radius: 0.019, tendon: [0.22, 0.1] },
      { name: 'short head', path: ['coracoid?', 'bicepsVia?', elbowFrontWrap, 'radialTuberosity?'], fmax: 300, radius: 0.019, tendon: [0.12, 0.1] },
    ],
  },
  {
    id: 'brachialis', name: 'Brachialis', region: 'Arms', layer: 'deep', test: 'elbowExtension',
    description: 'Strong elbow flexor under the biceps.',
    actions: 'Bends the elbow whatever the hand position.',
    strands: [{ name: 'brachialis', path: ['brachialisOrigin?', elbowFrontWrap, 'ulnarTuberosity?'], fmax: 900, radius: 0.018, tendon: [0.03, 0.08] }],
  },
  {
    id: 'tricepsBrachii', name: 'Triceps brachii', region: 'Arms', layer: 'superficial', test: 'overheadElbow',
    description: 'Three-headed muscle on the back of the upper arm.',
    actions: 'Straightens the elbow (pressing, push-ups); the long head also pulls the arm back.',
    strands: [
      { name: 'long head', path: ['infraglenoid?', 'tricepsVia?', elbowWrap, 'olecranon?'], fmax: 800, radius: 0.022, tendon: [0.08, 0.16] },
      { name: 'lateral & medial heads', path: ['tricepsLatOrigin?', 'tricepsVia?', elbowWrap, 'olecranon?'], fmax: 1250, radius: 0.024, tendon: [0.03, 0.18] },
    ],
  },
  {
    id: 'forearmFlexors', name: 'Forearm flexors', region: 'Arms', layer: 'superficial', test: 'wristExtension',
    description: 'Muscles on the palm side of the forearm.',
    actions: 'Bend the wrist and fingers, grip.',
    strands: [{ name: 'wrist flexors', path: ['medEpicondyle?', 'forearmFlexorVia?', 'wristVolar?', 'metacarpalVolar?'], fmax: 900, radius: 0.016, tendon: [0.05, 0.38] }],
  },
  {
    id: 'forearmExtensors', name: 'Forearm extensors', region: 'Arms', layer: 'superficial', test: 'wristFlexion',
    description: 'Muscles on the back of the forearm.',
    actions: 'Lift the back of the hand; they work hard when the wrist is bent back under load.',
    strands: [{ name: 'wrist extensors', path: ['latEpicondyle?', 'forearmExtensorVia?', 'wristDorsal?', 'metacarpalDorsal?'], fmax: 600, radius: 0.015, tendon: [0.05, 0.38] }],
  },
  // ------------------------------------------------------------------ Neck
  {
    id: 'sternocleidomastoid', name: 'Sternocleidomastoid', region: 'Neck', layer: 'superficial', test: 'neckExtension',
    description: 'Strap muscle from behind the ear to the breastbone and collarbone.',
    actions: 'Flexes the neck and turns the head to the opposite side.',
    strands: [{ name: 'SCM', path: ['mastoid?', 'clavicleMedial?'], fmax: 300, radius: 0.012, tendon: [0.05, 0.08] }],
  },
  {
    id: 'neckExtensors', name: 'Neck extensors', region: 'Neck', layer: 'deep', test: 'neckFlexion',
    description: 'Splenius and semispinalis at the back of the neck.',
    actions: 'Hold the head up and extend the neck.',
    strands: [{ name: 'splenius / semispinalis', path: ['splenius?', 'cervicalSpinous?', 'occiput?'], fmax: 600, radius: 0.015, tendon: [0.05, 0.06] }],
  },
]

export const MUSCLE_BY_ID: Record<string, MuscleDef> = Object.fromEntries(MUSCLES.map((m) => [m.id, m]))

/** A muscle instance on one side of the body: e.g. "hamstrings.L". */
export interface MuscleInstance {
  key: string
  def: MuscleDef
  side: Side
}

export const MUSCLE_INSTANCES: MuscleInstance[] = MUSCLES.flatMap((def) =>
  (['L', 'R'] as Side[]).map((side) => ({ key: `${def.id}.${side}`, def, side })),
)

export function muscleLabel(key: string): string {
  const [id, side] = key.split('.')
  const def = MUSCLE_BY_ID[id]
  return `${side === 'L' ? 'Left' : 'Right'} ${def.name.charAt(0).toLowerCase()}${def.name.slice(1)}`
}
