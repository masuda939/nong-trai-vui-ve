/* ============================================================
   NÔNG TRẠI VUI VẺ 3D — game nông trại lấy cảm hứng Stardew Valley
   Three.js + Supabase (auth + lưu tiến trình theo tài khoản)
   Hỗ trợ đầy đủ điện thoại: joystick ảo + nút bấm trên màn hình
   ============================================================ */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

/* ---------- Hằng số logic (giữ nguyên schema save cũ) ---------- */
const TILE = 40, COLS = 24, ROWS = 15;       // toạ độ logic (px)
const W = COLS * TILE, H = ROWS * TILE;
const T3 = 2;                                 // kích thước 1 ô trong thế giới 3D
const PLAYER_SPEED = 2.6;                     // px logic / frame
const ENERGY = { till: 4, water: 2, plant: 3, harvest: 2 };
const START_GOLD = 500;

const CROPS = {
  turnip:  { name: "Củ cải",  emoji: "🥬", seedCost: 20,  sell: 40,  days: 2, xp: 4,  level: 1, color: 0xe8e8f5, leaf: 0x7ec850 },
  potato:  { name: "Khoai tây", emoji: "🥔", seedCost: 45,  sell: 95,  days: 4, xp: 9,  level: 2, color: 0xc9a15f, leaf: 0x5da23f },
  corn:    { name: "Ngô",     emoji: "🌽", seedCost: 80,  sell: 170, days: 6, xp: 16, level: 3, color: 0xf5c542, leaf: 0x4c8a35 },
  tomato:  { name: "Cà chua", emoji: "🍅", seedCost: 120, sell: 95,  days: 7, xp: 22, level: 4, color: 0xe04b3a, leaf: 0x3f7a2e, regrow: 3 },
  pumpkin: { name: "Bí ngô",  emoji: "🎃", seedCost: 220, sell: 420, days: 9, xp: 40, level: 5, color: 0xe88b1a, leaf: 0x3a6d28 },
};
const CROP_IDS = Object.keys(CROPS);
const TOOLS = [
  { id: "hoe",   emoji: "⛏️", name: "Cuốc" },
  { id: "water", emoji: "💧", name: "Bình tưới" },
  ...CROP_IDS.map((id) => ({ id: "seed_" + id, emoji: CROPS[id].emoji, name: "Hạt " + CROPS[id].name, seed: id })),
];

const HOUSE = { x: 1, y: 1, w: 5, h: 4 };
const SHOP  = { x: 18, y: 1, w: 4, h: 3 };
const POND  = { x: 10, y: 2, w: 5, h: 3 };
const FARM  = { x: 3, y: 6, w: 18, h: 7 };
const DOOR  = { x: 3, y: 4 };
const SHOP_COUNTER = { x: 19, y: 4 };

function inRect(x, y, r) { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; }
function isSolid(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  return inRect(x, y, HOUSE) || inRect(x, y, SHOP) || inRect(x, y, POND);
}
function isFarmTile(x, y) { return inRect(x, y, FARM) && !inRect(x, y, POND); }

/* ---------- Trạng thái game ---------- */
let S = null;
function freshState() {
  return {
    v: 1, gold: START_GOLD, level: 1, xp: 0, day: 1, energy: 100,
    inv: { seed_turnip: 6 }, tiles: {}, px: 8 * TILE, py: 8 * TILE,
  };
}
const xpNeed = (lv) => lv * 50;

/* ---------- Tiện ích DOM ---------- */
const $ = (id) => document.getElementById(id);
let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 1800);
}
function slotAvailable(i) {
  const t = TOOLS[i];
  return !t.seed || (S && (S.inv["seed_" + t.seed] || 0) > 0);
}

/* ============================================================
   SUPABASE — xác thực & lưu game
   ============================================================ */
let sb = null;
let currentUser = null;

function supabaseConfigured() {
  const c = window.SUPABASE_CONFIG || {};
  return typeof c.url === "string" && /^https?:\/\/.+\.supabase\.(co|in)/.test(c.url) &&
    typeof c.anonKey === "string" && c.anonKey.length > 20 && !c.url.includes("YOUR-PROJECT");
}
function initSupabase() {
  if (!supabaseConfigured()) {
    $("cloud-status").textContent = "⚠️ Chưa cấu hình Supabase — chơi chế độ khách (lưu trên máy này).";
    $("cloud-status").style.color = "#e8c76a";
    return;
  }
  try {
    sb = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    $("cloud-status").textContent = "☁️ Đã kết nối Supabase — tạo tài khoản để lưu tiến trình!";
    sb.auth.getSession().then(({ data }) => { if (data?.session?.user) onSignedIn(data.session.user); });
    sb.auth.onAuthStateChange((_ev, session) => {
      if (session?.user && (!currentUser || currentUser.id !== session.user.id)) onSignedIn(session.user);
    });
  } catch (err) {
    console.error("Supabase init failed:", err);
    $("cloud-status").textContent = "⚠️ Lỗi kết nối Supabase — dùng chế độ khách.";
  }
}
function authScreenVisible() { return !$("auth-screen").classList.contains("hidden"); }

