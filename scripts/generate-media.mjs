#!/usr/bin/env node
/**
 * FORGE exercise media generator.
 *
 * Produces ORIGINAL instructional SVG illustrations (no third-party assets) for every
 * exercise in the library:
 *   public/media/exercises/<id>.svg       — static diagram: faded start pose + solid end pose + direction arrows
 *   public/media/exercises/<id>-anim.svg  — animated (SMIL) loop between the two poses
 *
 * Figures are built with forward/inverse kinematics from fixed segment lengths so
 * proportions stay consistent. Illustrations are released under CC0 1.0.
 *
 * Run: node scripts/generate-media.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'media', 'exercises');

/* ---------------- geometry ---------------- */
const L = { torso: 78, neck: 8, headR: 13, upper: 46, fore: 42, thigh: 60, shin: 56, foot: 18 };
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const go = (p, a, l) => [p[0] + Math.cos(rad(a)) * l, p[1] + Math.sin(rad(a)) * l];
const angTo = (a, b) => deg(Math.atan2(b[1] - a[1], b[0] - a[0]));
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const add = (a, d) => [a[0] + d[0], a[1] + d[1]];

/** Two-bone inverse kinematics. bend = +1 / −1 picks which side the middle joint goes. */
function ik(root, target, l1, l2, bend) {
  const d = Math.min(dist(root, target), l1 + l2 - 0.5);
  const base = angTo(root, target);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const A = deg(Math.acos(Math.max(-1, Math.min(1, cosA))));
  const a1 = base + bend * A;
  const mid = go(root, a1, l1);
  return [a1, angTo(mid, go(root, base, d))];
}

/** Resolve limb spec → { a1, a2, a3, s1, s2 } */
function limb(root, spec, l1, l2) {
  if (Array.isArray(spec)) {
    const [a1, a2, a3 = 0, s1 = 1, s2 = 1] = spec;
    return { a1, a2, a3, s1, s2 };
  }
  const s1 = spec.s?.[0] ?? 1;
  const s2 = spec.s?.[1] ?? 1;
  const [a1, a2] = ik(root, spec.to, l1 * s1, l2 * s2, spec.bend ?? 1);
  return { a1, a2, a3: spec.end ?? 0, s1, s2 };
}

function chain(root, spec, l1, l2, l3) {
  const r = limb(root, spec, l1, l2);
  const mid = go(root, r.a1, l1 * r.s1);
  const end = go(mid, r.a2, l2 * r.s2);
  const tip = l3 ? go(end, r.a3, l3) : end;
  return { mid, end, tip, r };
}

/* ---------------- pose builders ---------------- */
const C = {
  bg: '#121417',
  floor: '#2b3038',
  equip: '#3a414b',
  equipLine: '#5b6573',
  cable: '#8b95a1',
  body: '#e8eaed',
  far: '#8f97a3',
  hl: '#a3e635',
  text: '#f4f5f6',
  muted: '#9aa1ab',
};

function sidePose(p) {
  const hip = p.hip;
  const torso = p.torso;
  const neck = go(hip, torso, L.torso);
  const shoulder = go(hip, torso, L.torso * 0.9);
  const head = go(neck, p.head ?? torso, L.neck + L.headR);
  const arm = chain(shoulder, p.arm, L.upper, L.fore);
  const arm2 = chain(shoulder, p.arm2 ?? p.arm, L.upper, L.fore);
  const leg = chain(hip, p.leg, L.thigh, L.shin, L.foot);
  const leg2 = chain(hip, p.leg2 ?? p.leg, L.thigh, L.shin, L.foot);
  const pts = { hip, neck, shoulder, head, elbow: arm.mid, hand: arm.end, elbow2: arm2.mid, hand2: arm2.end, knee: leg.mid, ankle: leg.end, toe: leg.tip, knee2: leg2.mid, ankle2: leg2.end, toe2: leg2.tip };
  const segs = [
    ['thigh2', hip, leg2.mid, 12, 'far'],
    ['shin2', leg2.mid, leg2.end, 10, 'far'],
    ['foot2', leg2.end, leg2.tip, 7, 'far'],
    ['upper2', shoulder, arm2.mid, 9, 'far'],
    ['fore2', arm2.mid, arm2.end, 8, 'far'],
    ['torso', hip, neck, 19, 'body'],
    ['thigh', hip, leg.mid, 12, 'near'],
    ['shin', leg.mid, leg.end, 10, 'near'],
    ['foot', leg.end, leg.tip, 7, 'near'],
    ['upper', shoulder, arm.mid, 9, 'near'],
    ['fore', arm.mid, arm.end, 8, 'near'],
  ];
  const ang = { torso, upper: arm.r.a1, fore: arm.r.a2, thigh: leg.r.a1, shin: leg.r.a2, foot: leg.r.a3 };
  return { view: 'side', pts, segs, head: { c: head, r: L.headR }, ang, torsoAxis: [hip, neck] };
}

