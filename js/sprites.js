// Procedural vector sprites. Everything is drawn facing right with feet at (0, 0).

const TAU = Math.PI * 2;

export function sizeFor(age, sex) {
  const g = Math.min(1, age / 22);
  let sz = 0.34 + 0.66 * Math.pow(g, 0.75);
  if (sex === 'M' && age > 14) sz *= 1 + Math.min(0.22, (age - 14) * 0.012);
  return sz;
}

export function tuskLength(age, sex, tuskless) {
  if (tuskless || age < 2.5) return 0;
  return sex === 'M' ? Math.min(24, (age - 2) * 0.95) : Math.min(11, (age - 2) * 0.45);
}

function hsl(t, dl = 0, da = 1) {
  return `hsla(${t.h},${t.s}%,${Math.max(0, Math.min(100, t.l + dl))}%,${da})`;
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}

function leg(ctx, x, top, len, w, angle, fill, foot) {
  ctx.save();
  ctx.translate(x, top);
  ctx.rotate(angle);
  ctx.fillStyle = fill;
  ctx.beginPath();
  const r = w * 0.45;
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(w / 2, 0);
  ctx.lineTo(w / 2 + 0.6, len - r);
  ctx.quadraticCurveTo(w / 2 + 0.6, len, w / 2 - r, len);
  ctx.lineTo(-w / 2 + r, len);
  ctx.quadraticCurveTo(-w / 2 - 0.6, len, -w / 2 - 0.6, len - r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = foot;
  ctx.fillRect(-w / 2 - 0.2, len - 2.2, w + 0.4, 1.6);
  ctx.restore();
}

// Tapered trunk along a quadratic curve.
function trunk(ctx, p0, c, p1, w0, w1, fill) {
  const pts = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0];
    const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1];
    const dx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]);
    const dy = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
    const len = Math.hypot(dx, dy) || 1;
    const w = w0 + (w1 - w0) * t;
    pts.push([x, y, (-dy / len) * w, (dx / len) * w]);
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0] + p[2], p[1] + p[3]) : ctx.moveTo(p[0] + p[2], p[1] + p[3])));
  const last = pts[pts.length - 1];
  ctx.arc(last[0], last[1], w1, Math.atan2(last[3], last[2]), Math.atan2(-last[3], -last[2]));
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0] - pts[i][2], pts[i][1] - pts[i][3]);
  ctx.closePath();
  ctx.fill();
  return pts;
}

/**
 * o: { x, y, s, dir, t, phase, moving, age, sex, tone, tuskless, seed,
 *      mud, trumpet, selected, sleep, glow }
 */