let authMode = "login";
function setAuthMode(m) {
  authMode = m;
  $("tab-login").classList.toggle("active", m === "login");
  $("tab-signup").classList.toggle("active", m === "signup");
  $("auth-submit").textContent = m === "login" ? "Đăng nhập" : "Tạo tài khoản & bắt đầu";
}
$("tab-login").onclick = () => setAuthMode("login");
$("tab-signup").onclick = () => setAuthMode("signup");

$("auth-submit").onclick = async () => {
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const err = $("auth-error");
  err.textContent = "";
  if (!sb) { err.textContent = "Supabase chưa được cấu hình — hãy dùng chế độ khách."; return; }
  if (!email || password.length < 6) { err.textContent = "Nhập email và mật khẩu (≥ 6 ký tự)."; return; }
  $("auth-submit").disabled = true;
  try {
    if (authMode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      const { error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      toast("Tài khoản đã tạo!");
    }
  } catch (e) { err.textContent = translateAuthError(e.message); }
  finally { $("auth-submit").disabled = false; }
};
function translateAuthError(msg) {
  if (/invalid login/i.test(msg)) return "Sai email hoặc mật khẩu.";
  if (/already registered/i.test(msg)) return "Email này đã được đăng ký — hãy đăng nhập.";
  if (/rate/i.test(msg)) return "Thử lại sau ít phút nhé (quá nhiều lần thử).";
  if (/valid email/i.test(msg)) return "Email không hợp lệ.";
  if (/at least 6/i.test(msg)) return "Mật khẩu cần tối thiểu 6 ký tự.";
  return msg;
}

$("auth-guest").onclick = () => { currentUser = null; startGame(loadLocal() || freshState()); };
$("btn-logout").onclick = async () => {
  if (sb) { try { await saveGame(true); await sb.auth.signOut(); } catch (_) {} }
  location.reload();
};

function onSignedIn(user) {
  currentUser = { id: user.id, email: user.email };
  $("auth-screen").classList.add("hidden");
  loadCloud().then((state) => {
    if (state) { S = state; toast("Đã tải tiến trình của bạn!"); }
    else { S = freshState(); toast("Chào mừng đến với nông trại mới!"); saveCloud(); }
    startGame(S);
  });
}

/* ---- Local (khách) ---- */
const LS_KEY = "farm_save_guest";
function loadLocal() {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? migrate(JSON.parse(raw)) : null; }
  catch { return null; }
}
function saveLocal() { if (!S) return; try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (_) {} }
function migrate(st) { const f = freshState(); return Object.assign(f, st, { inv: Object.assign({}, st.inv || {}) }); }

/* ---- Cloud (Supabase) ---- */
async function loadCloud() {
  if (!sb || !currentUser) return null;
  try {
    const { data, error } = await sb.from("farm_saves").select("state").eq("user_id", currentUser.id).maybeSingle();
    if (error) { console.warn("loadCloud:", error.message); return null; }
    return data?.state ? migrate(data.state) : null;
  } catch (e) { console.warn(e); return null; }
}
async function saveCloud() {
  if (!sb || !currentUser || !S) return false;
  try {
    const { error } = await sb.from("farm_saves").upsert({ user_id: currentUser.id, state: S, updated_at: new Date().toISOString() });
    if (error) { console.warn("saveCloud:", error.message); return false; }
    return true;
  } catch (e) { console.warn(e); return false; }
}
async function saveGame(manual = false) {
  if (!S) return;
  saveLocal();
  const ok = await saveCloud();
  if (manual) {
    const ind = $("save-indicator");
    ind.textContent = ok ? "💾 Đã lưu lên cloud" : (currentUser ? "⚠️ Lưu cloud thất bại (đã lưu trên máy)" : "💾 Đã lưu (chế độ khách)");
    ind.classList.remove("hidden");
    setTimeout(() => ind.classList.add("hidden"), 1600);
  }
}
setInterval(() => { if (!authScreenVisible()) saveGame(); }, 20000);
window.addEventListener("beforeunload", () => { saveLocal(); });