function frontPose(p) {
  const hip = p.hip;
  const torso = p.torso ?? -90;
  const perp = torso + 90;
  const neck = go(hip, torso, L.torso);
  const sc = go(hip, torso, L.torso * 0.9);
  const shoulderR = go(sc, perp, 22);
  const shoulderL = go(sc, perp, -22);
  const hipR = p.legsFromCenter ? hip : go(hip, perp, 12);
  const hipL = p.legsFromCenter ? hip : go(hip, perp, -12);
  const head = go(neck, p.head ?? torso, L.neck + L.headR);
  const armL = chain(shoulderL, p.armL, L.upper, L.fore);
  const armR = chain(shoulderR, p.armR, L.upper, L.fore);
  const legL = chain(hipL, p.legL, L.thigh, L.shin, p.legL.foot ?? 10);
  const legR = chain(hipR, p.legR, L.thigh, L.shin, p.legR.foot ?? 10);
  const pts = { hip, neck, head, shoulderL, shoulderR, hipL: go(hip, perp, -12), hipR: go(hip, perp, 12), elbowL: armL.mid, handL: armL.end, elbowR: armR.mid, handR: armR.end, kneeL: legL.mid, ankleL: legL.end, kneeR: legR.mid, ankleR: legR.end };
  const offset = p.legsFromCenter ? 2.5 : 0;
  const shift = (pt, k) => go(pt, perp, k * offset);
  const segs = [
    ['thighL', shift(hipL, -1), shift(legL.mid, -1), 12, p.legsFromCenter ? 'far' : 'near'],
    ['shinL', shift(legL.mid, -1), shift(legL.end, -1), 10, p.legsFromCenter ? 'far' : 'near'],
    ['footL', shift(legL.end, -1), shift(legL.tip, -1), 7, p.legsFromCenter ? 'far' : 'near'],
    ['thighR', shift(hipR, 1), shift(legR.mid, 1), 12, 'near'],
    ['shinR', shift(legR.mid, 1), shift(legR.end, 1), 10, 'near'],
    ['footR', shift(legR.end, 1), shift(legR.tip, 1), 7, 'near'],
    ['neckSeg', neck, go(neck, p.head ?? torso, L.neck + 2), 8, 'body'],
    ['upperL', shoulderL, armL.mid, 9, p.farArm === 'L' ? 'far' : 'near'],
    ['foreL', armL.mid, armL.end, 8, p.farArm === 'L' ? 'far' : 'near'],
    ['upperR', shoulderR, armR.mid, 9, 'near'],
    ['foreR', armR.mid, armR.end, 8, 'near'],
  ];
  const poly = [go(shoulderL, torso, 4), go(shoulderR, torso, 4), go(hip, perp, 14), go(hip, perp, -14)];
  return { view: 'front', pts, segs, head: { c: head, r: L.headR }, poly, ang: { torso }, torsoAxis: [hip, neck], perp };
}

function topPose(p) {
  const c = p.center;
  const facing = p.facing ?? -90;
  const perp = facing + 90;
  const shoulderR = go(c, perp, 25);
  const shoulderL = go(c, perp, -25);
  const armL = chain(shoulderL, p.armL, L.upper, L.fore);
  const armR = chain(shoulderR, p.armR, L.upper, L.fore);
  const pts = { center: c, shoulderL, shoulderR, elbowL: armL.mid, handL: armL.end, elbowR: armR.mid, handR: armR.end, handMid: lerp(armL.end, armR.end, 0.5) };
  const segs = [
    ['shoulders', shoulderL, shoulderR, 20, 'body'],
    ['upperL', shoulderL, armL.mid, 9, 'near'],
    ['foreL', armL.mid, armL.end, 8, 'near'],
    ['upperR', shoulderR, armR.mid, 9, 'near'],
    ['foreR', armR.mid, armR.end, 8, 'near'],
  ];
  return { view: 'top', pts, segs, head: { c: go(c, facing, 3), r: 14 }, ang: { facing } };
}

const buildPose = (view, p) => (view === 'front' ? frontPose(p) : view === 'top' ? topPose(p) : sidePose(p));

