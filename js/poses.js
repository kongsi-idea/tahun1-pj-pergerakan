// 动物模仿秀：动作数据 + 姿势判定。纯函数，无 DOM 依赖，可直接在 node 跑测试。
// MediaPipe 坐标：x、y 为 0–1，y 向下。判定全部左右对称（任一边成立即可）。
// 所有距离用「身体尺度 T = 肩中点到髋中点的距离」归一化；x 先乘画面宽高比，避免竖屏下 x/y 比例失真。

// ───── 阈值（集中在这里，真人实测要调就改这里）─────
export const TH = {
  VIS: 0.4,                 // visibility 低于它视为看不到（v3.1：0.5→0.4。远处/笔电镜头下手腕脚踝的 visibility 常在 0.4–0.5 徘徊；0.4 以下多半真的被遮住，再低会把被遮住的肢体误当成看得到）
  MIN_T: 0.03,              // 身体尺度太小（人太远／没抓到）
  FROG_KNEE_DEG: 110,       // 青蛙：膝角小于
  FROG_HIP_ANKLE_T: 1.2,    // 青蛙：髋到踝的垂直距离小于 1.2T（已蹲低）
  GIRAFFE_WRIST_ABOVE_NOSE_T: 0.3,
  GIRAFFE_ELBOW_DEG: 140,
  GIRAFFE_UPRIGHT_DEG: 15,
  FLAMINGO_ANKLE_DIFF_T: 0.35,
  FLAMINGO_ARM_OPEN_T: 0.6,
  DOG_TORSO_MAX_DEG: 30,
  DOG_WRIST_DX_T: 0.5,
  DOG_LEG_Y_T: 0.3,
  DOG_KNEE_DEG: 140,
  STAR_WRIST_SPAN_SW: 2.5,  // 两腕距离 / 肩宽
  STAR_ANKLE_SPAN_SW: 1.5,
  STAR_UPRIGHT_DEG: 25,
  CROC_BODY_DEG: 155,       // 肩-髋-踝
  CROC_TORSO_MAX_DEG: 35,
  CROC_ELBOW_DEG: 150,
  CROC_WRIST_DX_T: 0.5,
  CAT_TILT_MIN_DEG: 12,
  CAT_TILT_MAX_DEG: 70,
};

export const FAR_HINT = '再退后一点，让全身进框';

// 7 个动物。code = DSKP 学习标准。holdMs = 需稳住多久。
const RAW_ANIMALS = [
  { id: 'frog', emoji: '🐸', zh: '青蛙蹲', ms: 'Katak mencangkung', code: '1.6.1', holdMs: 1500, steps: ['双脚打开，比肩膀宽', '慢慢蹲下去', '双手碰地板'] },
  { id: 'giraffe', emoji: '🦒', zh: '长颈鹿伸高', ms: 'Zirafah meninggi', code: '1.6.1', holdMs: 1500, steps: ['站直，双脚并拢', '踮起脚尖', '双手伸直，往天空摸一摸'] },
  { id: 'flamingo', emoji: '🦩', zh: '红鹤单脚站', ms: 'Imbangan flamingo', code: '1.7.1', holdMs: 3000, steps: ['一只脚站好', '另一只脚抬起来', '双手打开，站稳不要动'] },
  { id: 'dog', emoji: '🐶', zh: '小狗三脚站', ms: 'Imbangan anjing', code: '1.7.2', holdMs: 2000, steps: ['双手双膝撑在地上', '把一只脚往后抬', '脚伸直，撑住不要动'] },
  { id: 'starfish', emoji: '⭐', zh: '海星大字形', ms: 'Bintang laut', code: '1.1.1', holdMs: 1500, steps: ['双脚张开', '双手举高张开', '变成一个大字！'] },
  { id: 'crocodile', emoji: '🐊', zh: '鳄鱼撑地', ms: 'Buaya sedia tekan tubi', code: '3.4.1', holdMs: 3000, steps: ['双手撑在地上', '双脚往后伸直', '身体打直像木板，撑住！'] },
  { id: 'cat', emoji: '🐱', zh: '小猫伸懒腰', ms: 'Kucing meregang', code: '3.3.1', holdMs: 2000, steps: ['双手举高，合在一起', '身体慢慢往旁边弯', '停住，伸个懒腰'] },
];
// 动作说明只写一份（steps）：教学页逐步显示、拍照画面和朗读用 desc（步骤连成一句）。
export const ANIMALS = RAW_ANIMALS.map((a) => ({ ...a, desc: a.steps.join('，') + '。' }));