/* ============================================================
   THREE.JS — dựng cảnh 3D
   ============================================================ */
const canvas = $("game-canvas");
let renderer, scene, camera, dirLight;
let playerGroup, highlightMesh, camDist = 16;
const plotMeshes = new Map();   // "x,y" -> {group, soilMat, cropKey}
const labelSprites = [];
let clock = new THREE.Clock();

const w2x = (px) => (px / TILE - COLS / 2 + 0.5) * T3;   // px logic -> world x
const w2z = (py) => (py / TILE - ROWS / 2 + 0.5) * T3;   // py logic -> world z
const t2x = (tx) => (tx - COLS / 2 + 0.5) * T3;
const t2z = (ty) => (ty - ROWS / 2 + 0.5) * T3;

function initThree() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 34, 95);

  camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 300);

  // Ánh sáng
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5a7a3a, 1.0);
  scene.add(hemi);
  dirLight = new THREE.DirectionalLight(0xfff3d6, 1.6);
  dirLight.position.set(14, 24, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.left = -40; dirLight.shadow.camera.right = 40;
  dirLight.shadow.camera.top = 40; dirLight.shadow.camera.bottom = -40;
  scene.add(dirLight);

  // Mặt đất cỏ
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS * T3 + 30, ROWS * T3 + 30),
    new THREE.MeshLambertMaterial({ color: 0x6aa84f })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Vùng ruộng (tint đất)
  const farmPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(FARM.w * T3, FARM.h * T3),
    new THREE.MeshLambertMaterial({ color: 0x8f9a4e })
  );
  farmPatch.rotation.x = -Math.PI / 2;
  farmPatch.position.set(
    (FARM.x + FARM.w / 2 - COLS / 2) * T3, 0.01,
    (FARM.y + FARM.h / 2 - ROWS / 2) * T3
  );
  farmPatch.receiveShadow = true;
  scene.add(farmPatch);

  // Ao
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(POND.w * T3 / 2, 24),
    new THREE.MeshLambertMaterial({ color: 0x4a90d9 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(
    (POND.x + POND.w / 2 - COLS / 2) * T3, 0.03,
    (POND.y + POND.h / 2 - ROWS / 2) * T3
  );
  scene.add(pond);

  buildHouse();
  buildShop();
  buildPlayer();
  buildHighlight();

  onResize();
  window.addEventListener("resize", onResize);
}

function onResize() {
  const wrap = $("canvas-wrap");
  const w = wrap.clientWidth || window.innerWidth;
  const h = wrap.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function makeLabel(text, opts = {}) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  g.font = "bold 64px 'Segoe UI', sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 10; g.strokeStyle = "rgba(0,0,0,.55)";
  g.strokeText(text, 256, 64);
  g.fillStyle = opts.color || "#fff";
  g.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  spr.scale.set(opts.w || 6, (opts.w || 6) / 4, 1);
  labelSprites.push(spr);
  return spr;
}

function buildHouse() {
  const g = new THREE.Group();
  const cx = t2x(HOUSE.x + HOUSE.w / 2), cz = t2z(HOUSE.y + HOUSE.h / 2);
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(HOUSE.w * T3 - 1, 3.2, HOUSE.h * T3 - 1),
    new THREE.MeshLambertMaterial({ color: 0xb5651d })
  );
  walls.position.y = 1.6;
  walls.castShadow = true; walls.receiveShadow = true;
  g.add(walls);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(HOUSE.w * T3 * 0.78, 2.6, 4),
    new THREE.MeshLambertMaterial({ color: 0x8b3a1a })
  );
  roof.position.y = 4.4; roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.9, 0.25),
    new THREE.MeshLambertMaterial({ color: 0x5a3a1a })
  );
  door.position.set(0, 0.95, (HOUSE.h * T3 - 1) / 2);
  g.add(door);
  const label = makeLabel("🏠 Nhà của bạn");
  label.position.set(0, 6.4, 0);
  g.add(label);
  g.position.set(cx, 0, cz);
  scene.add(g);
}

