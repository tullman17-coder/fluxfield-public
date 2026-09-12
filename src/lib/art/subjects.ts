/**
 * Subject shapes for the built-in painter.
 *
 * Without a graphics card behind it, Fieldbench still has to put something in
 * the frame that reads as the thing the brief describes — a hoodie brief should
 * not come back looking like a cloud. Each subject here is a signed distance
 * field: it returns how far a point is from the surface, negative inside. That
 * gives the painter an outline to fill and a gradient to light, so a chair and
 * a bottle come out looking like different objects rather than different
 * colours of the same haze.
 *
 * Shapes live in a square box roughly -0.5 to 0.5 on both axes, with y running
 * downward, and are placed into the frame by the caller.
 */

export type Sdf = (x: number, y: number) => number;

export type Material = "cloth" | "knit" | "hard" | "skin" | "glaze" | "glass";

export type Subject = {
  id: string;
  sdf: Sdf;
  material: Material;
  /** How rounded the form reads when lit. Higher is puffier. */
  puff: number;
};

/* ------------------------------------------------------------- primitives */

function sdBox(x: number, y: number, hw: number, hh: number) {
  const dx = Math.abs(x) - hw;
  const dy = Math.abs(y) - hh;
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0);
}

function rbox(
  x: number,
  y: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  r: number,
) {
  return sdBox(x - cx, y - cy, Math.max(0, hw - r), Math.max(0, hh - r)) - r;
}

function circle(x: number, y: number, cx: number, cy: number, r: number) {
  return Math.hypot(x - cx, y - cy) - r;
}

function ell(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  const px = (x - cx) / rx;
  const py = (y - cy) / ry;
  const k1 = Math.hypot(px, py);
  if (k1 === 0) return -Math.min(rx, ry);
  const k2 = Math.hypot(px / rx, py / ry);
  return (k1 * (k1 - 1)) / k2;
}

/** Capsule between two points — the workhorse for limbs, sleeves and legs. */
function seg(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
) {
  const pax = x - ax;
  const pay = y - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const denom = bax * bax + bay * bay;
  const h = denom === 0 ? 0 : Math.min(1, Math.max(0, (pax * bax + pay * bay) / denom));
  return Math.hypot(pax - bax * h, pay - bay * h) - r;
}

const uni = (a: number, b: number) => Math.min(a, b);
const sub = (a: number, b: number) => Math.max(a, -b);
const cut = (a: number, b: number) => Math.max(a, b);

/** Union with a fillet, so joints read as one object instead of glued parts. */
function blend(a: number, b: number, k: number) {
  const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}

/** Ring wall, for handles and hoops. */
const ring = (x: number, y: number, cx: number, cy: number, r: number, t: number) =>
  Math.abs(circle(x, y, cx, cy, r)) - t;

/* ---------------------------------------------------------------- subjects */

const hoodie: Subject = {
  id: "hoodie",
  material: "knit",
  puff: 0.10,
  sdf: (x, y) => {
    const body = rbox(x, y, 0, 0.09, 0.235, 0.25, 0.07);
    const yoke = seg(x, y, -0.2, -0.12, 0.2, -0.12, 0.1);
    const hood = ell(x, y, 0, -0.235, 0.178, 0.132);
    const sleeveL = seg(x, y, -0.2, -0.11, -0.37, 0.19, 0.075);
    const sleeveR = seg(x, y, 0.2, -0.11, 0.37, 0.19, 0.075);
    const hem = rbox(x, y, 0, 0.33, 0.24, 0.035, 0.02);
    let d = blend(body, yoke, 0.07);
    d = blend(d, hood, 0.05);
    d = blend(d, sleeveL, 0.05);
    d = blend(d, sleeveR, 0.05);
    d = uni(d, hem);
    // The opening sits low in the hood so the crown stays solid. Centred any
    // higher and the hood reads as a carrier handle.
    return sub(d, ell(x, y, 0, -0.185, 0.103, 0.072));
  },
};

const jersey: Subject = {
  id: "jersey",
  material: "cloth",
  puff: 0.085,
  sdf: (x, y) => {
    const body = rbox(x, y, 0, 0.08, 0.245, 0.265, 0.05);
    const yoke = seg(x, y, -0.21, -0.13, 0.21, -0.13, 0.085);
    const sleeveL = seg(x, y, -0.22, -0.14, -0.35, 0.03, 0.082);
    const sleeveR = seg(x, y, 0.22, -0.14, 0.35, 0.03, 0.082);
    let d = blend(body, yoke, 0.06);
    d = blend(d, sleeveL, 0.045);
    d = blend(d, sleeveR, 0.045);
    // Collar notch.
    return sub(d, ell(x, y, 0, -0.215, 0.085, 0.065));
  },
};

