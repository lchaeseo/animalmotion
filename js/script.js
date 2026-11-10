/* ============================================================
   ANIMAL MOTION STUDY — 바다거북 헤엄
   1) 마우스를 따라 헤엄 (방향 전환, 기울기, 속도에 따라 지느러미 속도 변화)
   2) 바다 배경 클릭 → 거북이가 그쪽으로 대시 + 물방울 + 해초가 출렁
   3) 거북이 클릭 → 한 바퀴 회전 묘기
   4) 거북이가 해초 근처를 지나가면 해초가 밀려남
   ============================================================ */

const poster = document.querySelector(".poster");
const wrapper = document.getElementById("turtleWrapper");
const tiltEl = document.getElementById("turtleTilt");
const flipEl = document.getElementById("turtleFlip");
const rollEl = document.getElementById("turtleRoll");
const turtleEl = document.getElementById("turtle");

const SEABED_H = 70; // style.css의 --seabed-h 와 같은 값

let W = window.innerWidth;
let H = window.innerHeight;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ------------------------------------------------------------
   해초 만들기
   마디(div)를 안에 안에 겹쳐 넣고, 마디마다 시간차를 줘서 흔들면
   끝으로 갈수록 물결이 전달되는 것처럼 보인다.
------------------------------------------------------------ */

const weeds = [];

function makeWeed(layer, cfg) {
  const root = document.createElement("div");
  root.className = "seaweed";
  root.style.left = `calc(${cfg.frac * 100}% - ${cfg.width / 2}px)`;
  root.style.width = cfg.width + "px";
  root.style.height = cfg.segH + "px";
  root.style.opacity = cfg.opacity;
  root.style.setProperty("--dur", cfg.dur + "s");
  root.style.setProperty("--amp", cfg.amp + "deg");

  let parent = root;
  let parentW = cfg.width;

  for (let i = 0; i < cfg.segs; i++) {
    const w = cfg.width * (1 - i * 0.09); // 끝으로 갈수록 가늘게
    const seg = document.createElement("div");
    seg.className = "weed-seg";
    seg.style.width = w + "px";
    seg.style.height = cfg.segH + "px";
    seg.style.left = (parentW - w) / 2 + "px";
    seg.style.bottom = i === 0 ? "0" : "calc(100% - 8px)";
    seg.style.setProperty("--i", i);
    seg.style.background = `hsl(${cfg.hue} ${cfg.sat}% ${cfg.light + i * 1.8}%)`;
    parent.appendChild(seg);
    parent = seg;
    parentW = w;
  }

  layer.appendChild(root);
  weeds.push({
    el: root,
    frac: cfg.frac,
    h: cfg.segs * (cfg.segH - 8) + 8,
    x: 0,
    top: 0,
    angle: 0,
    vel: 0,
  });
}

function buildSeaweed() {
  const far = document.getElementById("seaweedFar");
  const near = document.getElementById("seaweedNear");

  // 뒤쪽: 작고 어둡고 흐릿하게
  for (let i = 0; i < 16; i++) {
    makeWeed(far, {
      frac: (i + rand(0.1, 0.9)) / 16,
      width: rand(14, 20),
      segH: rand(34, 44),
      segs: Math.round(rand(5, 7)),
      hue: rand(150, 175),
      sat: 45,
      light: 30,
      opacity: 0.65,
      dur: rand(4.5, 7),
      amp: rand(3, 6),
    });
  }

  // 앞쪽: 크고 선명하게
  for (let i = 0; i < 9; i++) {
    makeWeed(near, {
      frac: (i + rand(0.15, 0.85)) / 9,
      width: rand(20, 28),
      segH: rand(42, 56),
      segs: Math.round(rand(5, 8)),
      hue: rand(115, 150),
      sat: 50,
      light: 36,
      opacity: 0.95,
      dur: rand(3.4, 5.5),
      amp: rand(4, 8),
    });
  }
}

function measureWeeds() {
  W = window.innerWidth;
  H = window.innerHeight;
  weeds.forEach((w) => {
    w.x = w.frac * W;
    w.top = H - SEABED_H - w.h;
  });
}

/* ------------------------------------------------------------
   물방울 / 파문
------------------------------------------------------------ */

function bubble(x, y, size, dx, dur) {
  const el = document.createElement("div");
  el.className = "bubble";
  el.style.left = x - size / 2 + "px";
  el.style.top = y - size / 2 + "px";
  el.style.width = size + "px";
  el.style.height = size + "px";
  el.style.setProperty("--dx", dx + "px");
  el.style.setProperty("--d", dur + "s");
  el.addEventListener("animationend", () => el.remove());
  poster.appendChild(el);
}

function burst(x, y, count, spread) {
  for (let i = 0; i < count; i++) {
    bubble(
      x + rand(-spread, spread),
      y + rand(-spread / 2, spread / 2),
      rand(6, 22),
      rand(-40, 40),
      rand(1.6, 3),
    );
  }
}

function ripple(x, y) {
  const el = document.createElement("div");
  el.className = "ripple";
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.addEventListener("animationend", () => el.remove());
  poster.appendChild(el);
}

/* ------------------------------------------------------------
   거북이 상태
------------------------------------------------------------ */

const mouse = { x: W / 2, y: H / 2 };
const pos = { x: W / 2, y: H / 2 };
const vel = { x: 0, y: 0 };