// 动作轮廓模板（viewBox 360×480，3:4）：儿童安全标志式的人形，一笔连续的圆润外轮廓。
// head=[cx,cy,r]（头径约 0.9×肩宽，头是独立圆圈）；shapes=躯干多边形(poly，填满+圆角)与四肢粗线(line)，w=线宽。
// 渲染时用 SVG mask 把 shapes 的联集内部挖空，只留外缘一圈线（见 app.js renderTemplate）。
const L = (w, ...pts) => ({ t: 'line', w, pts });
const P = (w, ...pts) => ({ t: 'poly', w, pts });
export const TEMPLATES = {
  frog: { head: [180, 200, 30], shapes: [
    P(24, [150, 248], [210, 248], [204, 322], [156, 322]),
    L(24, [162, 322], [95, 332], [110, 440], [80, 446]), L(24, [198, 322], [265, 332], [250, 440], [280, 446]),
    L(18, [154, 258], [148, 345], [164, 438]), L(18, [206, 258], [212, 345], [196, 438])] },
  giraffe: { head: [180, 115, 28], shapes: [
    P(26, [152, 160], [208, 160], [204, 285], [156, 285]),
    L(22, [152, 170], [132, 100], [128, 30]), L(22, [208, 170], [228, 100], [232, 30]),
    L(24, [162, 285], [160, 370], [160, 450]), L(24, [198, 285], [200, 370], [200, 450])] },
  flamingo: { head: [180, 75, 28], shapes: [
    P(26, [152, 120], [208, 120], [204, 245], [156, 245]),
    L(22, [152, 130], [95, 135], [35, 140]), L(22, [208, 130], [265, 135], [325, 140]),
    L(24, [162, 245], [160, 350], [158, 445]), L(24, [198, 245], [215, 330], [255, 375])] },
  dog: { head: [58, 242, 28], shapes: [
    L(42, [108, 272], [232, 266]),
    L(22, [108, 280], [104, 350], [104, 430]), L(24, [232, 270], [242, 360], [252, 430]),
    L(24, [232, 266], [290, 256], [345, 246])] },
  starfish: { head: [180, 70, 28], shapes: [
    P(26, [155, 115], [205, 115], [200, 245], [160, 245]),
    L(22, [155, 125], [90, 95], [30, 55]), L(22, [205, 125], [270, 95], [330, 55]),
    L(24, [165, 245], [120, 350], [75, 440]), L(24, [195, 245], [240, 350], [285, 440])] },
  crocodile: { head: [48, 308, 26], shapes: [
    L(40, [88, 330], [203, 372], [325, 415]), L(22, [88, 338], [88, 422])] },
  cat: { head: [238, 112, 28], shapes: [
    P(26, [208, 170], [258, 154], [198, 288], [162, 288]),
    L(22, [212, 172], [196, 105], [244, 30]), L(22, [254, 158], [282, 100], [258, 30]),
    L(24, [164, 288], [160, 370], [158, 450]), L(24, [196, 288], [200, 370], [202, 450])] },
};

// ───── 几何工具 ─────
const prep = (lm, aspect) => lm.map((p) => (p ? { x: p.x * aspect, y: p.y, v: p.visibility ?? 1 } : null));
const seen = (P, i) => !!P[i] && P[i].v >= TH.VIS;
function mid(P, i, j) {
  const a = seen(P, i), b = seen(P, j);
  if (a && b) return { x: (P[i].x + P[j].x) / 2, y: (P[i].y + P[j].y) / 2 };
  if (a) return P[i];
  if (b) return P[j];
  return null;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function angle(a, b, c) { // 在 b 点的夹角（度）
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (m === 0) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / m))) * 180) / Math.PI;
}
const fromVertical = (top, bottom) => (Math.atan2(Math.abs(top.x - bottom.x), Math.abs(top.y - bottom.y)) * 180) / Math.PI;
const fromHorizontal = (a, b) => (Math.atan2(Math.abs(a.y - b.y), Math.abs(a.x - b.x)) * 180) / Math.PI;

const SIDES = [
  { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27 },
  { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28 },
];

const FAIL = (hint) => ({ ok: false, hint });
const PASS = { ok: true, hint: '对了！稳住不要动' };

/**
 * classify(id, landmarks, opts?) → { ok, hint }
 * opts.aspect = 视频宽/高（默认 1）。
 */