/** A low upholstered lounge chair, seen three-quarters on. */
const chair: Subject = {
  id: "chair",
  material: "cloth",
  puff: 0.1,
  sdf: (x, y) => {
    // Backrest, tipped back a little so it does not read as a flat panel.
    const back = rbox(x - (y + 0.2) * 0.16, y, 0.01, -0.16, 0.19, 0.17, 0.085);
    const cushion = rbox(x, y, 0, 0.08, 0.235, 0.075, 0.06);
    const armL = rbox(x, y, -0.225, 0.0, 0.055, 0.115, 0.05);
    const armR = rbox(x, y, 0.225, 0.02, 0.055, 0.105, 0.05);
    const legFL = seg(x, y, -0.18, 0.14, -0.205, 0.38, 0.021);
    const legFR = seg(x, y, 0.18, 0.14, 0.205, 0.38, 0.021);
    const legBL = seg(x, y, -0.1, 0.13, -0.115, 0.32, 0.018);
    const legBR = seg(x, y, 0.1, 0.13, 0.115, 0.32, 0.018);
    let d = blend(back, cushion, 0.07);
    d = blend(d, armL, 0.055);
    d = blend(d, armR, 0.055);
    return uni(d, uni(uni(legFL, legFR), uni(legBL, legBR)));
  },
};

const figure: Subject = {
  id: "figure",
  material: "skin",
  puff: 0.11,
  sdf: (x, y) => {
    const head = ell(x, y, 0, -0.28, 0.098, 0.118);
    const neck = rbox(x, y, 0, -0.17, 0.04, 0.05, 0.02);
    const shoulders = seg(x, y, -0.185, -0.075, 0.185, -0.075, 0.092);
    const torso = rbox(x, y, 0, 0.14, 0.165, 0.215, 0.09);
    const armL = seg(x, y, -0.21, -0.05, -0.27, 0.26, 0.052);
    const armR = seg(x, y, 0.21, -0.05, 0.27, 0.26, 0.052);
    let d = blend(head, neck, 0.035);
    d = blend(d, shoulders, 0.05);
    d = blend(d, torso, 0.06);
    d = blend(d, armL, 0.04);
    d = blend(d, armR, 0.04);
    return d;
  },
};

/** A performer caught mid-gesture — one arm raised, weight on one hip. */
const performer: Subject = {
  id: "performer",
  material: "skin",
  puff: 0.1,
  sdf: (x, y) => {
    const head = ell(x, y, 0.03, -0.3, 0.092, 0.112);
    const neck = rbox(x, y, 0.02, -0.19, 0.038, 0.045, 0.018);
    const shoulders = seg(x, y, -0.155, -0.105, 0.185, -0.12, 0.085);
    const torso = seg(x, y, -0.02, -0.06, 0.035, 0.19, 0.135);
    const armUp = seg(x, y, 0.18, -0.12, 0.33, -0.34, 0.048);
    const foreUp = seg(x, y, 0.33, -0.34, 0.29, -0.46, 0.036);
    const armDown = seg(x, y, -0.16, -0.08, -0.25, 0.22, 0.05);
    const hip = ell(x, y, 0.03, 0.25, 0.15, 0.1);
    let d = blend(head, neck, 0.032);
    d = blend(d, shoulders, 0.05);
    d = blend(d, torso, 0.07);
    d = blend(d, hip, 0.07);
    d = blend(d, armUp, 0.04);
    d = blend(d, foreUp, 0.03);
    d = blend(d, armDown, 0.04);
    return d;
  },
};

const bottle: Subject = {
  id: "bottle",
  material: "glass",
  puff: 0.075,
  sdf: (x, y) => {
    const body = rbox(x, y, 0, 0.19, 0.125, 0.19, 0.05);
    const shoulder = ell(x, y, 0, 0.01, 0.125, 0.11);
    const neck = rbox(x, y, 0, -0.16, 0.042, 0.1, 0.015);
    const cap = rbox(x, y, 0, -0.28, 0.052, 0.042, 0.012);
    let d = blend(body, shoulder, 0.05);
    d = blend(d, neck, 0.035);
    d = uni(d, cap);
    return d;
  },
};

/**
 * Mug and bowl side by side — the breakfast-set arrangement. Both are drawn as
 * solid silhouettes with a wider rim on top; hollowing them out reads as a hole
 * punched through the object rather than as depth.
 */