export function drawElephant(ctx, o) {
  const cute = o.age < 4 ? 1 : o.age < 9 ? 0.5 : 0;
  const sz = sizeFor(o.age, o.sex) * o.s;
  const t = o.t;
  const seed = o.seed || 0;
  const p = o.phase || 0;
  const mv = o.moving ? 1 : 0;
  const tone = o.tone;

  ctx.save();
  ctx.translate(o.x, o.y);

  if (o.selected) {
    ctx.save();
    ctx.scale(sz, sz);
    const pulse = 0.55 + 0.25 * Math.sin(t * 4);
    ctx.strokeStyle = `rgba(255,214,140,${pulse})`;
    ctx.lineWidth = 2.2 / sz;
    ellipse(ctx, 0, 1, 42, 8);
    ctx.stroke();
    ctx.restore();
  }

  // Ground shadow
  ctx.fillStyle = 'rgba(20,12,4,0.22)';
  ellipse(ctx, 0, 1, 36 * sz, 5.5 * sz);
  ctx.fill();

  ctx.scale(o.dir * sz, sz);

  const bob = -Math.abs(Math.sin(p)) * 1.3 * mv;
  const legLen = 24 + cute * 2;
  const top = -24 - cute * 2;
  const skin = hsl(tone);
  const skinDark = hsl(tone, -10);
  const skinFar = hsl(tone, -16);
  const foot = hsl(tone, -20, 0.8);
  const swing = 0.38 * mv;

  // Far legs
  leg(ctx, -18, top + bob, legLen, 10, Math.sin(p + Math.PI * 0.5) * swing, skinFar, foot);
  leg(ctx, 13, top + bob, legLen, 10, Math.sin(p + Math.PI * 1.5) * swing, skinFar, foot);

  ctx.translate(0, bob);

  // Tail
  const tailSw = Math.sin(t * 2.2 + seed) * 3;
  ctx.strokeStyle = skinDark;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-35, -44);
  ctx.quadraticCurveTo(-41 + tailSw * 0.3, -34, -39 + tailSw, -24);
  ctx.stroke();
  ctx.fillStyle = hsl(tone, -25);
  ellipse(ctx, -39 + tailSw, -23, 1.6, 2.6);
  ctx.fill();

  // Body
  const bodyW = cute ? 0.9 : 1;
  const grad = ctx.createLinearGradient(0, -62, 0, -14);
  grad.addColorStop(0, hsl(tone, 9));
  grad.addColorStop(0.55, skin);
  grad.addColorStop(1, hsl(tone, -12));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-36 * bodyW, -30);
  ctx.bezierCurveTo(-38 * bodyW, -52, -20 * bodyW, -63, 0, -61);
  ctx.bezierCurveTo(14, -60, 22, -55, 26, -47);
  ctx.lineTo(28, -28);
  ctx.bezierCurveTo(20, -16, -26 * bodyW, -14, -34 * bodyW, -20);
  ctx.closePath();
  ctx.fill();

  // Mud / dust coat on the lower body
  if (o.mud > 0) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = `rgba(92,58,32,${0.35 * o.mud})`;
    ctx.fillRect(-45, -38, 80, 30);
    ctx.restore();
  }

  // Skin wrinkles
  ctx.strokeStyle = hsl(tone, -14, 0.5);
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-6 + i * 7, -34, 10, 1.9, 2.5);
    ctx.stroke();
  }

  // Near legs
  leg(ctx, -24 * bodyW, top, legLen, 11.5, Math.sin(p + Math.PI) * swing, skin, foot);
  leg(ctx, 9, top, legLen, 11.5, Math.sin(p) * swing, skin, foot);

  // Head
  const hs = 1 + cute * 0.22;
  ctx.save();
  ctx.translate(28, -44);
  ctx.scale(hs, hs);
  const nod = mv ? Math.sin(p * 2) * 0.03 : Math.sin(t * 0.8 + seed) * 0.02;
  ctx.rotate(nod - (o.trumpet ? 0.25 : 0));

  const hg = ctx.createLinearGradient(0, -18, 0, 14);
  hg.addColorStop(0, hsl(tone, 8));
  hg.addColorStop(1, hsl(tone, -6));
  ctx.fillStyle = hg;
  ellipse(ctx, 3, -1, 13, 15);
  ctx.fill();
  ellipse(ctx, 6, -10, 8.5, 6.5);
  ctx.fill();

  // Trunk
  const sway = Math.sin(t * 1.1 + seed) * 4 + (mv ? Math.sin(p) * 2 : 0);
  const up = o.trumpet ? 1 : 0;
  const tipY = up ? -30 : 40 - cute * 9;
  const tipX = up ? 24 : 15 + sway;
  const pts = trunk(ctx, [11, 2], [20 + sway * 0.3, up ? -4 : 18], [tipX, tipY], 6.2, 2.6 - cute * 0.4, hsl(tone, 2));
  ctx.strokeStyle = hsl(tone, -12, 0.55);
  ctx.lineWidth = 0.6;
  for (let i = 3; i < pts.length - 1; i += 2) {
    const q = pts[i];
    ctx.beginPath();
    ctx.moveTo(q[0] + q[2] * 0.9, q[1] + q[3] * 0.9);
    ctx.lineTo(q[0] - q[2] * 0.2, q[1] - q[3] * 0.2);
    ctx.stroke();
  }

  // Tusk
  const tl = tuskLength(o.age, o.sex, o.tuskless);
  if (tl > 0) {
    ctx.strokeStyle = '#f3ead6';
    ctx.lineWidth = 2.4 + tl * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, 6);
    ctx.quadraticCurveTo(8 + tl * 0.15, 6 + tl * 0.75, 8 + tl * 0.8, 6 + tl * 0.62);
    ctx.stroke();
  }

  // Eye
  const eyeR = 1.5 + cute * 0.9;
  if (o.sleep) {
    ctx.strokeStyle = '#1b1411';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(6, -4, eyeR, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    const blink = Math.sin(t * 0.7 + seed * 3) > 0.985;
    ctx.fillStyle = '#1b1411';
    ellipse(ctx, 6, -4, eyeR, blink ? 0.3 : eyeR * 1.1);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ellipse(ctx, 6.6, -4.8, eyeR * 0.38, eyeR * 0.38);
      ctx.fill();
    }
    if (cute) {
      ctx.strokeStyle = '#1b1411';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(4.2, -6.4);
      ctx.lineTo(3.4, -7.6);
      ctx.moveTo(5.4, -6.9);
      ctx.lineTo(5.0, -8.2);
      ctx.stroke();
    }
  }
  // Cheek blush on calves
  if (cute) {
    ctx.fillStyle = 'rgba(255,150,140,0.22)';
    ellipse(ctx, 5, 2, 3.2, 2.2);
    ctx.fill();
  }
  ctx.restore();

  // Ear (big African ear) — flaps to cool down.
  const flap = 1 - 0.28 * Math.pow(Math.max(0, Math.sin(t * 1.6 + seed * 1.7)), 6) - (o.trumpet ? 0.2 : 0);
  ctx.save();
  ctx.translate(25, -44);
  ctx.scale(flap * hs, hs);
  const eg = ctx.createLinearGradient(-20, -16, -4, 20);
  eg.addColorStop(0, hsl(tone, 4));
  eg.addColorStop(1, hsl(tone, -8));
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.bezierCurveTo(-12, -21, -23, -11, -21, 2);
  ctx.bezierCurveTo(-20, 12, -14, 19, -8, 20);
  ctx.bezierCurveTo(-4, 13, -2, 7, 1, 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hsl(tone, -16, 0.6);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.strokeStyle = hsl(tone, -12, 0.35);
  ctx.beginPath();
  ctx.moveTo(-3, -8);
  ctx.quadraticCurveTo(-12, -4, -13, 8);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

export function drawLion(ctx, x, y, s, dir, t, night, crouch = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20,12,4,0.2)';
  ellipse(ctx, 0, 1, 22 * s, 3.5 * s);
  ctx.fill();
  ctx.scale(dir * s, s);
  const low = crouch * 4;
  const step = Math.sin(t * 6) * 0.3;
  const body = '#c79a5b';
  const dark = '#a77a42';
  ctx.fillStyle = dark;
  leg(ctx, -12, -12 + low * 0.5, 12 - low * 0.5, 4, -step, dark, '#7a5a31');
  leg(ctx, 11, -12 + low * 0.5, 12 - low * 0.5, 4, step, dark, '#7a5a31');
  ctx.strokeStyle = body;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-18, -15 + low);
  ctx.quadraticCurveTo(-28, -12 + low, -30, -20 + low + Math.sin(t * 2) * 2);
  ctx.stroke();
  ctx.fillStyle = '#5a3b1c';
  ellipse(ctx, -30, -21 + low + Math.sin(t * 2) * 2, 2, 2.4);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -24, 0, -8);
  g.addColorStop(0, '#d8ad6d');
  g.addColorStop(1, '#b8874b');
  ctx.fillStyle = g;
  ellipse(ctx, 0, -16 + low, 20, 7.5);
  ctx.fill();
  leg(ctx, -9, -12 + low * 0.5, 12 - low * 0.5, 4.5, step, body, '#7a5a31');
  leg(ctx, 14, -12 + low * 0.5, 12 - low * 0.5, 4.5, -step, body, '#7a5a31');
  ctx.fillStyle = '#cf9f60';
  ellipse(ctx, 21, -20 + low * 1.1, 7, 6);
  ctx.fill();
  ellipse(ctx, 26, -18 + low * 1.1, 4, 3.2);
  ctx.fill();
  ctx.fillStyle = '#a77a42';
  ellipse(ctx, 18, -26 + low * 1.1, 2, 2);
  ctx.fill();
  ctx.fillStyle = '#3a2412';
  ellipse(ctx, 29.5, -18.5 + low * 1.1, 1.1, 0.9);
  ctx.fill();
  if (night) {
    ctx.shadowColor = '#fff3a0';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#fff4a8';
  } else ctx.fillStyle = '#2a1a0e';
  ellipse(ctx, 23.5, -22 + low * 1.1, 1.2, 1);
  ctx.fill();
  ctx.restore();
}