export function classify(id, landmarks, opts = {}) {
  if (!landmarks || landmarks.length < 29) return FAIL(FAR_HINT);
  const P = prep(landmarks, opts.aspect ?? 1);
  const sh = mid(P, 11, 12), hp = mid(P, 23, 24), kn = mid(P, 25, 26), an = mid(P, 27, 28);
  if (!seen(P, 0) || !sh || !hp || !kn || !an) return FAIL(FAR_HINT);
  const T = dist(sh, hp);
  if (T < TH.MIN_T) return FAIL(FAR_HINT);
  const nose = P[0];
  const sw = seen(P, 11) && seen(P, 12) ? dist(P[11], P[12]) : T * 0.8;
  const bothWrists = seen(P, 15) && seen(P, 16);
  const sides = SIDES.filter((s) => seen(P, s.sh) && seen(P, s.hip));

  switch (id) {
    case 'frog': {
      const angs = SIDES.filter((s) => seen(P, s.hip) && seen(P, s.kn) && seen(P, s.an)).map((s) => angle(P[s.hip], P[s.kn], P[s.an]));
      if (!angs.length) return FAIL(FAR_HINT);
      if (an.y - hp.y > TH.FROG_HIP_ANKLE_T * T) return FAIL('再蹲低一点点');
      if (Math.max(...angs) >= TH.FROG_KNEE_DEG) return FAIL('膝盖再弯多一点');
      return PASS;
    }
    case 'giraffe': {
      if (!bothWrists) return FAIL('双手要举到框里来');
      if (!(nose.y - P[15].y > TH.GIRAFFE_WRIST_ABOVE_NOSE_T * T && nose.y - P[16].y > TH.GIRAFFE_WRIST_ABOVE_NOSE_T * T)) return FAIL('双手再举高一点');
      const elbows = [[11, 13, 15], [12, 14, 16]].filter(([s, e, w]) => seen(P, s) && seen(P, e)).map(([s, e, w]) => angle(P[s], P[e], P[w]));
      if (elbows.length && Math.min(...elbows) <= TH.GIRAFFE_ELBOW_DEG) return FAIL('手臂伸直');
      if (fromVertical(sh, hp) >= TH.GIRAFFE_UPRIGHT_DEG) return FAIL('身体站直');
      return PASS;
    }
    case 'flamingo': {
      if (!seen(P, 27) || !seen(P, 28)) return FAIL(FAR_HINT);
      if (Math.abs(P[27].y - P[28].y) <= TH.FLAMINGO_ANKLE_DIFF_T * T) return FAIL('把一只脚抬高一点');
      if (!bothWrists || !seen(P, 11) || !seen(P, 12)) return FAIL('双手打开');
      if (!(Math.abs(P[15].x - P[11].x) > TH.FLAMINGO_ARM_OPEN_T * T && Math.abs(P[16].x - P[12].x) > TH.FLAMINGO_ARM_OPEN_T * T)) return FAIL('双手再打开一点');
      return PASS;
    }
    case 'dog': {
      if (fromHorizontal(sh, hp) >= TH.DOG_TORSO_MAX_DEG) return FAIL('身体趴低，背部放平');
      const handsDown = [15, 16].some((w) => seen(P, w) && Math.abs(P[w].x - sh.x) < TH.DOG_WRIST_DX_T * T && P[w].y > sh.y);
      if (!handsDown) return FAIL('双手撑在肩膀下面');
      const legUp = SIDES.some((s) => seen(P, s.hip) && seen(P, s.kn) && seen(P, s.an)
        && P[s.an].y < P[s.hip].y + TH.DOG_LEG_Y_T * T && angle(P[s.hip], P[s.kn], P[s.an]) > TH.DOG_KNEE_DEG);
      if (!legUp) return FAIL('把一只脚往后抬直');
      return PASS;
    }
    case 'starfish': {
      if (!bothWrists || !seen(P, 27) || !seen(P, 28)) return FAIL(FAR_HINT);
      if (!(P[15].y < sh.y && P[16].y < sh.y)) return FAIL('双手举高过肩膀');
      if (dist(P[15], P[16]) <= TH.STAR_WRIST_SPAN_SW * sw) return FAIL('双手张开多一点');
      if (dist(P[27], P[28]) <= TH.STAR_ANKLE_SPAN_SW * sw) return FAIL('双脚张开多一点');
      if (fromVertical(sh, hp) >= TH.STAR_UPRIGHT_DEG) return FAIL('身体站直');
      return PASS;
    }
    case 'crocodile': {
      if (fromHorizontal(sh, hp) >= TH.CROC_TORSO_MAX_DEG) return FAIL('身体趴低，打直');
      if (angle(sh, hp, an) <= TH.CROC_BODY_DEG) return FAIL('屁股不要翘起或掉下来');
      const armOk = sides.some((s) => seen(P, s.el) && seen(P, s.wr) && angle(P[s.sh], P[s.el], P[s.wr]) > TH.CROC_ELBOW_DEG
        && Math.abs(P[s.wr].x - sh.x) < TH.CROC_WRIST_DX_T * T && P[s.wr].y > sh.y);
      if (!armOk) return FAIL('双手撑在肩膀下面，手臂伸直');
      return PASS;
    }
    case 'cat': {
      if (!bothWrists) return FAIL('双手要举到框里来');
      if (!(P[15].y < nose.y && P[16].y < nose.y)) return FAIL('双手举过头');
      const tilt = fromVertical(sh, hp);
      if (tilt <= TH.CAT_TILT_MIN_DEG) return FAIL('身体往旁边弯');
      if (tilt >= TH.CAT_TILT_MAX_DEG) return FAIL('弯一点点就好');
      return PASS;
    }
    default:
      return FAIL('');
  }
}

