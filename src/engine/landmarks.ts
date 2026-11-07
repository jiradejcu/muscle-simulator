import { sided, type SegmentId, type Side, type Vec3 } from './skeleton'

export interface Landmark {
  seg: SegmentId
  p: Vec3
}

/**
 * Bony landmarks in rest-world coordinates. Sided landmarks are given for the LEFT side
 * and mirrored automatically; their names get an "L" / "R" suffix (e.g. "asisL").
 */
const SIDED: Record<string, { seg: string; p: Vec3 }> = {
  // Pelvis
  asis: { seg: 'pelvis', p: [0.12, 1.0, 0.07] },
  aiis: { seg: 'pelvis', p: [0.1, 0.965, 0.06] },
  iliacCrestLat: { seg: 'pelvis', p: [0.145, 1.04, -0.01] },
  iliacCrestAnt: { seg: 'pelvis', p: [0.13, 1.035, 0.04] },
  iliacCrestPost: { seg: 'pelvis', p: [0.07, 1.05, -0.08] },
  psis: { seg: 'pelvis', p: [0.04, 1.02, -0.095] },
  iliacFossa: { seg: 'pelvis', p: [0.08, 1.0, 0.025] },
  gluteMedOrigin: { seg: 'pelvis', p: [0.125, 1.03, -0.03] },
  gluteMedOriginAnt: { seg: 'pelvis', p: [0.13, 1.02, 0.02] },
  gluteMaxIlium: { seg: 'pelvis', p: [0.07, 1.03, -0.1] },
  sacrumLat: { seg: 'pelvis', p: [0.03, 0.97, -0.115] },
  coccyxLat: { seg: 'pelvis', p: [0.012, 0.905, -0.1] },
  pubicTubercle: { seg: 'pelvis', p: [0.025, 0.9, 0.065] },
  pubicRamus: { seg: 'pelvis', p: [0.035, 0.875, 0.045] },
  ischialRamus: { seg: 'pelvis', p: [0.05, 0.855, 0.0] },
  ischialTuberosity: { seg: 'pelvis', p: [0.065, 0.855, -0.055] },
  piriformisOrigin: { seg: 'pelvis', p: [0.025, 0.97, -0.095] },
  acetabulumPost: { seg: 'pelvis', p: [0.1, 0.93, -0.035] },
  hipWrapCentre: { seg: 'pelvis', p: [0.085, 0.925, 0] },

  // Femur (thigh)
  greaterTrochanter: { seg: 'thigh', p: [0.16, 0.905, -0.01] },
  lesserTrochanter: { seg: 'thigh', p: [0.075, 0.865, -0.015] },
  glutealTuberosity: { seg: 'thigh', p: [0.145, 0.835, -0.035] },
  itBandMid: { seg: 'thigh', p: [0.155, 0.72, -0.005] },
  lineaAsperaUpper: { seg: 'thigh', p: [0.115, 0.78, -0.03] },
  lineaAsperaMid: { seg: 'thigh', p: [0.105, 0.7, -0.03] },
  adductorTubercle: { seg: 'thigh', p: [0.055, 0.545, -0.015] },
  vastusLatOrigin: { seg: 'thigh', p: [0.155, 0.86, 0.0] },
  vastusMedOrigin: { seg: 'thigh', p: [0.085, 0.8, 0.005] },
  vastusIntOrigin: { seg: 'thigh', p: [0.12, 0.82, 0.02] },
  quadDistal: { seg: 'thigh', p: [0.095, 0.575, 0.045] },
  femurLatCondyle: { seg: 'thigh', p: [0.125, 0.51, -0.005] },
  femurMedCondyle: { seg: 'thigh', p: [0.055, 0.51, -0.005] },
  gastrocLatOrigin: { seg: 'thigh', p: [0.115, 0.55, -0.045] },
  gastrocMedOrigin: { seg: 'thigh', p: [0.065, 0.55, -0.045] },
  kneeWrapCentre: { seg: 'thigh', p: [0.09, 0.51, 0.0] },
  hamstringKneeLat: { seg: 'thigh', p: [0.12, 0.55, -0.045] },
  hamstringKneeMed: { seg: 'thigh', p: [0.06, 0.55, -0.045] },

  // Tibia / fibula (shank)
  tibialTuberosity: { seg: 'shank', p: [0.09, 0.45, 0.04] },
  pesAnserinus: { seg: 'shank', p: [0.065, 0.45, 0.015] },
  tibiaMedCondylePost: { seg: 'shank', p: [0.06, 0.48, -0.03] },
  fibularHead: { seg: 'shank', p: [0.135, 0.475, -0.02] },
  gerdyTubercle: { seg: 'shank', p: [0.12, 0.47, 0.025] },
  soleusOrigin: { seg: 'shank', p: [0.11, 0.42, -0.03] },
  soleusOriginMed: { seg: 'shank', p: [0.075, 0.38, -0.025] },
  tibialisAntOrigin: { seg: 'shank', p: [0.115, 0.41, 0.025] },
  ankleFrontVia: { seg: 'shank', p: [0.095, 0.1, 0.04] },
  achillesVia: { seg: 'shank', p: [0.09, 0.14, -0.045] },
  medMalleolus: { seg: 'shank', p: [0.065, 0.075, 0.0] },
  latMalleolus: { seg: 'shank', p: [0.12, 0.065, -0.01] },

  // Foot
  calcaneusTuber: { seg: 'foot', p: [0.09, 0.045, -0.07] },
  heel: { seg: 'foot', p: [0.09, 0.0, -0.06] },
  ball: { seg: 'foot', p: [0.085, 0.0, 0.14] },
  toeTip: { seg: 'foot', p: [0.08, 0.0, 0.2] },
  medialCuneiform: { seg: 'foot', p: [0.07, 0.045, 0.06] },

  // Lumbar
  psoasOrigin: { seg: 'lumbar', p: [0.03, 1.14, -0.03] },
  psoasVia: { seg: 'pelvis', p: [0.07, 0.95, 0.05] },
  lumbarTransverse: { seg: 'lumbar', p: [0.04, 1.15, -0.07] },
  lumbarErectorVia: { seg: 'lumbar', p: [0.035, 1.11, -0.1] },
  lumbarErectorViaLat: { seg: 'lumbar', p: [0.06, 1.11, -0.09] },
  lumbarMultifidus: { seg: 'lumbar', p: [0.018, 1.12, -0.095] },
  thoracolumbarFascia: { seg: 'lumbar', p: [0.04, 1.08, -0.105] },
  rectusAbdLumbarVia: { seg: 'lumbar', p: [0.04, 1.1, 0.12] },
  obliqueLumbarVia: { seg: 'lumbar', p: [0.12, 1.1, 0.06] },
  intObliqueLumbarVia: { seg: 'lumbar', p: [0.1, 1.1, 0.07] },
  qlVia: { seg: 'lumbar', p: [0.06, 1.12, -0.06] },

  // Thorax
  rib12Post: { seg: 'thorax', p: [0.07, 1.2, -0.075] },
  ribAngleUpper: { seg: 'thorax', p: [0.06, 1.38, -0.11] },
  ribAngleLower: { seg: 'thorax', p: [0.07, 1.26, -0.1] },
  thoracicTransverse: { seg: 'thorax', p: [0.03, 1.4, -0.105] },
  thoracicErectorVia: { seg: 'thorax', p: [0.035, 1.27, -0.115] },
  rib5Front: { seg: 'thorax', p: [0.06, 1.29, 0.115] },
  costalMargin: { seg: 'thorax', p: [0.07, 1.23, 0.1] },
  lowerRibsLat: { seg: 'thorax', p: [0.13, 1.23, 0.03] },
  ribsLatMid: { seg: 'thorax', p: [0.14, 1.3, 0.03] },
  ribsLatLow: { seg: 'thorax', p: [0.135, 1.24, 0.0] },
  sternumUpper: { seg: 'thorax', p: [0.02, 1.38, 0.1] },
  sternumMid: { seg: 'thorax', p: [0.02, 1.32, 0.115] },
  sternumLow: { seg: 'thorax', p: [0.02, 1.26, 0.11] },
  clavicleMedial: { seg: 'thorax', p: [0.035, 1.425, 0.06] },
  latThoracicOrigin: { seg: 'thorax', p: [0.015, 1.3, -0.125] },
  latLowerRibs: { seg: 'thorax', p: [0.12, 1.21, -0.04] },
  latWrapUpper: { seg: 'thorax', p: [0.16, 1.27, 0.005] },
  trapMidOrigin: { seg: 'thorax', p: [0.01, 1.43, -0.11] },
  trapLowOrigin: { seg: 'thorax', p: [0.01, 1.26, -0.125] },
  rhomboidOrigin: { seg: 'thorax', p: [0.01, 1.4, -0.115] },
  serratusUpper: { seg: 'thorax', p: [0.13, 1.36, 0.06] },
  serratusLower: { seg: 'thorax', p: [0.14, 1.26, 0.05] },
  serratusVia: { seg: 'thorax', p: [0.15, 1.33, -0.03] },
  splenius: { seg: 'thorax', p: [0.01, 1.46, -0.1] },
  levatorVia: { seg: 'thorax', p: [0.05, 1.5, -0.07] },

  // Scapula & clavicle
  acromion: { seg: 'scapula', p: [0.18, 1.45, -0.01] },
  clavicleLateral: { seg: 'scapula', p: [0.14, 1.445, 0.03] },
  clavicleMid: { seg: 'scapula', p: [0.09, 1.44, 0.05] },
  scapulaSpine: { seg: 'scapula', p: [0.12, 1.425, -0.09] },
  scapulaSpineRoot: { seg: 'scapula', p: [0.075, 1.405, -0.11] },
  scapulaSuperiorAngle: { seg: 'scapula', p: [0.08, 1.45, -0.105] },
  scapulaInferiorAngle: { seg: 'scapula', p: [0.095, 1.27, -0.105] },
  scapulaMedialBorder: { seg: 'scapula', p: [0.07, 1.36, -0.11] },
  scapulaLateralBorder: { seg: 'scapula', p: [0.15, 1.32, -0.07] },
  coracoid: { seg: 'scapula', p: [0.15, 1.405, 0.04] },
  supraglenoid: { seg: 'scapula', p: [0.18, 1.425, 0.0] },
  infraglenoid: { seg: 'scapula', p: [0.17, 1.375, -0.025] },
  supraspinousFossa: { seg: 'scapula', p: [0.11, 1.44, -0.09] },
  infraspinousFossa: { seg: 'scapula', p: [0.11, 1.34, -0.1] },
  subscapularFossa: { seg: 'scapula', p: [0.1, 1.35, -0.075] },
  shoulderWrapCentre: { seg: 'scapula', p: [0.19, 1.41, -0.01] },

  // Humerus
  greaterTubercleTop: { seg: 'humerus', p: [0.21, 1.43, 0.0] },
  greaterTuberclePost: { seg: 'humerus', p: [0.215, 1.405, -0.025] },
  lesserTubercle: { seg: 'humerus', p: [0.2, 1.405, 0.025] },
  pecInsertion: { seg: 'humerus', p: [0.215, 1.35, 0.02] },
  latInsertion: { seg: 'humerus', p: [0.2, 1.335, 0.012] },
  teresInsertion: { seg: 'humerus', p: [0.2, 1.36, 0.0] },
  deltoidTuberosity: { seg: 'humerus', p: [0.225, 1.27, 0.0] },
  deltoidAntVia: { seg: 'humerus', p: [0.205, 1.42, 0.045] },
  deltoidLatVia: { seg: 'humerus', p: [0.24, 1.42, -0.005] },
  deltoidPostVia: { seg: 'humerus', p: [0.205, 1.415, -0.05] },
  bicepsVia: { seg: 'humerus', p: [0.205, 1.3, 0.035] },
  bicepsDistalVia: { seg: 'humerus', p: [0.205, 1.16, 0.04] },
  tricepsLatOrigin: { seg: 'humerus', p: [0.215, 1.34, -0.03] },
  tricepsVia: { seg: 'humerus', p: [0.205, 1.2, -0.045] },
  brachialisOrigin: { seg: 'humerus', p: [0.21, 1.23, 0.015] },
  latEpicondyle: { seg: 'humerus', p: [0.235, 1.12, -0.01] },
  medEpicondyle: { seg: 'humerus', p: [0.17, 1.12, -0.015] },
  elbowWrapCentre: { seg: 'humerus', p: [0.205, 1.11, -0.01] },

  // Forearm
  radialTuberosity: { seg: 'forearm', p: [0.21, 1.07, 0.012] },
  ulnarTuberosity: { seg: 'forearm', p: [0.205, 1.08, 0.015] },
  olecranon: { seg: 'forearm', p: [0.205, 1.12, -0.04] },
  forearmFlexorVia: { seg: 'forearm', p: [0.2, 1.0, 0.02] },
  forearmExtensorVia: { seg: 'forearm', p: [0.225, 1.0, -0.015] },
  wristVolar: { seg: 'forearm', p: [0.215, 0.885, 0.018] },
  wristDorsal: { seg: 'forearm', p: [0.215, 0.885, -0.02] },

  // Hand
  metacarpalVolar: { seg: 'hand', p: [0.215, 0.83, 0.015] },
  metacarpalDorsal: { seg: 'hand', p: [0.215, 0.83, -0.015] },
  palm: { seg: 'hand', p: [0.215, 0.79, 0.012] },
  grip: { seg: 'hand', p: [0.215, 0.79, 0.0] },
  knuckles: { seg: 'hand', p: [0.215, 0.765, 0.0] },
  fingerTip: { seg: 'hand', p: [0.215, 0.68, 0.01] },

  // Head
  mastoid: { seg: 'head', p: [0.05, 1.6, -0.02] },
  occiput: { seg: 'head', p: [0.03, 1.62, -0.075] },
  cervicalSpinous: { seg: 'head', p: [0.01, 1.54, -0.075] },
  cervicalTransverse: { seg: 'head', p: [0.03, 1.55, -0.05] },
}