function buildShop() {
  const g = new THREE.Group();
  const cx = t2x(SHOP.x + SHOP.w / 2), cz = t2z(SHOP.y + SHOP.h / 2);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(SHOP.w * T3 - 1, 2.6, SHOP.h * T3 - 1),
    new THREE.MeshLambertMaterial({ color: 0x7a5230 })
  );
  body.position.y = 1.3;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(SHOP.w * T3 + 0.6, 0.35, SHOP.h * T3 * 0.8),
    new THREE.MeshLambertMaterial({ color: 0xd9534f })
  );
  awning.position.set(0, 3.1, 0.9);
  awning.rotation.x = -0.25;
  awning.castShadow = true;
  g.add(awning);
  // Quầy bán hàng
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1, 1.1),
    new THREE.MeshLambertMaterial({ color: 0xa0713f })
  );
  counter.position.set(-1.5, 0.5, (SHOP.h * T3 - 1) / 2 + 1);
  counter.castShadow = true;
  g.add(counter);
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.12, 20),
    new THREE.MeshLambertMaterial({ color: 0xf5c542 })
  );
  coin.rotation.x = Math.PI / 2;
  coin.position.set(-1.5, 1.25, (SHOP.h * T3 - 1) / 2 + 1);
  g.add(coin);
  const label = makeLabel("🏪 CỬA HÀNG");
  label.position.set(0, 5.6, 0);
  g.add(label);
  g.position.set(cx, 0, cz);
  scene.add(g);
}

function buildPlayer() {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  // thân
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), mat(0xe04b3a));
  body.position.y = 1.05; body.castShadow = true;
  g.add(body);
  // chân
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 0.3), mat(0x3a5a8a));
  legL.position.set(-0.2, 0.28, 0); legL.castShadow = true;
  const legR = legL.clone(); legR.position.x = 0.2;
  g.add(legL, legR);
  g.userData.legs = [legL, legR];
  // đầu
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat(0xf0c8a0));
  head.position.y = 1.95; head.castShadow = true;
  g.add(head);
  // mũ
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 16), mat(0xf5c542));
  brim.position.y = 2.22;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.3, 16), mat(0xf5c542));
  top.position.y = 2.38;
  g.add(brim, top);
  playerGroup = g;
  scene.add(g);
}

function buildHighlight() {
  const geo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(T3 * 0.94, T3 * 0.94));
  highlightMesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  highlightMesh.rotation.x = -Math.PI / 2;
  scene.add(highlightMesh);
}

/* --- Ô ruộng & cây trong 3D --- */
function cropKey(c) { return c ? c.id + "|" + c.stage + "|" + (c.w ? 1 : 0) : "none"; }

function syncPlots() {
  if (!S) return;
  const seen = new Set();
  for (const k in S.tiles) {
    seen.add(k);
    const t = S.tiles[k];
    const [x, y] = k.split(",").map(Number);
    let entry = plotMeshes.get(k);
    if (!entry) {
      const group = new THREE.Group();
      const soilMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
      const soil = new THREE.Mesh(new THREE.BoxGeometry(T3 * 0.92, 0.22, T3 * 0.92), soilMat);
      soil.position.y = 0.11;
      soil.receiveShadow = true;
      group.add(soil);
      const cropHolder = new THREE.Group();
      group.add(cropHolder);
      entry = { group, soilMat, cropHolder, lastKey: "" };
      group.position.set(t2x(x), 0, t2z(y));
      scene.add(group);
      plotMeshes.set(k, entry);
    }
    entry.soilMat.color.setHex(t.w ? 0x5b3a1e : 0x8a5a2b);
    const key = cropKey(t.c);
    if (key !== entry.lastKey) {
      entry.lastKey = key;
      buildCropMesh(entry.cropHolder, t.c);
    }
  }
  // dọn ô không còn trong state (hiếm)
  for (const k of [...plotMeshes.keys()]) {
    if (!seen.has(k)) {
      scene.remove(plotMeshes.get(k).group);
      plotMeshes.delete(k);
    }
  }
}

function buildCropMesh(holder, c) {
  // Xoá cây cũ
  while (holder.children.length) {
    const ch = holder.children.pop();
    ch.traverse?.((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }
  if (!c) return;
  const def = CROPS[c.id];
  const ready = c.stage >= def.days;
  const mat = (col) => new THREE.MeshLambertMaterial({ color: col });
  if (ready) {
    const leafBall = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), mat(def.leaf));
    leafBall.position.y = 0.75; leafBall.castShadow = true;
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat(def.color));
    fruit.position.y = 1.15; fruit.castShadow = true;
    holder.add(leafBall, fruit);
  } else {
    const prog = c.stage / def.days;
    const stemH = 0.3 + prog * 0.9;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, stemH, 6), mat(def.leaf));
    stem.position.y = stemH / 2 + 0.1;
    const leafSize = 0.14 + prog * 0.22;
    const leafL = new THREE.Mesh(new THREE.SphereGeometry(leafSize, 8, 6), mat(def.leaf));
    leafL.position.set(-leafSize, stemH + 0.05, 0);
    leafL.scale.set(1.4, 0.6, 1);
    const leafR = leafL.clone(); leafR.position.x = leafSize;
    holder.add(stem, leafL, leafR);
  }
  if (c.w && !ready) {
    const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshLambertMaterial({ color: 0x6ec6ff, transparent: true, opacity: 0.9 }));
    drop.position.y = 1.9;
    holder.add(drop);
  }
}