/** 最近 n 帧多数决，避免抖动。push(ok) → 平滑后的 ok。 */
export function createSmoother(n = 5) {
  const buf = [];
  return {
    push(ok) { buf.push(!!ok); if (buf.length > n) buf.shift(); return buf.filter(Boolean).length * 2 > buf.length; },
    reset() { buf.length = 0; },
  };
}

// ───── 站位检查 v3.2：屏幕上放一个人像，学生站进去就 OK（不再分多步、不再查一堆条件）─────
// 人像大小是照「所有动作都放得下」算好的：高度 ≤ 画面宽度×0.8（趴下时身体横过来的长度），竖放手机约占画面高 45%，横放约 80%。
// 坐标是 MediaPipe 原始画面（未镜像）。画面给学生看时是镜像的，所以：
//   原始 x 偏小（原始画面左侧）＝ 学生自己的「右手边」；原始 x 偏大＝学生自己的「左手边」。
//   人在人像的原始左侧（minX/中心偏小）→ 学生站得太靠自己的右边 → 要「往你的左边移」（kind 'left'）；偏大 → 「往你的右边移」。
// 箭头方向：镜像画面上，学生自己的左边 = 屏幕的左边，所以「往你的左边移」箭头指向屏幕左边「←」；「往你的右边移」＝「→」。
//   一致性：原始 x 偏小的人，在镜像屏幕上出现在偏右，箭头 ← 正好把他指回人像。
export const POS = {
  VIS: 0.3,                 // 站位检查对关键点用较低门槛（远处 visibility 常偏低）
  LEN_RATIO: 0.8,           // 人像高度（像素）≤ 画面宽度（像素）× 0.8
  MAX_H_FRAC: 0.8,          // 人像高度不超过画面高度的 80%
  ASPECT: 300 / 420,        // 人像（海星大字形）宽高比
  MARGIN: 0.06,             // 站位容许超出人像的宽容度（占画面比例）
  MIN_FILL: 0.5,            // 学生身体高度至少是人像高度的一半（太小＝离太远）
  CENTER_TOL: 0.12,
  SMOOTH_FRAMES: 8,
};
export const POS_HOLD_MS = 1000;
export const HINTS = {
  left: '往你的左边移一点', right: '往你的右边移一点', back: '再退后一点',
  closer: '再往前一点，站进人像里', none: '站到人像里面，让全身都在框里',
  ok: '位置刚刚好，稳住', slipper: '回到拖鞋记号的位置', shootOk: '对了！稳住不要动',
};
/** 学生看屏幕（镜像）时箭头指向哪边。只有 left / right 两种 hint 有箭头。 */
export function arrowDir(kind) { return kind === 'left' ? 'left' : kind === 'right' ? 'right' : null; }

/** 人像的位置（原始视频的 0–1 坐标）：画面正中，大小按上面的规则算。 */
export function silhouetteBox(videoW = 1, videoH = 1) {
  const hf = Math.min(POS.MAX_H_FRAC, (POS.LEN_RATIO * videoW) / videoH);
  const wf = (POS.ASPECT * hf * videoH) / videoW;
  return { x0: 0.5 - wf / 2, x1: 0.5 + wf / 2, y0: 0.5 - hf / 2, y1: 0.5 + hf / 2 };
}

const NONE = (box) => ({ ok: false, hint: HINTS.none, kind: 'closer', checks: { body: false, center: false, far: false }, diag: { box, bbox: null } });
const BODY_PTS = [0, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28];