/* ---------------- equipment primitives ---------------- */
const f = (n) => Math.round(n * 10) / 10;
const line = (a, b, w = 6, color = C.equipLine, layer = 'back') => ({ tag: 'line', layer, attrs: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' } });
const pad = (a, b, w = 11, layer = 'back') => line(a, b, w, C.equip, layer);
const cable = (a, b) => ({ tag: 'line', layer: 'back', attrs: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: C.cable, 'stroke-width': 1.6 } });
const circle = (c, r, fill = C.equip, layer = 'back', stroke = C.equipLine) => ({ tag: 'circle', layer, attrs: { cx: c[0], cy: c[1], r }, style: { fill, stroke, 'stroke-width': 1.5 } });
const rect = (x, y, w, h, layer = 'back', fill = C.equip) => ({ tag: 'rect', layer, attrs: { x, y, width: w, height: h }, style: { fill, rx: 4, stroke: C.equipLine, 'stroke-width': 1.2 } });
const hlLine = (a, b, w = 7) => ({ tag: 'line', layer: 'hl', attrs: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: C.hl, 'stroke-width': w, 'stroke-linecap': 'round', opacity: 0.95 } });
const hlDot = (c, r = 7) => ({ tag: 'circle', layer: 'hl', attrs: { cx: c[0], cy: c[1], r }, style: { fill: C.hl, opacity: 0.95 } });
const text = (x, y, s, opts = {}) => ({ tag: 'text', layer: 'label', attrs: { x, y }, style: { fill: opts.color ?? C.muted, 'font-size': opts.size ?? 10, 'font-weight': opts.weight ?? 600, 'text-anchor': opts.anchor ?? 'middle', 'font-family': 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', 'letter-spacing': 0.2, stroke: C.bg, 'stroke-width': 3.5, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, text: s });

/** Muscle patch along the torso axis (side/front views). side: +1 = front of body, −1 = back. */
function patch(P, t0, t1, side, offset = 7, w = 7) {
  const [a, b] = P.torsoAxis;
  const perp = P.ang.torso + 90 * side;
  return hlLine(go(lerp(a, b, t0), perp, offset), go(lerp(a, b, t1), perp, offset), w);
}

/* ---------------- exercise definitions ---------------- */
// Conventions: side view faces right. Angles in degrees: 0 = right, 90 = down, −90 = up.
const SEATED_Y = 222;
const STAND_Y = 162;

const seat = (x1, x2, y = 232) => [pad([x1, y], [x2, y], 10), line([(x1 + x2) / 2, y + 5], [(x1 + x2) / 2, 280], 6)];

const EX = {
  'leg-press': {
    title: 'Leg press',
    view: 'side',
    A: { hip: [130, 215], torso: -140, arm: [60, 20], leg: [-58.7, -19.7, -130] },
    B: { hip: [130, 215], torso: -140, arm: [60, 20], leg: [-90, 15.5, -130] },
    hl: ['thigh'],
    equip: (P) => {
      const base = go(P.pts.ankle, -40, 8);
      return [
        line([150, 237], [330, 86], 5),
        line([150, 280], [150, 238], 6),
        pad([112, 231], [165, 227], 10),
        pad([124, 228], [58, 172], 12),
        line(base, go(base, 50, 28), 5),
        line(go(base, -130, -12), go(base, -130, 30), 8, C.equipLine, 'front'),
      ];
    },
    arrows: [{ pt: 'ankle', off: [20, 24], both: true, label: 'lower ⇄ press' }],
  },
  'machine-chest-press': {
    title: 'Machine chest press',
    view: 'side',
    A: { hip: [150, SEATED_Y], torso: -97, arm: { to: [186, 150], bend: 1 }, leg: { to: [214, 278], bend: -1, end: 0 } },
    B: { hip: [150, SEATED_Y], torso: -97, arm: { to: [226, 148], bend: 1 }, leg: { to: [214, 278], bend: -1, end: 0 } },
    patches: [[0.65, 0.95, 1]],
    hl: ['upper'],
    equip: (P) => [
      ...seat(118, 186),
      pad([136, 228], [124, 138], 11),
      line([300, 60], [300, 280], 8),
      line(P.pts.hand, [296, 78], 5),
      line(add(P.pts.hand, [0, -10]), add(P.pts.hand, [0, 10]), 6, C.equipLine, 'front'),
    ],
    arrows: [{ pt: 'hand', off: [0, -22], both: true, label: 'press ⇄ return' }],
  },
  'chest-supported-row': {
    title: 'Chest-supported row',
    view: 'side',
    A: { hip: [140, SEATED_Y], torso: -75, arm: { to: [240, 162], bend: 1 }, leg: { to: [204, 278], bend: -1, end: 0 } },
    B: { hip: [140, SEATED_Y], torso: -75, arm: [150, 15], leg: { to: [204, 278], bend: -1, end: 0 } },
    patches: [[0.6, 0.95, -1]],
    equip: (P) => [
      ...seat(110, 172),
      pad([166, 194], [178, 150], 11),
      line([250, 60], [250, 280], 8),
      line(P.pts.hand, [246, 82], 5),
      circle(P.pts.hand, 5, C.equipLine, 'front'),
    ],
    arrows: [{ pt: 'hand', off: [0, 24], both: true, label: 'pull ⇄ reach' }],
  },
  'seated-leg-curl': {
    title: 'Seated leg curl',
    view: 'side',
    A: { hip: [130, 215], torso: -95, arm: [70, 10], leg: [0, 15, -85] },
    B: { hip: [130, 215], torso: -95, arm: [70, 10], leg: [0, 115, 15] },
    hl: ['thigh'],
    equip: (P) => {
      const roller = go(lerp(P.pts.knee, P.pts.ankle, 0.82), P.ang.shin + 90, 10);
      return [
        ...seat(100, 196, 228),
        pad([120, 222], [110, 140], 11),
        pad([166, 202], [196, 202], 9, 'front'),
        line(P.pts.knee, roller, 5),
        circle(roller, 8, C.equip, 'back'),
      ];
    },
    arrows: [{ pt: 'ankle', off: [14, 6], curve: 0.35, both: true, label: 'curl ⇄ return' }],
  },
  'machine-lateral-raise': {
    title: 'Machine lateral raise',
    view: 'front',
    A: { hip: [200, 205], armL: [100, 95], armR: [80, 85], legL: [100, 92, 0, 0.3, 1], legR: [80, 88, 0, 0.3, 1] },
    B: { hip: [200, 205], armL: [180, 172], armR: [0, 8], legL: [100, 92, 0, 0.3, 1], legR: [80, 88, 0, 0.3, 1] },
    hlJoints: ['shoulderL', 'shoulderR'],
    equip: (P) => [
      rect(176, 112, 48, 100),
      pad([160, 214], [240, 214], 10),
      line([200, 219], [200, 280], 6),
      pad(lerp(P.pts.shoulderL, P.pts.elbowL, 0.45), P.pts.elbowL, 14, 'back'),
      pad(lerp(P.pts.shoulderR, P.pts.elbowR, 0.45), P.pts.elbowR, 14, 'back'),
    ],
    arrows: [
      { pt: 'handL', off: [-6, 0], curve: -0.35, both: true },
      { pt: 'handR', off: [6, 0], curve: 0.35, both: true, label: '' },
    ],
    labels: [{ x: 200, y: 52, s: 'raise to shoulder height' }],
  },
  'cable-triceps-pushdown': {
    title: 'Cable triceps pushdown',
    view: 'side',
    A: { hip: [170, STAND_Y], torso: -80, arm: [100, -15], leg: [92, 90, 0], leg2: [86, 92, 0] },
    B: { hip: [170, STAND_Y], torso: -80, arm: [100, 82], leg: [92, 90, 0], leg2: [86, 92, 0] },
    hl: ['upper'],
    equip: (P) => [rect(262, 36, 22, 244), circle([256, 42], 7), cable([256, 42], P.pts.hand), line(add(P.pts.hand, [-4, -8]), add(P.pts.hand, [4, 8]), 5, C.equipLine, 'front')],
    arrows: [{ pt: 'hand', off: [20, 0], curve: -0.3, both: true, label: 'push down' }],
  },
  'ab-crunch-machine': {
    title: 'Abdominal crunch machine',
    view: 'side',
    A: { hip: [150, SEATED_Y], torso: -92, arm: [60, -110], leg: { to: [214, 278], bend: -1, end: 0 } },
    B: { hip: [150, SEATED_Y], torso: -55, head: -38, arm: [97, -73], leg: { to: [214, 278], bend: -1, end: 0 } },
    patches: [[0.15, 0.55, 1]],
    equip: (P) => {
      const padPt = go(P.pts.shoulder, P.ang.torso + 90, 13);
      return [...seat(118, 186), pad([136, 228], [132, 150], 11), line([168, 206], padPt, 5), circle(padPt, 8, C.equip, 'front'), circle([226, 262], 7)];
    },
    arrows: [{ pt: 'head', off: [22, -14], curve: 0.3, both: true }],
    labels: [{ x: 290, y: 120, s: 'curl ribs toward hips' }],
  },
  'hack-squat': {
    title: 'Hack squat machine',
    view: 'side',
    A: { hip: [172, 166], torso: -115, arm: [80, -40], leg: { to: [205, 276], bend: -1, end: -10 } },
    B: { hip: [194, 213], torso: -115, arm: [80, -40], leg: { to: [205, 276], bend: -1, end: -10 } },
    hl: ['thigh'],
    equip: (P) => {
      const back = P.ang.torso - 90;
      return [
        line([92, 92], [176, 272], 5),
        pad(go(P.pts.hip, back, 13), go(P.pts.neck, back, 13), 12),
        circle(go(P.pts.neck, P.ang.torso + 90, 4), 7, C.equip, 'front'),
        line([190, 286], [236, 278], 7),
      ];
    },
    arrows: [{ pt: 'hip', off: [-36, 18], both: true, label: 'lower ⇄ drive up' }],
  },
  'lat-pulldown': {
    title: 'Lat pulldown',
    view: 'side',
    A: { hip: [150, SEATED_Y], torso: -100, arm: { to: [156, 68], bend: 1 }, leg: { to: [214, 278], bend: -1, end: 0 } },
    B: { hip: [150, SEATED_Y], torso: -100, arm: { to: [162, 140], bend: 1 }, leg: { to: [214, 278], bend: -1, end: 0 } },
    patches: [[0.45, 0.85, -1]],
    equip: (P) => [
      ...seat(118, 186),
      line([100, 32], [270, 32], 5),
      circle([160, 32], 6),
      cable([160, 32], P.pts.hand),
      line(add(P.pts.hand, [-16, 0]), add(P.pts.hand, [16, 0]), 5, C.equipLine, 'front'),
      pad([192, 203], [214, 203], 9, 'front'),
      line([270, 32], [270, 280], 7),
    ],
    arrows: [{ pt: 'hand', off: [30, 0], both: true, label: 'pull to upper chest' }],
  },
  'incline-chest-press': {
    title: 'Incline chest press machine',
    view: 'side',
    A: { hip: [150, SEATED_Y], torso: -120, arm: { to: [142, 156], bend: 1 }, leg: { to: [214, 278], bend: -1, end: 0 } },
    B: { hip: [150, SEATED_Y], torso: -120, arm: { to: [184, 113], bend: 1 }, leg: { to: [214, 278], bend: -1, end: 0 } },
    patches: [[0.65, 0.95, 1]],
    hl: ['upper'],
    equip: (P) => [...seat(118, 186), pad([140, 229], [98, 158], 12), line(P.pts.hand, [92, 58], 5), line([92, 58], [92, 280], 7), circle(P.pts.hand, 5, C.equipLine, 'front')],
    arrows: [{ pt: 'hand', off: [14, 18], both: true, label: 'press up & forward' }],
  },
  'reverse-pec-deck': {
    title: 'Reverse pec deck',
    view: 'top',
    A: { center: [200, 172], armL: { to: [192, 92], bend: -1 }, armR: { to: [208, 92], bend: 1 } },
    B: { center: [200, 172], armL: { to: [94, 180], bend: -1 }, armR: { to: [306, 180], bend: 1 } },
    hlJoints: ['shoulderL', 'shoulderR'],
    equip: (P) => [rect(168, 140, 64, 10), rect(170, 160, 60, 66, 'under'), line([200, 118], P.pts.handL, 5), line([200, 118], P.pts.handR, 5), circle([200, 118], 6), circle(P.pts.handL, 6, C.equipLine, 'front'), circle(P.pts.handR, 6, C.equipLine, 'front')],
    arrows: [
      { pt: 'handL', off: [0, -10], curve: -0.4, both: true },
      { pt: 'handR', off: [0, -10], curve: 0.4, both: true },
    ],
    labels: [{ x: 200, y: 262, s: 'top view · chest on pad · arms open out & back' }],
  },
  'preacher-curl-machine': {
    title: 'Preacher curl machine',
    view: 'side',
    A: { hip: [150, SEATED_Y], torso: -80, arm: [40, 30], leg: { to: [205, 278], bend: -1, end: 0 } },
    B: { hip: [150, SEATED_Y], torso: -80, arm: [40, -100], leg: { to: [205, 278], bend: -1, end: 0 } },
    hl: ['upper'],
    equip: (P) => [...seat(110, 176), pad([160, 166], [202, 199], 12), line([206, 204], [238, 280], 6), circle(P.pts.hand, 6, C.equipLine, 'front')],
    arrows: [{ pt: 'hand', off: [18, 0], curve: -0.45, both: true, label: 'curl ⇄ lower slowly' }],
  },
  'standing-calf-raise': {
    title: 'Standing calf raise',
    view: 'side',
    A: { hip: [246, 162], torso: -90, arm: [70, -60], leg: [90, 90, -20] },
    B: { hip: [249, 144], torso: -90, arm: [70, -60], leg: [90, 90, 40] },
    hl: ['shin'],
    equip: (P) => {
      const padPt = go(P.pts.shoulder, -90, 9);
      return [rect(254, 272, 76, 10), line([192, 40], [192, 280], 7), line([192, padPt[1]], padPt, 6), circle(padPt, 8, C.equip, 'front')];
    },
    arrows: [{ pt: 'ankle', off: [-26, 0], both: true }],
    labels: [{ x: 110, y: 230, s: 'heels below step ⇄ rise high' }],
  },
  'machine-shoulder-press': {
    title: 'Machine shoulder press',
    view: 'side',
    A: { hip: [150, SEATED_Y], torso: -92, arm: { to: [162, 142], bend: 1 }, leg: { to: [214, 278], bend: -1, end: 0 } },
    B: { hip: [150, SEATED_Y], torso: -92, arm: { to: [164, 68], bend: 1 }, leg: { to: [214, 278], bend: -1, end: 0 } },
    hlJoints: ['shoulder'],
    hl: ['upper'],
    equip: (P) => [...seat(118, 186), pad([137, 228], [132, 128], 11), line([92, 196], P.pts.hand, 5), line([92, 196], [92, 280], 7), circle(P.pts.hand, 5, C.equipLine, 'front')],
    arrows: [{ pt: 'hand', off: [24, 0], both: true, label: 'press overhead' }],
  },
  'seated-cable-row': {
    title: 'Seated cable row',
    view: 'side',
    A: { hip: [110, 234], torso: -80, arm: { to: [200, 184], bend: 1 }, leg: { to: [222, 252], bend: -1, end: -80 } },
    B: { hip: [110, 234], torso: -95, arm: { to: [142, 190], bend: 1 }, leg: { to: [222, 252], bend: -1, end: -80 } },
    patches: [[0.55, 0.9, -1]],
    equip: (P) => [pad([60, 246], [150, 246], 10), line([70, 250], [70, 280], 6), line([140, 250], [140, 280], 6), line([232, 226], [236, 268], 7), circle([262, 246], 6), line([262, 246], [262, 280], 6), cable([262, 246], P.pts.hand), circle(P.pts.hand, 5, C.equipLine, 'front')],
    arrows: [{ pt: 'hand', off: [0, -22], both: true, label: 'pull to lower ribs' }],
  },
  'pec-deck': {
    title: 'Pec deck chest fly',
    view: 'top',
    A: { center: [200, 172], armL: { to: [96, 166], bend: -1 }, armR: { to: [304, 166], bend: 1 } },
    B: { center: [200, 172], armL: { to: [193, 96], bend: -1 }, armR: { to: [207, 96], bend: 1 } },
    equip: (P) => [rect(168, 190, 64, 10), line([200, 150], P.pts.handL, 5), line([200, 150], P.pts.handR, 5), circle([200, 150], 6), circle(P.pts.handL, 6, C.equipLine, 'front'), circle(P.pts.handR, 6, C.equipLine, 'front'), hlLine([182, 162], [218, 162], 6)],
    arrows: [
      { pt: 'handL', off: [0, 10], curve: 0.4, both: true },
      { pt: 'handR', off: [0, 10], curve: -0.4, both: true },
    ],
    labels: [{ x: 200, y: 262, s: 'top view · back on pad · arms sweep together' }],
  },
  'leg-extension': {
    title: 'Leg extension',
    view: 'side',
    A: { hip: [130, 215], torso: -95, arm: [70, 10], leg: [0, 100, 10] },
    B: { hip: [130, 215], torso: -95, arm: [70, 10], leg: [0, -2, -90] },
    hl: ['thigh'],
    equip: (P) => {
      const roller = go(lerp(P.pts.knee, P.pts.ankle, 0.85), P.ang.shin - 90, 10);
      return [...seat(100, 196, 228), pad([120, 222], [110, 140], 11), line(P.pts.knee, roller, 5), circle(roller, 8, C.equip, 'front')];
    },
    arrows: [{ pt: 'ankle', off: [10, 8], curve: 0.35, both: true, label: 'extend ⇄ lower' }],
  },
  'cable-biceps-curl': {
    title: 'Cable biceps curl',
    view: 'side',
    A: { hip: [170, STAND_Y], torso: -90, arm: [92, 80], leg: [92, 90, 0], leg2: [86, 92, 0] },
    B: { hip: [170, STAND_Y], torso: -90, arm: [88, -82], leg: [92, 90, 0], leg2: [86, 92, 0] },
    hl: ['upper'],
    equip: (P) => [rect(262, 36, 22, 244), circle([256, 266], 7), cable([256, 266], P.pts.hand), line(add(P.pts.hand, [0, -8]), add(P.pts.hand, [0, 8]), 5, C.equipLine, 'front')],
    arrows: [{ pt: 'hand', off: [20, 0], curve: 0.4, both: true, label: 'curl ⇄ lower' }],
  },
  'triceps-extension-machine': {
    title: 'Triceps extension machine',
    view: 'side',
    A: { hip: [150, SEATED_Y], torso: -92, arm: [20, -115], leg: { to: [214, 278], bend: -1, end: 0 } },
    B: { hip: [150, SEATED_Y], torso: -92, arm: [20, 30], leg: { to: [214, 278], bend: -1, end: 0 } },
    hl: ['upper'],
    equip: (P) => [...seat(118, 186), pad([136, 228], [132, 140], 11), pad([146, 172], [190, 186], 12), line([200, 190], [240, 280], 6), circle(P.pts.hand, 6, C.equipLine, 'front')],
    arrows: [{ pt: 'hand', off: [18, -6], curve: 0.4, both: true, label: 'extend ⇄ return' }],
  },
  'cable-crunch': {
    title: 'Cable crunch',
    view: 'side',
    A: { hip: [200, 218], torso: -85, arm: [30, -120], leg: [90, 180, 180] },
    B: { hip: [200, 218], torso: -35, head: -15, arm: [80, -70], leg: [90, 180, 180] },
    patches: [[0.15, 0.55, 1]],
    equip: (P) => [line([110, 288], [250, 288], 6, C.floor), rect(306, 30, 22, 250), circle([300, 40], 7), cable([300, 40], P.pts.hand), line(add(P.pts.hand, [-3, -8]), add(P.pts.hand, [3, 8]), 5, C.equipLine, 'front')],
    arrows: [{ pt: 'head', off: [12, -10], curve: 0.35, both: true, label: 'curl down, hips still' }],
  },
  'reverse-crunch': {
    title: 'Reverse crunch',
    view: 'side',
    floor: 276,
    A: { hip: [210, 266], torso: 180, arm: [2, 0], leg: [-90, 0, -30] },
    B: { hip: [208, 254], torso: 171, arm: [2, 0], leg: [-128, -38, -60] },
    patches: [[0.1, 0.5, 1]],
    equip: () => [line([70, 280], [320, 280], 6, C.floor)],
    arrows: [{ pt: 'knee', off: [18, -6], curve: -0.4, both: true, label: 'curl pelvis up' }],
  },
  'dead-bug': {
    title: 'Dead bug',
    view: 'side',
    floor: 276,
    A: { hip: [215, 266], torso: 180, arm: [-90, -90], arm2: [-90, -90], leg: [-90, 0, -40], leg2: [-90, 0, -40] },
    B: { hip: [215, 266], torso: 180, arm: [194, 190], arm2: [-90, -90], leg: [-90, 0, -40], leg2: [-12, -6, -40] },
    patches: [[0.1, 0.55, 1]],
    equip: () => [line([40, 280], [350, 280], 6, C.floor)],
    arrows: [
      { pt: 'hand', off: [-10, -10], curve: -0.35, both: true },
      { pt: 'ankle2', off: [8, -14], curve: 0.3, both: true },
    ],
    labels: [{ x: 200, y: 52, s: 'opposite arm & leg reach · low back stays down' }],
  },
  'pallof-press': {
    title: 'Pallof press',
    view: 'top',
    A: { center: [190, 176], armL: { to: [186, 140], bend: -1 }, armR: { to: [194, 140], bend: 1 } },
    B: { center: [190, 176], armL: { to: [187, 92], bend: -1 }, armR: { to: [193, 92], bend: 1 } },
    equip: (P) => [rect(334, 70, 18, 150), circle([330, 118], 6), cable([330, 118], P.pts.handMid), circle(P.pts.handMid, 6, C.equipLine, 'front'), { tag: 'circle', layer: 'hl', attrs: { cx: 190, cy: 176, r: 36 }, style: { fill: 'none', stroke: C.hl, 'stroke-width': 2, 'stroke-dasharray': '5 5', opacity: 0.9 } }],
    arrows: [{ pt: 'handMid', off: [-26, 0], both: true, label: 'press out' }],
    labels: [
      { x: 270, y: 108, s: 'cable pulls sideways' },
      { x: 190, y: 232, s: 'top view · keep hips & shoulders square' },
    ],
  },
  'side-plank': {
    title: 'Side plank',
    view: 'front',
    floor: 278,
    A: { hip: [163, 258], torso: -137, legsFromCenter: true, armL: [90, 180, 0, 1, 0.5], armR: { to: [168, 250], bend: -1 }, legL: { to: [285, 272], bend: 1, foot: 0 }, legR: { to: [285, 272], bend: 1, foot: 0 } },
    B: { hip: [176, 230], torso: -160, legsFromCenter: true, armL: [90, 180, 0, 1, 0.5], armR: { to: [180, 222], bend: -1 }, legL: { to: [285, 270], bend: 1, foot: 0 }, legR: { to: [285, 270], bend: 1, foot: 0 } },
    equip: (P) => [line([40, 282], [340, 282], 6, C.floor), hlLine(lerp(P.pts.hipR, P.pts.shoulderR, 0.15), lerp(P.pts.hipR, P.pts.shoulderR, 0.8), 6)],
    arrows: [{ pt: 'hip', off: [0, -30], both: true, label: 'lift hips into a line' }],
    labels: [{ x: 120, y: 62, s: 'elbow under shoulder' }],
  },
  plank: {
    title: 'Regular plank',
    view: 'side',
    floor: 276,
    A: { hip: [185, 252], torso: -22, arm: [90, 0], leg: [162, -172, 170] },
    B: { hip: [181, 238], torso: -10, arm: [90, 0], leg: [170, 170, 100] },
    patches: [[0.15, 0.6, 1]],
    equip: () => [line([30, 280], [340, 280], 6, C.floor)],
    arrows: [{ pt: 'hip', off: [0, -30], both: true, label: 'lift & hold a straight line' }],
  },
};

/* ---------------- rendering ---------------- */

function figure(P, ex) {
  const els = [];
  const hl = new Set(ex.hl ?? []);
  const segColor = (key, layer) => (hl.has(key) || hl.has(key.replace(/2$/, '')) && layer !== 'far' ? C.hl : layer === 'far' ? C.far : C.body);
  const segEl = ([key, a, b, w, layer]) => ({ tag: 'line', layer: 'fig', key, attrs: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: segColor(key, layer), 'stroke-width': w, 'stroke-linecap': 'round' } });
  const order = ['far', 'body', 'near'];
  for (const layer of order) {
    if (layer === 'body' && P.poly) {
      els.push({ tag: 'polygon', layer: 'fig', attrs: { points: P.poly.map((p) => `${f(p[0])},${f(p[1])}`).join(' ') }, style: { fill: C.body, stroke: C.body, 'stroke-width': 4, 'stroke-linejoin': 'round' } });
    }
    for (const s of P.segs.filter((s) => s[4] === layer)) {
      const [key, a, b, w] = s;
      els.push({ tag: 'line', layer: 'fig', key: `${key}-o`, attrs: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: C.bg, 'stroke-width': w + 3.5, 'stroke-linecap': 'round' } });
      els.push(segEl(s));
    }
    if (layer === 'body') {
      els.push({ tag: 'circle', layer: 'fig', attrs: { cx: P.head.c[0], cy: P.head.c[1], r: P.head.r }, style: { fill: C.body } });
    }
  }
  return els;
}

function collect(P, ex) {
  const equip = ex.equip ? ex.equip(P) : [];
  const patches = (ex.patches ?? []).map(([t0, t1, side]) => patch(P, t0, t1, side));
  const joints = (ex.hlJoints ?? []).map((j) => hlDot(P.pts[j], 7));
  const under = equip.filter((e) => e.layer === 'under');
  const back = equip.filter((e) => e.layer === 'back');
  const front = equip.filter((e) => e.layer === 'front');
  const hlEls = [...equip.filter((e) => e.layer === 'hl'), ...patches, ...joints];
  return [...under, ...back, ...figure(P, ex), ...hlEls, ...front];
}

function attrString(attrs) {
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${typeof v === 'number' ? f(v) : v}"`)
    .join(' ');
}

function styleString(style) {
  return Object.entries(style)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function el(e, extra = '', children = '') {
  const inner = e.text != null ? esc(e.text) : '';
  return `<${e.tag} ${attrString(e.attrs)} ${styleString(e.style)}${extra}>${inner}${children}</${e.tag}>`;
}

function arrowPath(a, b, curve) {
  const mid = lerp(a, b, 0.5);
  const len = dist(a, b);
  const perp = angTo(a, b) + 90;
  const ctrl = go(mid, perp, len * curve);
  return { d: `M${f(a[0])},${f(a[1])} Q${f(ctrl[0])},${f(ctrl[1])} ${f(b[0])},${f(b[1])}`, mid: lerp(lerp(a, ctrl, 0.5), lerp(ctrl, b, 0.5), 0.5), perp };
}

function arrows(ex, PA, PB) {
  return (ex.arrows ?? [])
    .map((ar) => {
      const off = ar.off ?? [0, 0];
      const a = add(PA.pts[ar.pt], off);
      const b = add(PB.pts[ar.pt], off);
      if (dist(a, b) < 6) return '';
      // shorten slightly so heads don't overlap the limbs
      const { d, mid, perp } = arrowPath(a, b, ar.curve ?? 0);
      const markers = `marker-end="url(#ah)"${ar.both ? ' marker-start="url(#ahs)"' : ''}`;
      let label = '';
      if (ar.label) {
        const lp = go(mid, perp + (ar.curve && ar.curve < 0 ? 180 : 0), 0);
        label = el(text(f(lp[0]), f(lp[1] - 10), ar.label, { color: C.hl, size: 10 }));
      }
      return `<path d="${d}" fill="none" stroke="${C.hl}" stroke-width="2.4" stroke-linecap="round" ${markers} opacity="0.95"/>${label}`;
    })
    .join('');
}

function same(a, b) {
  return JSON.stringify(a.attrs) === JSON.stringify(b.attrs);
}

function frame(ex, body, animated) {
  const floorY = ex.floor ?? 280;
  const badge = animated ? 'ANIMATED ILLUSTRATION' : 'ILLUSTRATION';
  const bw = animated ? 132 : 80;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300" role="img" aria-labelledby="t d">
<title id="t">${esc(ex.title)} — instructional illustration</title>
<desc id="d">Original FORGE diagram (CC0). ${animated ? 'Loops between the start and end positions.' : 'Faded figure shows the start position, solid figure the end position; green arrows show the direction of movement and highlighted areas the main muscles.'}</desc>
<defs>
<marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.hl}"/></marker>
<marker id="ahs" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.hl}"/></marker>
<radialGradient id="glow" cx="50%" cy="45%" r="65%"><stop offset="0" stop-color="#1b1f24"/><stop offset="1" stop-color="${C.bg}"/></radialGradient>
</defs>
<rect width="400" height="300" rx="18" fill="url(#glow)"/>
<line x1="16" y1="${floorY + 2}" x2="384" y2="${floorY + 2}" stroke="${C.floor}" stroke-width="2"/>
<text x="18" y="28" fill="${C.text}" font-size="15" font-weight="700" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">${esc(ex.title)}</text>
<rect x="${384 - bw}" y="14" width="${bw}" height="18" rx="9" fill="none" stroke="${C.hl}" stroke-opacity="0.6"/>
<text x="${384 - bw / 2}" y="26.5" fill="${C.hl}" font-size="8.5" font-weight="700" text-anchor="middle" letter-spacing="0.8" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">${badge}</text>
${body}
<text x="18" y="296" fill="${C.muted}" font-size="8.5" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">${animated ? 'Loop: start ⇄ end position' : 'Faded = start · Solid = end · Green = direction &amp; target muscles'} · FORGE original (CC0)</text>
</svg>
`;
}

function labels(ex) {
  return (ex.labels ?? []).map((l) => el(text(l.x, l.y, l.s, { color: C.muted, size: 10 }))).join('');
}

function renderStatic(ex) {
  const PA = buildPose(ex.view, ex.A);
  const PB = buildPose(ex.view, ex.B);
  const ea = collect(PA, ex);
  const eb = collect(PB, ex);
  const ghost = ea
    .map((e, i) => (eb[i] && same(e, eb[i]) ? '' : el(e)))
    .join('');
  const body = `<g opacity="0.3">${ghost}</g>${eb.map((e) => el(e)).join('')}${arrows(ex, PA, PB)}${labels(ex)}`;
  return frame(ex, body, false);
}

function renderAnimated(ex) {
  const PA = buildPose(ex.view, ex.A);
  const PB = buildPose(ex.view, ex.B);
  const ea = collect(PA, ex);
  const eb = collect(PB, ex);
  const spline = 'keyTimes="0;0.5;1" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" dur="3.2s" repeatCount="indefinite"';
  const body = ea
    .map((e, i) => {
      const b = eb[i];
      let anims = '';
      for (const k of Object.keys(e.attrs)) {
        const va = e.attrs[k];
        const vb = b.attrs[k];
        if (va === vb) continue;
        const fa = typeof va === 'number' ? f(va) : va;
        const fb = typeof vb === 'number' ? f(vb) : vb;
        if (fa === fb) continue;
        anims += `<animate attributeName="${k}" values="${fa};${fb};${fa}" ${spline}/>`;
      }
      return el(e, '', anims);
    })
    .join('');
  const arrowLayer = `<g opacity="0.45">${arrows(ex, PA, PB)}</g>`;
  return frame(ex, body + arrowLayer + labels(ex), true);
}

mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [id, ex] of Object.entries(EX)) {
  writeFileSync(join(OUT, `${id}.svg`), renderStatic(ex));
  writeFileSync(join(OUT, `${id}-anim.svg`), renderAnimated(ex));
  n++;
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ license: 'CC0-1.0', author: 'FORGE (original illustrations)', ids: Object.keys(EX) }, null, 2) + '\n');
console.log(`Generated ${n * 2} exercise illustrations in public/media/exercises`);