/* ============================================================
   INPUT — bàn phím + cảm ứng (joystick ảo)
   ============================================================ */
const keys = {};
let selectedSlot = 0;
let facing = { dx: 0, dy: 1 };
const joy = { active: false, x: 0, y: 0, id: null };
let pinchStart = null;

window.addEventListener("keydown", (e) => {
  if (authScreenVisible()) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  if (k >= "1" && k <= "7") {
    const i = parseInt(k) - 1;
    if (i < TOOLS.length && slotAvailable(i)) { selectedSlot = i; renderToolbar(); }
  }
  if (k === " " || k === "e") doAction();
  if (k === "b") togglePanel("shop-panel");
  if (k === "q") togglePanel("bag-panel");
  if (k === "enter") trySleep();
  if (e.ctrlKey && k === "s") { e.preventDefault(); saveGame(true); }
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

/* Joystick ảo */
const joyBase = $("joystick"), joyKnob = $("joystick-knob");
function joyFromTouch(t) {
  const rect = joyBase.getBoundingClientRect();
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  let dx = t.clientX - cx, dy = t.clientY - cy;
  const max = rect.width / 2;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = dx / len * max; dy = dy / len * max; }
  joy.x = dx / max; joy.y = dy / max;
  joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
function joyEnd() {
  joy.active = false; joy.x = 0; joy.y = 0; joy.id = null;
  joyKnob.style.transform = "translate(-50%, -50%)";
}
joyBase.addEventListener("touchstart", (e) => {
  e.preventDefault();
  joy.active = true; joy.id = e.changedTouches[0].identifier;
  joyFromTouch(e.changedTouches[0]);
}, { passive: false });
window.addEventListener("touchmove", (e) => {
  if (!joy.active) return;
  const t = [...e.changedTouches].find((x) => x.identifier === joy.id);
  if (t) { e.preventDefault(); joyFromTouch(t); }
}, { passive: false });
window.addEventListener("touchend", (e) => {
  const t = [...e.changedTouches].find((x) => x.identifier === joy.id);
  if (t) joyEnd();
});
window.addEventListener("touchcancel", joyEnd);

/* Pinch zoom + wheel zoom */
canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2) {
    pinchStart = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
  }
}, { passive: true });
canvas.addEventListener("touchmove", (e) => {
  if (pinchStart && e.touches.length === 2) {
    e.preventDefault();
    const d = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    camDist = Math.min(30, Math.max(8, camDist * (pinchStart / d)));
    pinchStart = d;
  }
}, { passive: false });
canvas.addEventListener("touchend", () => { pinchStart = null; });
canvas.addEventListener("wheel", (e) => {
  camDist = Math.min(30, Math.max(8, camDist * (1 + Math.sign(e.deltaY) * 0.1)));
}, { passive: true });

/* Nút cảm ứng */
$("btn-action").addEventListener("click", () => doAction());
$("btn-shop-m").addEventListener("click", () => togglePanel("shop-panel"));
$("btn-bag-m").addEventListener("click", () => togglePanel("bag-panel"));
$("btn-sleep-m").addEventListener("click", () => trySleep());
$("btn-save-m").addEventListener("click", () => saveGame(true));

/* ============================================================
   VÒNG LẶP GAME
   ============================================================ */
let lastT = 0, started = false;
function loop(t) {
  const dt = Math.min((t - lastT) / 16.67, 3); lastT = t;
  update(dt);
  renderFrame();
  requestAnimationFrame(loop);
}

function update(dt) {
  let ix = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
  let iy = (keys["s"] || keys["arrowdown"] ? 1 : 0) - (keys["w"] || keys["arrowup"] ? 1 : 0);
  if (joy.active && Math.hypot(joy.x, joy.y) > 0.18) { ix = joy.x; iy = joy.y; }
  if (ix || iy) {
    const len = Math.hypot(ix, iy);
    ix /= Math.max(len, 1); iy /= Math.max(len, 1);
    facing = Math.abs(ix) > Math.abs(iy) ? { dx: Math.sign(ix), dy: 0 } : { dx: 0, dy: Math.sign(iy) };
    tryMove(ix * PLAYER_SPEED * dt, iy * PLAYER_SPEED * dt);
    playerGroup.userData.moving = true;
  } else playerGroup.userData.moving = false;
}