/** checkPosition(landmarks, videoW, videoH) → {ok, hint, kind, checks:{body,center,far}, diag}。
 *  通过条件（刻意宽松）：看得到鼻子和髋、至少一个膝或踝；所有看得到的点围成的外框，落在人像（加宽容度）里，且身高至少是人像的一半。 */
export function checkPosition(lm, videoW = 1, videoH = 1) {
  const box = silhouetteBox(videoW, videoH);
  if (!lm || lm.length < 29) return NONE(box);
  const v = (i) => (lm[i] ? lm[i].visibility ?? 1 : 0), sv = (i) => v(i) >= POS.VIS;
  const pts = BODY_PTS.filter(sv).map((i) => lm[i]);
  const hasLow = sv(25) || sv(26) || sv(27) || sv(28);
  if (!sv(0) || !(sv(23) || sv(24)) || !hasLow || pts.length < 4) return NONE(box);
  const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
  const bbox = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const bh = bbox.maxY - bbox.minY, boxH = box.y1 - box.y0, cx = (bbox.minX + bbox.maxX) / 2, bcx = (box.x0 + box.x1) / 2, m = POS.MARGIN;
  const tooTall = bbox.minY < box.y0 - m || bbox.maxY > box.y1 + m;
  const tooSmall = bh < POS.MIN_FILL * boxH;
  const outL = bbox.minX < box.x0 - m, outR = bbox.maxX > box.x1 + m;
  const offL = cx < bcx - POS.CENTER_TOL, offR = cx > bcx + POS.CENTER_TOL;
  const flags = { tooTall, tooSmall, outL, outR, offL, offR, fill: bh / boxH };
  const checks = { body: !tooTall, center: !(outL || outR || offL || offR), far: !tooTall && !tooSmall };
  const out = (ok, kind, hint) => ({ ok, kind, hint, checks, diag: { box, bbox, flags, vis: { nose: v(0), shL: v(11), shR: v(12), wrL: v(15), wrR: v(16), hipL: v(23), hipR: v(24), anL: v(27), anR: v(28) } } });
  if (tooTall) return out(false, 'back', HINTS.back);
  if (tooSmall) return out(false, 'closer', HINTS.closer);
  if (outL || offL) return out(false, 'left', HINTS.left);     // 原始左侧偏出 = 学生自己的右边偏出 → 往自己的左边移
  if (outR || offR) return out(false, 'right', HINTS.right);
  return out(true, 'ok', HINTS.ok);
}

/** 站位结果的最近 n 帧平滑：ok 取多数；没过时取出现最多的问题（平手以最新为准）；三个勾各自取多数。 */
export function createPosSmoother(n = POS.SMOOTH_FRAMES) {
  const buf = [];
  return {
    push(r) {
      buf.push(r); if (buf.length > n) buf.shift();
      const okCount = buf.filter((x) => x.ok).length;
      const last = buf[buf.length - 1];
      let base, ok;
      if (okCount * 2 > buf.length) { ok = true; base = [...buf].reverse().find((x) => x.ok); } else {
        ok = false;
        const cnt = {}; for (const x of buf) if (!x.ok) cnt[x.kind] = (cnt[x.kind] || 0) + 1;
        let best = null; for (const k of Object.keys(cnt)) if (best === null || cnt[k] > cnt[best] || (cnt[k] === cnt[best] && k === last.kind)) best = k;
        base = [...buf].reverse().find((x) => !x.ok && x.kind === best);
      }
      const maj = (key) => buf.filter((x) => x.checks[key]).length * 2 > buf.length;
      return { ...base, ok, checks: { body: maj('body'), center: maj('center'), far: maj('far') }, diag: last.diag };
    },
    reset() { buf.length = 0; },
  };
}

// 所有会被念出来的 hint（classify 的字面句子 + 站位句子）：gen-voice.py 全部预录；test-poses.mjs 会扫源码确认没有漏的。
export const ALL_HINTS = [
  FAR_HINT, '再蹲低一点点', '膝盖再弯多一点', '双手要举到框里来', '双手再举高一点', '手臂伸直', '身体站直', '把一只脚抬高一点', '双手打开', '双手再打开一点',
  '身体趴低，背部放平', '双手撑在肩膀下面', '把一只脚往后抬直', '双手举高过肩膀', '双手张开多一点', '双脚张开多一点', '身体趴低，打直', '屁股不要翘起或掉下来',
  '双手撑在肩膀下面，手臂伸直', '双手举过头', '身体往旁边弯', '弯一点点就好',
  HINTS.left, HINTS.right, HINTS.back, HINTS.closer, HINTS.none, HINTS.ok, HINTS.slipper, HINTS.shootOk,
];