const tableware: Subject = {
  id: "tableware",
  material: "glaze",
  puff: 0.085,
  sdf: (x, y) => {
    // Mug, left of centre, narrowing toward its base.
    const mugBody = rbox(x, y, -0.18, 0.01, 0.1 - (y - 0.01) * 0.06, 0.125, 0.04);
    const mugRim = ell(x, y, -0.18, -0.115, 0.112, 0.027);
    const handle = cut(ring(x, y, -0.055, 0.02, 0.066, 0.019), -(x + 0.05));

    // Bowl, right and lower, so the two do not sit on one line.
    const bowl = cut(ell(x, y, 0.19, 0.07, 0.175, 0.14), -(y - 0.07));
    const bowlRim = ell(x, y, 0.19, 0.068, 0.188, 0.025);
    const foot = rbox(x, y, 0.19, 0.208, 0.062, 0.018, 0.009);

    let d = uni(blend(mugBody, mugRim, 0.02), handle);
    d = uni(d, uni(blend(bowl, bowlRim, 0.02), foot));
    return d;
  },
};

/** Low-top trainer in profile, toe to the left. */
const sneaker: Subject = {
  id: "sneaker",
  material: "cloth",
  puff: 0.08,
  sdf: (x, y) => {
    const outsole = rbox(x, y, 0, 0.215, 0.335, 0.038, 0.028);
    const midsole = rbox(x, y, 0, 0.165, 0.325, 0.034, 0.03);
    const toeBox = ell(x, y, -0.18, 0.08, 0.165, 0.1);
    const vamp = rbox(x, y, 0.0, 0.055, 0.15, 0.085, 0.055);
    const heelCounter = rbox(x, y, 0.23, 0.01, 0.085, 0.135, 0.055);
    const collar = ell(x, y, 0.215, -0.08, 0.076, 0.038);
    const tongue = rbox(x, y, 0.075, -0.015, 0.05, 0.06, 0.026);
    let d = blend(toeBox, vamp, 0.06);
    d = blend(d, heelCounter, 0.06);
    d = blend(d, collar, 0.04);
    d = blend(d, tongue, 0.055);
    return uni(d, blend(midsole, outsole, 0.02));
  },
};

const bag: Subject = {
  id: "bag",
  material: "cloth",
  puff: 0.085,
  sdf: (x, y) => {
    // Slightly narrower at the base, the way a loaded tote hangs.
    const body = rbox(x, y, 0, 0.16, 0.205 - (y - 0.16) * 0.08, 0.19, 0.04);
    // Top half of a hoop, so the handle arcs above the bag.
    const handle = cut(ring(x, y, 0, -0.04, 0.13, 0.02), y + 0.04);
    const seam = rbox(x, y, 0, -0.035, 0.212, 0.028, 0.014);
    return uni(uni(body, handle), seam);
  },
};

/** Phone-shaped frame, for interface and try-on briefs. */
const device: Subject = {
  id: "device",
  material: "hard",
  puff: 0.05,
  sdf: (x, y) => {
    const shell = rbox(x, y, 0, 0.02, 0.185, 0.345, 0.05);
    const notch = rbox(x, y, 0, -0.3, 0.05, 0.016, 0.008);
    return uni(shell, notch);
  },
};

const box: Subject = {
  id: "box",
  material: "hard",
  puff: 0.06,
  sdf: (x, y) => {
    const front = rbox(x, y, -0.03, 0.09, 0.2, 0.21, 0.02);
    const lid = rbox(x, y, -0.03, -0.13, 0.205, 0.035, 0.015);
    const side = rbox(x, y, 0.21, 0.06, 0.055, 0.2, 0.02);
    return uni(uni(front, lid), side);
  },
};

const tower: Subject = {
  id: "tower",
  material: "hard",
  puff: 0.06,
  sdf: (x, y) => {
    const shaft = rbox(x, y, 0, 0.1, 0.135, 0.34, 0.02);
    const setback = rbox(x, y, 0, -0.21, 0.09, 0.11, 0.015);
    const crown = rbox(x, y, 0, -0.33, 0.05, 0.05, 0.01);
    const wingL = rbox(x, y, -0.21, 0.2, 0.08, 0.24, 0.015);
    const wingR = rbox(x, y, 0.21, 0.24, 0.07, 0.2, 0.015);
    return uni(uni(uni(shaft, setback), crown), uni(wingL, wingR));
  },
};