function tryMove(mx, my) {
  const r = 12;
  const nx = S.px + mx, ny = S.py + my;
  if (!collides(nx + Math.sign(mx) * r, S.py)) S.px = nx;
  if (!collides(S.px, ny + Math.sign(my) * r)) S.py = ny;
}
function collides(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return isSolid(tx, ty);
}

function facingTile() {
  const cx = Math.floor((S.px + TILE / 2) / TILE);
  const cy = Math.floor((S.py + TILE / 2) / TILE);
  return { x: cx + facing.dx, y: cy + facing.dy };
}
function keyOf(x, y) { return x + "," + y; }

/* ============================================================
   HÀNH ĐỘNG (cuốc / trồng / tưới / thu hoạch)
   ============================================================ */
function doAction() {
  if (!S || authScreenVisible()) return;
  const { x, y } = facingTile();
  const k = keyOf(x, y);
  const tool = TOOLS[selectedSlot];
  const tile = S.tiles[k];

  if (tile?.c && cropReady(tile.c)) { harvest(tile); return; }
  if (Math.abs(x - DOOR.x) <= 1 && Math.abs(y - DOOR.y) <= 1) { togglePanel("sleep-panel"); return; }
  if (Math.abs(x - SHOP_COUNTER.x) <= 1 && Math.abs(y - SHOP_COUNTER.y) <= 1) { togglePanel("shop-panel"); return; }
  if (!isFarmTile(x, y)) { toast("Chỉ canh tác được trên đất ruộng!"); return; }
  if (S.energy <= 0) { toast("Quá mệt rồi! Hãy đi ngủ để hồi phục ⚡"); return; }

  if (tool.id === "hoe") {
    if (tile?.t) { toast("Đất đã được cuốc rồi."); return; }
    if (tile?.c) return;
    S.tiles[k] = { t: 1, w: 0, c: null };
    useEnergy(ENERGY.till); sfx("till");
  } else if (tool.id === "water") {
    if (!tile?.t) { toast("Cần cuốc đất trước đã!"); return; }
    if (tile.w) { toast("Đã tưới nước rồi."); return; }
    tile.w = 1;
    if (tile.c) tile.c.w = 1;
    useEnergy(ENERGY.water); sfx("water");
  } else if (tool.seed) {
    if (!tile?.t) { toast("Cần cuốc đất trước khi gieo hạt!"); return; }
    if (tile.c) { toast("Ô này đã có cây."); return; }
    const seedKey = "seed_" + tool.seed;
    if ((S.inv[seedKey] || 0) <= 0) { toast("Hết hạt giống! Mua ở cửa hàng 🏪"); return; }
    S.inv[seedKey]--;
    S.tiles[k].c = { id: tool.seed, stage: 0, w: 0, r: 0 };
    useEnergy(ENERGY.plant); sfx("plant");
    renderToolbar();
  }
  syncPlots();
  updateHUD();
}
function cropReady(c) { return c.stage >= CROPS[c.id].days; }

function harvest(tile) {
  const def = CROPS[tile.c.id];
  if (S.energy <= 0) { toast("Quá mệt rồi! Hãy đi ngủ để hồi phục ⚡"); return; }
  const key = "crop_" + tile.c.id;
  S.inv[key] = (S.inv[key] || 0) + 1;
  gainXP(def.xp);
  if (def.regrow) { tile.c.stage = def.days - def.regrow; tile.c.w = 0; }
  else { tile.c = null; tile.w = 0; tile.t = 1; }
  useEnergy(ENERGY.harvest); sfx("harvest");
  toast("Thu hoạch được 1 " + def.name + "! (+" + def.xp + " XP)");
  syncPlots(); renderToolbar(); updateHUD();
}

function useEnergy(n) { S.energy = Math.max(0, S.energy - n); }
function gainXP(n) {
  S.xp += n;
  while (S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level);
    S.level++;
    const unlocked = CROP_IDS.filter((id) => CROPS[id].level === S.level);
    showLevelUp(S.level, unlocked);
  }
}
function showLevelUp(lv, unlocked) {
  $("levelup-num").textContent = "Cấp " + lv + "!";
  const el = $("levelup-toast");
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2600);
  if (unlocked.length) toast("🌱 Mở khóa: " + unlocked.map((id) => CROPS[id].name).join(", ") + "!");
  sfx("levelup");
}

/* ============================================================
   NGỦ QUA ĐÊM
   ============================================================ */