let lastMove = performance.now();
let facing = 1; // 1: 오른쪽, -1: 왼쪽
let flipScale = 1; // 1 ↔ -1 사이를 부드럽게 (뒤집히는 중에는 몸이 납작해져 '턴'처럼 보임)
let tiltAngle = 0;
let rate = 0.8; // 지느러미 애니메이션 재생 속도
let appliedRate = 0;
let dashUntil = 0;
let lastTrail = 0;
let lastAmbient = 0;
let anims = null;

/* ------------------------------------------------------------
   이벤트
------------------------------------------------------------ */

document.addEventListener("pointermove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  lastMove = performance.now();
});

document.addEventListener("pointerdown", (e) => {
  const now = performance.now();
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  lastMove = now;

  const onTurtle = e.target.closest && e.target.closest(".turtle");

  if (onTurtle) {
    // 거북이를 클릭 → 한 바퀴 회전 묘기
    if (!rollEl.classList.contains("rolling")) {
      rollEl.classList.add("rolling");
      rollEl.addEventListener(
        "animationend",
        () => rollEl.classList.remove("rolling"),
        { once: true },
      );
      dashUntil = now + 700;
      burst(pos.x, pos.y, 16, 70);
    }
  } else {
    // 바다를 클릭 → 그쪽으로 대시, 물방울, 파문, 해초가 출렁
    dashUntil = now + 900;
    ripple(e.clientX, e.clientY);
    burst(e.clientX, e.clientY, 10, 30);
    weeds.forEach((w) => {
      const d = w.x - e.clientX;
      w.vel += Math.tanh(d / 120) * Math.max(0, 1 - Math.abs(d) / 700) * 6;
    });
  }
});

window.addEventListener("resize", measureWeeds);

/* ------------------------------------------------------------
   메인 루프
------------------------------------------------------------ */

function frame(now) {
  // 지느러미 애니메이션들을 처음 한 번만 모아둔다 (재생 속도를 부드럽게 바꾸기 위해)
  if (!anims) anims = turtleEl.getAnimations({ subtree: true });

  const idle = now - lastMove > 2500;
  const dashing = now < dashUntil;

  // 목표 지점: 마우스. 마우스가 멈춰 있으면 그 주변을 한가롭게 맴돈다
  let tx = mouse.x;
  let ty = mouse.y;
  if (idle) {
    tx += Math.cos(now / 1400) * 70;
    ty += Math.sin(now / 1100) * 35;
  }

  const follow = dashing ? 0.12 : 0.035;
  const px = pos.x;
  const py = pos.y;
  pos.x += (tx - pos.x) * follow;
  pos.y += (ty - pos.y) * follow;

  vel.x += (pos.x - px - vel.x) * 0.2;
  vel.y += (pos.y - py - vel.y) * 0.2;
  const speed = Math.hypot(vel.x, vel.y);

  // 방향: 가는 쪽을 바라본다
  if (Math.abs(vel.x) > 0.4) facing = vel.x > 0 ? 1 : -1;
  flipScale += (facing - flipScale) * 0.12;

  // 기울기: 위/아래로 가면 머리를 그쪽으로
  const raw = Math.atan2(vel.y, Math.max(Math.abs(vel.x), 0.0001));
  const strength = Math.min(1, speed / 1.5);
  const targetTilt = clamp((raw * 180) / Math.PI, -40, 40) * facing * strength;
  tiltAngle += (targetTilt - tiltAngle) * 0.08;

  wrapper.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
  tiltEl.style.transform = `rotate(${tiltAngle}deg)`;
  flipEl.style.transform = `scaleX(${flipScale})`;

  // 속도에 따라 지느러미를 빠르게 / 느리게
  const targetRate = dashing ? 3 : clamp(0.75 + speed * 0.3, 0.75, 2.4);
  rate += (targetRate - rate) * 0.1;
  if (Math.abs(rate - appliedRate) > 0.02) {
    anims.forEach((a) => (a.playbackRate = rate));
    appliedRate = rate;
  }

  // 빠르게 헤엄치면 머리 앞에서 물방울이 나옴, 대시 중에는 꼬리 쪽에서 더 많이
  if (speed > 3 && now - lastTrail > (dashing ? 90 : 260)) {
    lastTrail = now;
    const hx = pos.x + facing * 120 * 0.85;
    bubble(
      hx,
      pos.y + rand(-12, 12),
      rand(5, 12),
      rand(-15, 15),
      rand(1.4, 2.2),
    );
  }

  // 가끔 바닥에서 올라오는 물방울
  if (now - lastAmbient > 1800) {
    lastAmbient = now;
    bubble(rand(0, W), H - SEABED_H, rand(5, 12), rand(-25, 25), rand(3, 5));
  }

  // 해초: 거북이가 가까이 지나가면 밀려남. 스프링이라 놓으면 출렁출렁 돌아온다
  weeds.forEach((w) => {
    const dx = w.x - pos.x;
    const near = Math.max(0, 1 - Math.abs(dx) / 260);
    const lowEnough = clamp((pos.y - (w.top - 40)) / 80, 0, 1);
    const target = Math.tanh(dx / 40) * near * lowEnough * 26;

    w.vel += (target - w.angle) * 0.06;
    w.vel *= 0.88;
    w.angle += w.vel;
    w.el.style.setProperty("--push", w.angle.toFixed(2) + "deg");
  });

  requestAnimationFrame(frame);
}

buildSeaweed();
measureWeeds();
requestAnimationFrame(frame);