export function drawHyena(ctx, x, y, s, dir, t, night) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20,12,4,0.2)';
  ellipse(ctx, 0, 1, 18 * s, 3 * s);
  ctx.fill();
  ctx.scale(dir * s, s);
  const step = Math.sin(t * 7) * 0.35;
  const body = '#9b8763';
  const dark = '#7b6a4c';
  leg(ctx, -10, -11, 11, 3.5, -step, dark, '#4a3e2c');
  leg(ctx, 10, -15, 15, 3.5, step, dark, '#4a3e2c');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-15, -12);
  ctx.quadraticCurveTo(-10, -20, 6, -24);
  ctx.quadraticCurveTo(16, -24, 16, -15);
  ctx.quadraticCurveTo(0, -8, -15, -12);
  ctx.fill();
  ctx.fillStyle = '#4f4330';
  [[-6, -15], [0, -18], [5, -14], [-10, -13], [9, -19]].forEach(([a, b]) => {
    ellipse(ctx, a, b, 1.4, 1.2);
    ctx.fill();
  });
  leg(ctx, -7, -11, 11, 4, step, body, '#4a3e2c');
  leg(ctx, 13, -15, 15, 4, -step, body, '#4a3e2c');
  ctx.fillStyle = '#8a7654';
  ellipse(ctx, 19, -21, 6, 5);
  ctx.fill();
  ellipse(ctx, 24, -19, 3.5, 2.6);
  ctx.fill();
  ctx.fillStyle = '#4f4330';
  ellipse(ctx, 16, -27, 2, 2.4);
  ctx.fill();
  if (night) {
    ctx.shadowColor = '#d6ffb0';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#e8ffc8';
  } else ctx.fillStyle = '#1e160c';
  ellipse(ctx, 21, -22.5, 1.1, 1);
  ctx.fill();
  ctx.restore();
}