function trySleep() { if (!authScreenVisible()) togglePanel("sleep-panel"); }
function doSleep() {
  let grew = 0;
  for (const k in S.tiles) {
    const t = S.tiles[k];
    if (t.c && !cropReady(t.c) && t.c.w) { t.c.stage = Math.min(t.c.stage + 1, CROPS[t.c.id].days); grew++; }
    if (t.c) t.c.w = 0;
    t.w = 0;
  }
  S.day++; S.energy = 100;
  closePanels();
  toast("☀️ Ngày mới! " + (grew ? grew + " cây đã lớn lên." : "Đừng quên tưới nước!"));
  syncPlots(); saveGame(); updateHUD();
}
$("btn-sleep-confirm").onclick = doSleep;
const sleepObserver = new MutationObserver(() => {
  if (!$("sleep-panel").classList.contains("hidden") && S) {
    const ready = Object.values(S.tiles).filter((t) => t.c && cropReady(t.c)).length;
    const growing = Object.values(S.tiles).filter((t) => t.c && !cropReady(t.c)).length;
    const thirsty = Object.values(S.tiles).filter((t) => t.c && !cropReady(t.c) && !t.c.w).length;
    $("sleep-info").textContent = `Đang cây: ${growing} đang lớn, ${ready} sẵn sàng thu hoạch, ${thirsty} chưa được tưới.`;
  }
});
sleepObserver.observe($("sleep-panel"), { attributes: true });

/* ============================================================
   CỬA HÀNG & TÚI ĐỒ
   ============================================================ */
function togglePanel(id) {
  const el = $(id);
  const show = el.classList.contains("hidden");
  closePanels();
  if (show) {
    if (id === "shop-panel") renderShop();
    if (id === "bag-panel") renderBag();
    el.classList.remove("hidden");
  }
}
function closePanels() { ["shop-panel", "bag-panel", "sleep-panel"].forEach((id) => $(id).classList.add("hidden")); }
document.querySelectorAll(".panel-close").forEach((b) => (b.onclick = () => closePanels()));

function renderShop() {
  const list = $("shop-list");
  list.innerHTML = "";
  CROP_IDS.forEach((id) => {
    const c = CROPS[id];
    const locked = c.level > S.level;
    const row = document.createElement("div");
    row.className = "shop-item" + (locked ? " locked" : "");
    row.innerHTML = `
      <span class="item-emoji">${c.emoji}</span>
      <div class="grow">
        <div class="name">Hạt ${c.name}</div>
        <div class="desc">${c.days} ngày · bán ${c.sell}💰 · ${c.xp} XP ${c.regrow ? "· mọc lại 🌿" : ""}${locked ? " · 🔒 Cần Lv." + c.level : ""}</div>
      </div>
      <button class="btn btn-small" ${locked || S.gold < c.seedCost ? "disabled" : ""}>${c.seedCost}💰</button>`;
    if (!locked) row.querySelector("button").onclick = () => {
      if (S.gold < c.seedCost) { toast("Không đủ vàng!"); return; }
      S.gold -= c.seedCost;
      S.inv["seed_" + id] = (S.inv["seed_" + id] || 0) + 1;
      sfx("buy"); updateHUD(); renderToolbar(); renderShop(); saveGame();
    };
    list.appendChild(row);
  });
}

function renderBag() {
  const list = $("bag-list");
  list.innerHTML = "";
  const cropKeys = Object.keys(S.inv).filter((k) => k.startsWith("crop_") && S.inv[k] > 0);
  const seedKeys = Object.keys(S.inv).filter((k) => k.startsWith("seed_") && S.inv[k] > 0);
  if (!cropKeys.length && !seedKeys.length) {
    list.innerHTML = '<p class="muted">Túi trống trơn! Ra ruộng trồng trọt đi 🌱</p>';
    return;
  }
  cropKeys.forEach((k) => {
    const id = k.slice(5), c = CROPS[id];
    const row = document.createElement("div");
    row.className = "bag-item";
    row.innerHTML = `
      <span class="item-emoji">${c.emoji}</span>
      <div class="grow"><div class="name">${c.name} ×${S.inv[k]}</div>
      <div class="desc">Bán ${c.sell}💰/cái → tổng ${c.sell * S.inv[k]}💰</div></div>
      <button class="btn btn-small btn-primary">Bán tất cả</button>`;
    row.querySelector("button").onclick = () => {
      S.gold += c.sell * S.inv[k];
      S.inv[k] = 0;
      sfx("sell"); toast("Đã bán " + c.name + "!");
      updateHUD(); renderBag(); renderToolbar(); saveGame();
    };
    list.appendChild(row);
  });
  seedKeys.forEach((k) => {
    const id = k.slice(5), c = CROPS[id];
    const row = document.createElement("div");
    row.className = "bag-item";
    row.innerHTML = `<span class="item-emoji">${c.emoji}</span>
      <div class="grow"><div class="name">Hạt ${c.name} ×${S.inv[k]}</div><div class="desc">Dùng để gieo trồng</div></div>`;
    list.appendChild(row);
  });
}