/** Midline landmarks (no side). */
const MIDLINE: Record<string, { seg: SegmentId; p: Vec3 }> = {
  sacrum: { seg: 'pelvis', p: [0, 0.975, -0.11] },
  coccyx: { seg: 'pelvis', p: [0, 0.9, -0.095] },
  pubicSymphysis: { seg: 'pelvis', p: [0, 0.9, 0.065] },
  l3Spinous: { seg: 'lumbar', p: [0, 1.11, -0.105] },
  l1Spinous: { seg: 'lumbar', p: [0, 1.19, -0.11] },
  navel: { seg: 'lumbar', p: [0, 1.06, 0.12] },
  t12Spinous: { seg: 'thorax', p: [0, 1.22, -0.115] },
  t7Spinous: { seg: 'thorax', p: [0, 1.32, -0.13] },
  t1Spinous: { seg: 'thorax', p: [0, 1.46, -0.105] },
  xiphoid: { seg: 'thorax', p: [0, 1.255, 0.11] },
  manubrium: { seg: 'thorax', p: [0, 1.41, 0.08] },
  upperBack: { seg: 'thorax', p: [0, 1.36, -0.14] },
  barPosition: { seg: 'thorax', p: [0, 1.45, -0.11] },
  headTop: { seg: 'head', p: [0, 1.75, 0.0] },
  headBack: { seg: 'head', p: [0, 1.66, -0.1] },
  forehead: { seg: 'head', p: [0, 1.68, 0.1] },
  chin: { seg: 'head', p: [0, 1.56, 0.09] },
  externalOccipital: { seg: 'head', p: [0, 1.625, -0.08] },
}

function build(): Record<string, Landmark> {
  const out: Record<string, Landmark> = {}
  for (const [name, l] of Object.entries(MIDLINE)) out[name] = l
  for (const [name, l] of Object.entries(SIDED)) {
    for (const side of ['L', 'R'] as Side[]) {
      const isAxial = l.seg === 'pelvis' || l.seg === 'lumbar' || l.seg === 'thorax' || l.seg === 'head'
      const seg = (isAxial ? l.seg : `${l.seg}${side}`) as SegmentId
      out[`${name}${side}`] = { seg, p: sided(l.p, side) }
    }
  }
  return out
}

export const LANDMARKS: Record<string, Landmark> = build()

export function landmark(name: string): Landmark {
  const l = LANDMARKS[name]
  if (!l) throw new Error(`Unknown landmark: ${name}`)
  return l
}