export function drawTruck(ctx, x, y, s, dir, t, kind) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ellipse(ctx, 0, 1, 28, 4);
  ctx.fill();
  const body = kind === 'rangers' ? '#4f6b3a' : '#3b3a38';
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-26, -20, 52, 14, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-6, -31, 24, 12, 3);
  ctx.fill();
  ctx.fillStyle = kind === 'rangers' ? 'rgba(190,225,255,0.85)' : 'rgba(40,40,40,0.9)';
  ctx.fillRect(4, -28, 12, 7);
  ctx.fillStyle = '#1a1a1a';
  [-15, 15].forEach((wx) => {
    ellipse(ctx, wx, -5, 5.5, 5.5);
    ctx.fill();
  });
  if (kind === 'rangers') {
    const on = Math.floor(t * 6) % 2;
    ctx.fillStyle = on ? '#4fa3ff' : '#ff5a5a';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fillRect(-2, -34, 16, 3);
  }
  ctx.restore();
}

export function drawEgret(ctx, x, y, s, dir, t, flying) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  ctx.fillStyle = '#fbfbf5';
  if (flying) {
    const w = Math.sin(t * 12) * 6;
    ellipse(ctx, 0, 0, 5, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.quadraticCurveTo(-4, -6 - w, -9, -3 - w);
    ctx.quadraticCurveTo(-4, -1, -2, 0);
    ctx.fill();
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(4.5, -0.5, 3, 1);
  } else {
    ctx.strokeStyle = '#2b2b25';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-1, -5);
    ctx.lineTo(-1.5, 0);
    ctx.moveTo(1, -5);
    ctx.lineTo(1.2, 0);
    ctx.stroke();
    ellipse(ctx, 0, -7, 4.5, 2.6, -0.2);
    ctx.fill();
    const peck = Math.max(0, Math.sin(t * 2.3 + x)) > 0.9 ? 3 : 0;
    ctx.strokeStyle = '#fbfbf5';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(3, -8);
    ctx.quadraticCurveTo(5, -12 + peck, 4, -14 + peck * 2);
    ctx.stroke();
    ellipse(ctx, 4.5, -14.5 + peck * 2, 1.7, 1.4);
    ctx.fill();
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(5.5, -15 + peck * 2, 3, 0.9);
  }
  ctx.restore();
}

// Umbrella thorn acacia, or yellow fever tree.
export function drawTree(ctx, x, y, s, kind, color, trunkColor, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const sway = Math.sin(t * 0.6 + x * 0.01) * 0.8;
  ctx.strokeStyle = trunkColor;
  ctx.lineCap = 'round';
  if (kind === 'fever') {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1, -40);
    ctx.moveTo(0.5, -22);
    ctx.lineTo(-12, -42);
    ctx.moveTo(1, -30);
    ctx.lineTo(13, -48);
    ctx.stroke();
    ctx.fillStyle = color;
    [[-13, -46, 12, 6], [1, -50, 14, 7], [14, -52, 12, 6], [-4, -56, 10, 5]].forEach(([a, b, c, d]) => {
      ellipse(ctx, a + sway, b, c, d);
      ctx.fill();
    });
  } else {
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-2, -20, 2, -34);
    ctx.moveTo(1, -26);
    ctx.quadraticCurveTo(-12, -34, -22, -40);
    ctx.moveTo(2, -30);
    ctx.quadraticCurveTo(14, -36, 24, -41);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(sway, -44, 34, 7, 0, 0, TAU);
    ctx.ellipse(-16 + sway, -42, 18, 5.5, 0, 0, TAU);
    ctx.ellipse(18 + sway, -42, 18, 5.5, 0, 0, TAU);
    ctx.ellipse(4 + sway, -49, 22, 5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