const plant: Subject = {
  id: "plant",
  material: "glaze",
  puff: 0.075,
  sdf: (x, y) => {
    const pot = rbox(x, y, 0, 0.3, 0.125, 0.1, 0.035);
    const rim = rbox(x, y, 0, 0.205, 0.145, 0.026, 0.012);
    // Each leaf runs back to the crown of the pot, so nothing floats free.
    const stemA = seg(x, y, 0.0, 0.19, -0.12, -0.05, 0.017);
    const leafA = ell(x - (y + 0.13) * 0.35, y, -0.17, -0.13, 0.075, 0.115);
    const stemB = seg(x, y, 0.01, 0.19, 0.13, -0.12, 0.017);
    const leafB = ell(x + (y + 0.2) * 0.3, y, 0.17, -0.21, 0.07, 0.105);
    const stemC = seg(x, y, 0.0, 0.19, -0.01, -0.2, 0.015);
    const leafC = ell(x, y, -0.02, -0.29, 0.065, 0.1);
    let d = blend(pot, rim, 0.03);
    for (const [stem, leaf] of [
      [stemA, leafA],
      [stemB, leafB],
      [stemC, leafC],
    ]) {
      d = blend(d, blend(stem, leaf, 0.035), 0.03);
    }
    return d;
  },
};

const car: Subject = {
  id: "car",
  material: "hard",
  puff: 0.08,
  sdf: (x, y) => {
    const body = rbox(x, y, 0, 0.09, 0.37, 0.1, 0.07);
    const cabin = ell(x, y, -0.02, -0.03, 0.19, 0.11);
    const nose = ell(x, y, -0.3, 0.07, 0.12, 0.06);
    const tail = ell(x, y, 0.31, 0.05, 0.1, 0.065);
    const wheelL = circle(x, y, -0.21, 0.21, 0.082);
    const wheelR = circle(x, y, 0.21, 0.21, 0.082);
    const hubL = circle(x, y, -0.21, 0.21, 0.036);
    const hubR = circle(x, y, 0.21, 0.21, 0.036);
    let d = blend(body, cabin, 0.09);
    d = blend(d, nose, 0.06);
    d = blend(d, tail, 0.06);
    d = uni(d, sub(wheelL, hubL));
    d = uni(d, sub(wheelR, hubR));
    return d;
  },
};

/* --------------------------------------------------------------- matching */

/**
 * Word to shape. Longer, more specific words are checked first so "lounge
 * chair" does not get caught by a looser match further down the list.
 */
const MATCHES: { words: string[]; subject: Subject }[] = [
  { words: ["hoodie", "hooded", "sweatshirt", "crewneck", "pullover"], subject: hoodie },
  { words: ["jersey", "kit portrait", "home kit", "away kit", "team kit", "tee", "t-shirt", "shirt", "apparel", "garment"], subject: jersey },
  { words: ["sneaker", "trainer", "footwear", "shoe", "boot"], subject: sneaker },
  { words: ["handbag", "tote", "backpack", "luggage", "purse", "bag"], subject: bag },
  { words: ["lounge chair", "armchair", "chair", "seating", "sofa", "couch", "furniture", "stool", "sat in"], subject: chair },
  { words: ["mug", "bowl", "cup", "saucer", "crockery", "ceramic", "tableware", "breakfast", "dinnerware", "pottery", "kiln"], subject: tableware },
  { words: ["bottle", "flask", "fragrance", "perfume", "serum", "skincare", "can ", "jar"], subject: bottle },
  { words: ["phone", "handset", "app screen", "interface", "ui hero", "screenshot", "dashboard", "device"], subject: device },
  { words: ["performer", "singer", "dancer", "band", "musician", "stage"], subject: performer },
  { words: ["avatar", "character", "model wearing", "portrait", "athlete", "person", "figure", "silhouette", "headshot"], subject: figure },
  { words: ["plant", "foliage", "botanical", "flower", "bouquet", "leaf"], subject: plant },
  { words: ["car", "vehicle", "automotive", "sedan", "coupe"], subject: car },
  { words: ["tower", "building", "architecture", "skyline", "facade", "interior wall"], subject: tower },
  { words: ["packaging", "carton", "package", "box"], subject: box },
];

/**
 * Picks a shape for a brief, or null when the brief describes a place or a mood
 * rather than a thing — those still look right as atmosphere.
 *
 * Briefs arrive with the subject up front and the look tacked on the end
 * ("…, soft studio lighting, premium brand still"), so the earliest match wins.
 * Otherwise a lighting note would decide what gets drawn.
 */
export function subjectFor(prompt: string): Subject | null {
  const text = prompt.toLowerCase();
  let best: { subject: Subject; at: number; len: number } | null = null;
  for (const entry of MATCHES) {
    for (const word of entry.words) {
      const at = text.indexOf(word);
      if (at === -1) continue;
      if (!best || at < best.at || (at === best.at && word.length > best.len)) {
        best = { subject: entry.subject, at, len: word.length };
      }
    }
  }
  return best?.subject ?? null;
}

export const ALL_SUBJECTS = [
  hoodie,
  jersey,
  chair,
  figure,
  performer,
  bottle,
  tableware,
  sneaker,
  bag,
  device,
  box,
  tower,
  plant,
  car,
];