/* ============================================================
   HUD & TOOLBAR
   ============================================================ */
function updateHUD() {
  $("hud-gold").textContent = S.gold;
  $("hud-day").textContent = S.day;
  $("hud-level").textContent = S.level;
  $("hud-energy").textContent = S.energy;
  const need = xpNeed(S.level);
  $("xp-bar").style.width = Math.min(100, (S.xp / need) * 100) + "%";
  $("xp-text").textContent = `${S.xp}/${need} XP`;
}

function renderToolbar() {
  const wrap = $("tool-slots");
  wrap.innerHTML = "";
  TOOLS.forEach((t, i) => {
    const count = t.seed ? (S.inv["seed_" + t.seed] || 0) : null;
    const div = document.createElement("div");
    div.className = "slot" + (i === selectedSlot ? " selected" : "") + (count === 0 ? " empty-slot" : "");
    div.innerHTML = `<span class="key">${i + 1}</span><span>${t.emoji}</span>${count !== null ? `<span class="count">${count}</span>` : ""}`;
    div.title = t.name;
    if (count === null || count > 0) div.onclick = () => { selectedSlot = i; renderToolbar(); };
    wrap.appendChild(div);
  });
}

/* ============================================================
   RENDER 3D
   ============================================================ */
function renderFrame() {
  const time = performance.now() / 1000;

  // Vị trí nhân vật
  const px = w2x(S.px), pz = w2z(S.py);
  playerGroup.position.set(px, 0, pz);
  playerGroup.rotation.y = Math.atan2(facing.dx, facing.dy);

  // Đi bộ: vung tay chân
  if (playerGroup.userData.moving) {
    const sw = Math.sin(time * 10) * 0.5;
    playerGroup.userData.legs[0].rotation.x = sw;
    playerGroup.userData.legs[1].rotation.x = -sw;
    playerGroup.position.y = Math.abs(Math.sin(time * 10)) * 0.12;
  } else {
    playerGroup.userData.legs[0].rotation.x = 0;
    playerGroup.userData.legs[1].rotation.x = 0;
    playerGroup.position.y = 0;
  }

  // Ô đang nhắm
  const ft = facingTile();
  highlightMesh.position.set(t2x(ft.x), 0.06, t2z(ft.y));

  // Cây trưởng thành lắc lư
  for (const [, entry] of plotMeshes) {
    const holder = entry.cropHolder;
    if (holder.children.length) {
      const ready = holder.userData?.ready;
      holder.rotation.z = ready ? Math.sin(time * 3 + holder.position.x) * 0.06 : 0;
    }
    holder.userData = holder.userData || {};
  }

  // Camera bám theo nhân vật
  const target = new THREE.Vector3(px, 1.5, pz);
  const dir = new THREE.Vector3(0, 1.35, 1).normalize();
  const desired = target.clone().add(dir.multiplyScalar(camDist));
  camera.position.lerp(desired, 0.12);
  camera.lookAt(target);

  renderer.render(scene, camera);
}

/* ============================================================
   KHỞI ĐỘNG
   ============================================================ */
function startGame(state) {
  S = state;
  $("auth-screen").classList.add("hidden");
  $("game-root").classList.remove("hidden");
  if (!started) {
    started = true;
    initThree();
    syncPlots();
    // Đặt camera ngay lần đầu
    camera.position.set(w2x(S.px), 14, w2z(S.py) + 16);
    requestAnimationFrame((t) => { lastT = t; loop(t); });
  } else {
    syncPlots();
  }
  renderToolbar();
  updateHUD();
}

initSupabase();
if (!supabaseConfigured() && loadLocal()) {
  $("cloud-status").textContent = "💾 Có tiến trình đã lưu trên máy này — chọn \"Chơi thử\" để tiếp tục.";
}

/* Âm thanh nhỏ bằng WebAudio */
let audioCtx = null;
function sfx(type) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    const map = {
      till: [180, 0.08, "square"], water: [500, 0.1, "sine"], plant: [320, 0.07, "triangle"],
      harvest: [660, 0.12, "sine"], buy: [880, 0.1, "sine"], sell: [520, 0.12, "sine"],
      levelup: [1040, 0.25, "sine"],
    };
    const m = map[type] || [440, 0.1, "sine"];
    o.type = m[2]; o.frequency.value = m[0];
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + m[1]);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + m[1]);
  } catch (_) {}
}
