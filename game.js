/* ============================================================
   NÔNG TRẠI VUI VẺ 3D — bản 2.0
   Cây có hình dạng riêng · Ao cá 3D có độ sâu · Chuồng nuôi
   Xây dựng trang trí · Three.js + Supabase
   ============================================================ */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

/* ---------- Hằng số logic (giữ schema save cũ + thêm mới) ---------- */
const TILE = 40, COLS = 28, ROWS = 18;
const T3 = 2;
const PLAYER_SPEED = 2.6;
const ENERGY = { till: 4, water: 2, plant: 3, harvest: 2, feedPond: 3, feedAnimal: 1 };
const START_GOLD = 500;
const FISH_MAX = 8;
const WATER_NEEDED = 5;   // tưới đủ 5 lần thì cây chín
const DIAMOND_PER_LEVEL = 10;

const CROPS = {
  turnip:  { name: "Củ cải",  emoji: "🥬", seedCost: 20,  sell: 40,  days: 2, xp: 4,  level: 1, leaf: 0x7ec850 },
  potato:  { name: "Khoai tây", emoji: "🥔", seedCost: 45,  sell: 95,  days: 4, xp: 9,  level: 2, leaf: 0x5da23f },
  corn:    { name: "Ngô",     emoji: "🌽", seedCost: 80,  sell: 170, days: 6, xp: 16, level: 3, leaf: 0x4c8a35 },
  tomato:  { name: "Cà chua", emoji: "🍅", seedCost: 120, sell: 95,  days: 7, xp: 22, level: 4, leaf: 0x3f7a2e },
  pumpkin: { name: "Bí ngô",  emoji: "🎃", seedCost: 220, sell: 420, days: 9, xp: 40, level: 5, leaf: 0x3a6d28 },
  carrot:  { name: "Cà rốt",  emoji: "🥕", seedCost: 150, sell: 260, days: 5, xp: 30, level: 6, leaf: 0x2f8f3a },
  strawberry: { name: "Dâu tây", emoji: "🍓", seedCost: 180, sell: 300, days: 5, xp: 35, level: 7, leaf: 0x2e7d32 },
  watermelon: { name: "Dưa hấu", emoji: "🍉", seedCost: 300, sell: 550, days: 7, xp: 55, level: 8, leaf: 0x1f6e33 },
};
const CROP_IDS = Object.keys(CROPS);

/* Cá trong ao */
const FISH = {
  ro:   { name: "Cá Rô",   emoji: "🐟", cost: 60,  sell: 160, days: 3, xp: 12, level: 1, color: 0x9ecb5a },
  carp: { name: "Cá Chép", emoji: "🐠", cost: 140, sell: 400, days: 6, xp: 32, level: 3, color: 0xd9534f },
  noc:  { name: "Cá Nóc",  emoji: "🐡", cost: 260, sell: 700, days: 8, xp: 45, level: 5, color: 0xd9b23a },
};
const FISH_IDS = Object.keys(FISH);

/* Động vật chuồng */
const ANIMALS = {
  chicken: { name: "Gà", emoji: "🐔", cost: 250, produce: "egg",  produceName: "Trứng", produceEmoji: "🥚", sell: 45,  xp: 5,  level: 2, max: 6 },
  cow:     { name: "Bò", emoji: "🐄", cost: 900, produce: "milk", produceName: "Sữa",   produceEmoji: "🥛", sell: 120, xp: 12, level: 4, max: 3 },
  duck:    { name: "Vịt", emoji: "🦆", cost: 450, produce: "duck_egg", produceName: "Trứng vịt", produceEmoji: "🥚", sell: 80, xp: 8, level: 3, max: 4 },
};
const ANIMAL_IDS = Object.keys(ANIMALS);

/* Trang trí */
const DECOR = {
  fence:  { name: "Hàng rào", emoji: "🪵", cost: 20 },
  flower: { name: "Bồn hoa",  emoji: "🌷", cost: 80 },
  bench:  { name: "Ghế gỗ",   emoji: "🪑", cost: 60 },
  lamp:   { name: "Đèn lồng", emoji: "🏮", cost: 120 },
  tree:   { name: "Cây non",  emoji: "🌳", cost: 200 },
  xmas:   { name: "Cây thông Noel", emoji: "🎄", cost: 25, currency: "diamond" },
};
const DECOR_IDS = Object.keys(DECOR);

const TOOLS = [
  { id: "hoe",   emoji: "⛏️", name: "Cuốc" },
  { id: "water", emoji: "💧", name: "Bình tưới" },
  ...CROP_IDS.map((id) => ({ id: "seed_" + id, emoji: CROPS[id].emoji, name: "Hạt " + CROPS[id].name, seed: id })),
];

/* ---------- Bản đồ (mở rộng) ---------- */
const HOUSE = { x: 1, y: 1, w: 5, h: 4 };
const SHOP  = { x: 22, y: 1, w: 4, h: 3 };
const POND  = { x: 11, y: 2, w: 5, h: 3 };
const FARM  = { x: 3, y: 6, w: 22, h: 9 };
const COOP  = { x: 0, y: 6, w: 2, h: 3 };
const DOOR  = { x: 3, y: 4 };
const SHOP_COUNTER = { x: 23, y: 4 };

function inRect(x, y, r) { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; }
function nearRect(x, y, r, d = 1) {
  return x >= r.x - d && x < r.x + r.w + d && y >= r.y - d && y < r.y + r.h + d;
}
function isSolid(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  return inRect(x, y, HOUSE) || inRect(x, y, SHOP) || inRect(x, y, POND) || inRect(x, y, COOP);
}
function isFarmTile(x, y) { return inRect(x, y, FARM) && !inRect(x, y, POND); }
function canPlaceDecor(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
  if (isSolid(x, y)) return false;
  if (isFarmTile(x, y)) return false; // RUỘNG chỉ dành cho cây — không đặt trang trí!
  const k = x + "," + y;
  if (S.decor[k]) return false;
  return true;
}

/* ---------- Trạng thái game ---------- */
let S = null;
function freshState() {
  return {
    v: 2, gold: START_GOLD, level: 1, xp: 0, day: 1, energy: 100,
    inv: { seed_turnip: 6 }, tiles: {}, px: 8 * TILE, py: 8 * TILE,
    fish: [], animals: [], decor: {}, gender: "female",
    diamonds: 0, sleepTime: 1,
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
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2200);
}
function slotAvailable(i) {
  const t = TOOLS[i];
  return !t.seed || (S && (S.inv["seed_" + t.seed] || 0) > 0);
}

/* ============================================================
   SUPABASE
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
let chosenGender = localStorage.getItem("farm_gender") || "female";
function setGender(g) {
  chosenGender = g;
  try { localStorage.setItem("farm_gender", g); } catch (_) {}
  $("pick-female").classList.toggle("active", g === "female");
  $("pick-male").classList.toggle("active", g === "male");
  $("pick-male").classList.toggle("male-active", g === "male");
}
$("pick-male").onclick = () => setGender("male");
$("pick-female").onclick = () => setGender("female");
setGender(chosenGender);
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
function migrate(st) {
  const f = freshState();
  const m = Object.assign(f, st, { inv: Object.assign({}, st.inv || {}) });
  m.fish = Array.isArray(st.fish) ? st.fish : [];
  m.animals = Array.isArray(st.animals) ? st.animals : [];
  m.decor = st.decor && typeof st.decor === "object" ? st.decor : {};
  m.gender = st.gender === "male" ? "male" : "female";
  m.diamonds = st.diamonds || 0;
  m.sleepTime = st.sleepTime > 0 ? st.sleepTime : 1;
  // Dọn đồ trang trí đặt sai trong ruộng (hoàn 50% tiền)
  let refund = 0;
  for (const k of Object.keys(m.decor)) {
    const [x, y] = k.split(",").map(Number);
    if (isFarmTile(x, y)) {
      refund += Math.floor((DECOR[m.decor[k]]?.cost || 0) / 2);
      delete m.decor[k];
    }
  }
  if (refund) m.gold = (m.gold || 0) + refund;
  m.v = 2;
  return m;
}

/* ---- Cloud ---- */
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
const plotMeshes = new Map();
let clock = new THREE.Clock();

const w2x = (px) => (px / TILE - COLS / 2 + 0.5) * T3;
const w2z = (py) => (py / TILE - ROWS / 2 + 0.5) * T3;
const t2x = (tx) => (tx - COLS / 2 + 0.5) * T3;
const t2z = (ty) => (ty - ROWS / 2 + 0.5) * T3;

const mat = (c, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));

function initThree() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 40, 115);

  camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 300);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a7a3a, 1.0));
  dirLight = new THREE.DirectionalLight(0xfff3d6, 1.6);
  dirLight.position.set(14, 24, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.left = -40; dirLight.shadow.camera.right = 40;
  dirLight.shadow.camera.top = 40; dirLight.shadow.camera.bottom = -40;
  scene.add(dirLight);

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
  return spr;
}

/* Mặt đất có LỖ ao cá (đào sâu thật) */
let waterMesh = null;
function buildGround() {
  const GW = COLS * T3 + 30, GH = ROWS * T3 + 30;
  const shape = new THREE.Shape();
  shape.moveTo(-GW / 2, -GH / 2); shape.lineTo(GW / 2, -GH / 2);
  shape.lineTo(GW / 2, GH / 2); shape.lineTo(-GW / 2, GH / 2); shape.closePath();
  // Lỗ = hình chữ nhật ao. Lưu ý: ShapeGeometry quay -90° quanh X nên
  // world z = -shapeY => toạ độ y trong shape phải là -z!
  const hx0 = t2x(POND.x) - T3 / 2, hx1 = t2x(POND.x + POND.w - 1) + T3 / 2;
  const hz0 = t2z(POND.y) - T3 / 2, hz1 = t2z(POND.y + POND.h - 1) + T3 / 2;
  const hole = new THREE.Path();
  hole.moveTo(hx0, -hz0); hole.lineTo(hx1, -hz0); hole.lineTo(hx1, -hz1); hole.lineTo(hx0, -hz1); hole.closePath();
  shape.holes.push(hole);
  const groundGeo = new THREE.ShapeGeometry(shape);
  const ground = new THREE.Mesh(groundGeo, mat(0x6aa84f));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Vùng ruộng
  const farmPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(FARM.w * T3, FARM.h * T3), mat(0x8f9a4e));
  farmPatch.rotation.x = -Math.PI / 2;
  farmPatch.position.set((FARM.x + FARM.w / 2 - COLS / 2) * T3, 0.01, (FARM.y + FARM.h / 2 - ROWS / 2) * T3);
  farmPatch.receiveShadow = true;
  scene.add(farmPatch);

  // Hố ao: thành + đáy (độ sâu thật!)
  const depth = 1.6;
  const wallMat = mat(0x5c4326);
  const pw = hx1 - hx0, pd = hz1 - hz0;
  const cx0 = (hx0 + hx1) / 2, cz0 = (hz0 + hz1) / 2;
  const mkWall = (w, d, x, z) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, depth + 0.2, d), wallMat);
    wall.position.set(x, -(depth + 0.2) / 2 + 0.12, z);
    scene.add(wall);
  };
  mkWall(pw + 0.7, 0.35, cx0, hz0 - 0.175);
  mkWall(pw + 0.7, 0.35, cx0, hz1 + 0.175);
  mkWall(0.35, pd, hx0 - 0.175, cz0);
  mkWall(0.35, pd, hx1 + 0.175, cz0);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), mat(0x2e4a26));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx0, -depth + 0.05, cz0);
  scene.add(floor);

  // Bờ ao: dải đất quanh mép nước
  const rimMat = mat(0x8a6a3a);
  const rim = 0.55;
  const mkRim = (w, d, x, z) => {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), rimMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.02, z);
    r.receiveShadow = true;
    scene.add(r);
  };
  mkRim(pw + rim * 2, rim, cx0, hz0 - rim / 2);
  mkRim(pw + rim * 2, rim, cx0, hz1 + rim / 2);
  mkRim(rim, pd, hx0 - rim / 2, cz0);
  mkRim(rim, pd, hx1 + rim / 2, cz0);

  // Mặt nước trong suốt (thấy cá bơi bên dưới) + gợn sóng nhẹ
  waterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(pw - 0.12, pd - 0.12, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0x3a8fd9, transparent: true, opacity: 0.62, depthWrite: false })
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(cx0, -0.38, cz0);
  scene.add(waterMesh);

  // Vài tán sen trang trí trên mặt nước
  for (let i = 0; i < 3; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.28 + (i % 2) * 0.12, 14), mat(0x3f7a2e));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(cx0 + (i - 1) * 1.7, -0.36, cz0 + (i % 2 ? 0.6 : -0.6));
    scene.add(pad);
  }
}

function buildHouse() {
  const g = new THREE.Group();
  const cx = t2x(HOUSE.x + HOUSE.w / 2), cz = t2z(HOUSE.y + HOUSE.h / 2);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(HOUSE.w * T3 - 1, 3.2, HOUSE.h * T3 - 1), mat(0xb5651d));
  walls.position.y = 1.6; walls.castShadow = true; walls.receiveShadow = true;
  g.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(HOUSE.w * T3 * 0.78, 2.6, 4), mat(0x8b3a1a));
  roof.position.y = 4.4; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.9, 0.25), mat(0x5a3a1a));
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
  const body = new THREE.Mesh(new THREE.BoxGeometry(SHOP.w * T3 - 1, 2.6, SHOP.h * T3 - 1), mat(0x7a5230));
  body.position.y = 1.3; body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(SHOP.w * T3 + 0.6, 0.35, SHOP.h * T3 * 0.8), mat(0xd9534f));
  awning.position.set(0, 3.1, 0.9); awning.rotation.x = -0.25; awning.castShadow = true;
  g.add(awning);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.1), mat(0xa0713f));
  counter.position.set(-1.5, 0.5, (SHOP.h * T3 - 1) / 2 + 1);
  counter.castShadow = true;
  g.add(counter);
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 20), mat(0xf5c542));
  coin.rotation.x = Math.PI / 2;
  coin.position.set(-1.5, 1.25, (SHOP.h * T3 - 1) / 2 + 1);
  g.add(coin);
  const label = makeLabel("🏪 CỬA HÀNG");
  label.position.set(0, 5.6, 0);
  g.add(label);
  g.position.set(cx, 0, cz);
  scene.add(g);
}

/* Chuồng nuôi (gà + bò) */
function buildCoop() {
  const g = new THREE.Group();
  const cx = t2x(COOP.x + COOP.w / 2), cz = t2z(COOP.y + COOP.h / 2);
  const barn = new THREE.Mesh(new THREE.BoxGeometry(COOP.w * T3 - 0.6, 2.2, COOP.h * T3 - 0.6), mat(0xb04a3a));
  barn.position.y = 1.1; barn.castShadow = true; barn.receiveShadow = true;
  g.add(barn);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(COOP.w * T3 * 0.85, 1.6, 4), mat(0x6e3a2a));
  roof.position.y = 2.9; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  g.add(roof);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 0.2), mat(0x5a3a1a));
  gate.position.set(0, 0.65, (COOP.h * T3 - 0.6) / 2);
  g.add(gate);
  const label = makeLabel("🐔 Chuồng", { w: 4.5 });
  label.position.set(0, 4.4, 0);
  g.add(label);
  g.position.set(cx, 0, cz);
  scene.add(g);
}

let playerShadow = null;
function buildPlayer(gender = "female") {
  // Xoá nhân vật cũ nếu có
  if (playerGroup) {
    scene.remove(playerGroup);
    playerGroup.traverse?.((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }
  const g = new THREE.Group();
  const M = mat;
  const female = gender === "female";

  // Chân: khớp xoay ở hông
  const legPivot = (x, color) => {
    const p = new THREE.Group();
    p.position.set(x, 0.58, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.58, 0.28), M(color));
    leg.position.y = -0.29; leg.castShadow = true;
    p.add(leg);
    return p;
  };
  const legL = legPivot(-0.19, female ? 0xf0c8a0 : 0x3a5a8a);
  const legR = legPivot(0.19, female ? 0xf0c8a0 : 0x3a5a8a);
  g.add(legL, legR);
  g.userData.legs = [legL, legR];

  // Tay: khớp xoay ở vai
  const armPivot = (x, color) => {
    const p = new THREE.Group();
    p.position.set(x, 1.42, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.58, 0.2), M(color));
    arm.position.y = -0.31; arm.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), M(0xf0c8a0));
    hand.position.y = -0.62;
    p.add(arm, hand);
    return p;
  };
  let armL, armR;

  if (female) {
    // 👧 Nữ: váy hồng xòe + tay áo ngắn
    const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.6, 1.05, 10), M(0xff8fb5));
    dress.position.y = 1.0; dress.castShadow = true;
    g.add(dress);
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.045, 6, 16), M(0xffffff));
    ribbon.rotation.x = Math.PI / 2; ribbon.position.y = 1.52;
    g.add(ribbon);
    armL = armPivot(-0.4, 0xff8fb5); armR = armPivot(0.4, 0xff8fb5);
  } else {
    // 👦 Nam: áo đỏ + mũ nông dân
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), M(0xe04b3a));
    body.position.y = 1.05; body.castShadow = true;
    g.add(body);
    armL = armPivot(-0.5, 0xe04b3a); armR = armPivot(0.5, 0xe04b3a);
  }
  g.add(armL, armR);
  g.userData.arms = [armL, armR];

  // Đầu chung
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), M(0xf5d0b0));
  head.position.y = 1.95; head.castShadow = true;
  g.add(head);
  // Mắt + má hồng (nữ)
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), M(0x30302f));
  eyeL.position.set(-0.14, 2.0, 0.38);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.14;
  g.add(eyeL, eyeR);
  if (female) {
    const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), M(0xffb3c1));
    cheekL.position.set(-0.24, 1.88, 0.34); cheekL.scale.set(1, 0.6, 0.5);
    const cheekR = cheekL.clone(); cheekR.position.x = 0.24;
    g.add(cheekL, cheekR);
    // Tóc + hai đuôi sam + nơ
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0x6b4423));
    hairCap.position.y = 1.97;
    const pigL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M(0x6b4423));
    pigL.position.set(-0.46, 1.78, -0.02); pigL.scale.set(1, 1.9, 1); pigL.castShadow = true;
    const pigR = pigL.clone(); pigR.position.x = 0.46;
    const bowL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), M(0xe04b7a));
    bowL.position.set(-0.46, 1.96, -0.02);
    const bowR = bowL.clone(); bowR.position.x = 0.46;
    g.add(hairCap, pigL, pigR, bowL, bowR);
  } else {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 16), M(0xf5c542));
    brim.position.y = 2.22;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.3, 16), M(0xf5c542));
    top.position.y = 2.38;
    g.add(brim, top);
  }

  playerGroup = g;
  scene.add(g);

  // Bóng đổ mềm dưới chân
  if (playerShadow) scene.remove(playerShadow);
  playerShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
  );
  playerShadow.rotation.x = -Math.PI / 2;
  scene.add(playerShadow);
}

function buildHighlight() {
  const geo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(T3 * 0.94, T3 * 0.94));
  highlightMesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  highlightMesh.rotation.x = -Math.PI / 2;
  scene.add(highlightMesh);
}

/* ---------- Cây trồng: MỖI LOẠI MỘT HÌNH DẠNG ---------- */
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
      const soilMat = mat(0x8a5a2b);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(T3 * 0.92, 0.22, T3 * 0.92), soilMat);
      soil.position.y = 0.11; soil.receiveShadow = true;
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
  for (const k of [...plotMeshes.keys()]) {
    if (!seen.has(k)) {
      scene.remove(plotMeshes.get(k).group);
      plotMeshes.delete(k);
    }
  }
}

function buildCropMesh(holder, c) {
  while (holder.children.length) {
    const ch = holder.children.pop();
    ch.traverse?.((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }
  holder.rotation.z = 0;
  holder.userData = {};
  if (!c) return;
  const def = CROPS[c.id];
  const ready = c.stage >= WATER_NEEDED;
  const prog = Math.max(0.12, Math.min(1, c.stage / WATER_NEEDED));
  // Cây lớn dần theo số lần tưới, giữ đúng dáng cây thật của từng loại
  holder.scale.setScalar(0.4 + 0.6 * prog);
  buildSpeciesPlant(holder, c.id, ready, prog);
  if (c.w && !ready) {
    const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), mat(0x6ec6ff, { transparent: true, opacity: 0.9 }));
    drop.position.y = 2.1;
    holder.add(drop);
  }
}

/* Mỗi loài có dáng cây thật riêng: thân/lá luôn có, quả chỉ hiện khi chín */
function buildSpeciesPlant(holder, id, ready, prog) {
  const M = mat;
  if (id === "turnip") {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), M(0xe8e8f5));
    bulb.position.y = 0.2; bulb.scale.set(1, 0.8, 1); bulb.castShadow = true;
    const leaf1 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), M(0x7ec850));
    leaf1.position.set(-0.12, 0.62, 0); leaf1.scale.set(0.6, 1.2, 0.6);
    const leaf2 = leaf1.clone(); leaf2.position.x = 0.12; leaf2.rotation.z = 0.5;
    holder.add(bulb, leaf1, leaf2);
  } else if (id === "potato") {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), M(0x3f6d28));
    bush.position.y = 0.45; bush.scale.set(1.3, 0.8, 1.3); bush.castShadow = true;
    holder.add(bush);
    if (ready) {
      const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), M(0xc9a15f));
      p1.position.set(-0.3, 0.14, 0.2);
      const p2 = p1.clone(); p2.position.set(0.28, 0.14, -0.15);
      holder.add(p1, p2);
    }
  } else if (id === "corn") {
    // Cây bắp: thân cao + lá dài cong + bắp ngô sát thân
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.7, 6), M(0x4c8a35));
    stalk.position.y = 0.95; stalk.castShadow = true;
    const leafL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.75, 4), M(0x4c8a35));
    leafL.position.set(-0.26, 1.05, 0); leafL.rotation.z = 1.0;
    const leafR = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.75, 4), M(0x5da23f));
    leafR.position.set(0.26, 0.8, 0); leafR.rotation.z = -1.0;
    holder.add(stalk, leafL, leafR);
    if (ready) {
      const cob = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.38, 4, 8), M(0xf5c542));
      cob.position.set(0.2, 1.1, 0); cob.rotation.z = 0.45; cob.castShadow = true;
      const husk = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), M(0x8fca5a));
      husk.position.set(0.28, 0.86, 0); husk.rotation.z = 0.45;
      holder.add(cob, husk);
    }
  } else if (id === "tomato") {
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 5), M(0x8a6a3a));
    stake.position.y = 0.85;
    const vine = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), M(0x3f7a2e));
    vine.position.y = 1.0; vine.scale.set(1, 1.2, 1);
    holder.add(stake, vine);
    if (ready) {
      const t1 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), M(0xe04b3a));
      t1.position.set(-0.2, 0.85, 0.12); t1.castShadow = true;
      const t2 = t1.clone(); t2.position.set(0.18, 1.15, -0.1);
      const t3 = t1.clone(); t3.position.set(0.05, 0.7, -0.2);
      holder.add(t1, t2, t3);
    } else if (prog > 0.5) {
      const g1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M(0x7fc25e));
      g1.position.set(-0.16, 0.9, 0.1);
      holder.add(g1);
    }
  } else if (id === "pumpkin") {
    // dây leo + mầm lá (luôn hiện rõ từ khi mới gieo)
    const sprout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 6), M(0x3a6d28));
    sprout.position.y = 0.28;
    const leafL = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), M(0x3a6d28));
    leafL.position.set(-0.17, 0.5, 0); leafL.scale.set(1.5, 0.5, 1);
    const leafR = leafL.clone(); leafR.position.x = 0.17;
    holder.add(sprout, leafL, leafR);
    if (ready) {
      const pumpkin = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), M(0xe88b1a));
      pumpkin.position.y = 0.42; pumpkin.scale.set(1, 0.75, 1); pumpkin.castShadow = true;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.25, 6), M(0x3a6d28));
      stem.position.y = 0.85;
      holder.add(pumpkin, stem);
    } else {
      const bud = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), M(0x7fae3f));
      bud.position.set(0.25, 0.16, 0.1);
      holder.add(bud);
    }
  } else if (id === "carrot") {
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.55, 10), M(0xe8791a));
    root.position.y = 0.15; root.castShadow = true;
    const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), M(0x2f8f3a));
    f1.position.set(0, 0.55, 0); f1.scale.set(0.5, 1.3, 0.5);
    const f2 = f1.clone(); f2.rotation.z = 0.8; f2.position.x = -0.15;
    const f3 = f1.clone(); f3.rotation.z = -0.8; f3.position.x = 0.15;
    holder.add(root, f1, f2, f3);
  } else if (id === "strawberry") {
    // 🍓 Dâu tây: bụi thấp + lá cọ + quả đỏ nhỏ lấp ló
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), M(0x2e7d32));
    bush.position.y = 0.38; bush.scale.set(1.2, 0.85, 1.2); bush.castShadow = true;
    holder.add(bush);
    if (ready) {
      const s1 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 8), M(0xe83e5c));
      s1.position.set(-0.22, 0.3, 0.22); s1.rotation.x = Math.PI;
      const s2 = s1.clone(); s2.position.set(0.2, 0.34, -0.18); s2.rotation.z = 0.3;
      const s3 = s1.clone(); s3.position.set(0.05, 0.28, 0.28);
      const lf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), M(0xffffff));
      lf.position.set(0.12, 0.55, 0.1);
      holder.add(s1, s2, s3, lf);
    }
  } else if (id === "watermelon") {
    // 🍉 Dưa hấu: dây leo + mầm lá (luôn hiện rõ), quả to sọc khi chín
    const sprout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.45, 6), M(0x1f6e33));
    sprout.position.y = 0.25;
    const sproutLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), M(0x2e8b45));
    sproutLeaf.position.set(0.18, 0.45, 0); sproutLeaf.scale.set(1.4, 0.5, 1);
    const vine = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), M(0x1f6e33));
    vine.position.set(-0.6, 0.12, 0.25); vine.scale.set(1.8, 0.4, 1);
    const leafBig = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M(0x2e8b45));
    leafBig.position.set(0.35, 0.1, -0.3); leafBig.scale.set(1.3, 0.5, 1);
    holder.add(sprout, sproutLeaf, vine, leafBig);
    if (ready) {
      const melon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10), M(0x2e8b3c));
      melon.position.y = 0.48; melon.scale.set(1, 0.82, 1); melon.castShadow = true;
      for (let s = 0; s < 3; s++) {
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.585, 0.035, 6, 24), M(0x14481f));
        stripe.rotation.y = Math.PI / 2;
        stripe.rotation.x = (s - 1) * 0.55;
        melon.add(stripe);
      }
      const stemC = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.2, 6), M(0x1f6e33));
      stemC.position.y = 1.0;
      holder.add(melon, stemC);
    } else {
      const bud = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), M(0x3a8f4a));
      bud.position.set(0.25, 0.15, 0.15);
      holder.add(bud);
    }
  }
}

/* ---------- Cá 3D bơi trong ao ---------- */
const fishMeshes = [];
let fishSyncKey = "";

function syncFish() {
  if (!S) return;
  const key = S.fish.map(f => f.id + f.stage).join(",");
  if (key === fishSyncKey) return;
  fishSyncKey = key;
  while (fishMeshes.length) {
    const m = fishMeshes.pop();
    scene.remove(m.group);
    m.group.traverse?.((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }
  const pcx = (t2x(POND.x) + t2x(POND.x + POND.w - 1)) / 2;
  const pcz = (t2z(POND.y) + t2z(POND.y + POND.h - 1)) / 2;
  S.fish.forEach((f, i) => {
    const def = FISH[f.id];
    const g = buildFishMesh(def);
    const scale = 0.55 + Math.min(1, f.stage / def.days) * 0.75;
    g.scale.setScalar(scale);
    const radius = 0.7 + (i % 3) * 0.75;
    const depth = -0.55 - (i % 3) * 0.22;
    fishMeshes.push({
      group: g, cx: pcx + (Math.random() - 0.5) * 1.2, cz: pcz + (Math.random() - 0.5) * 0.8,
      radius, angle: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 0.5, depth,
      ready: f.stage >= def.days,
    });
    scene.add(g);
  });
}
/* Cá trông như cá thật: thân dẹt thoi + đuôi tam giác vẫy + vây lưng + mắt.
   Cá Nóc: thân tròn phồng + gai nhọn quanh mình */
function buildFishMesh(def) {
  const color = def.color;
  const g = new THREE.Group();
  const M = mat;
  let body, tail;
  if (def.name === "Cá Nóc") {
    // 🐡 Thân tròn phồng + gai
    body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), M(color));
    body.castShadow = false;
    for (let s = 0; s < 12; s++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), M(0x8a6d1f));
      const th = (s / 12) * Math.PI * 2, ph = (s % 3 - 1) * 0.55;
      spike.position.set(Math.cos(th) * 0.4 * Math.cos(ph), Math.sin(ph) * 0.35, Math.sin(th) * 0.4 * Math.cos(ph));
      spike.lookAt(0, 0, 0);
      spike.rotateX(Math.PI / 2);
      g.add(spike);
    }
    tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 3), M(color));
    tail.rotation.z = Math.PI / 2; tail.position.set(-0.5, 0, 0); tail.scale.z = 0.18;
    g.userData.tail = tail;
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), M(0x1a1a1a));
    eL.position.set(0.28, 0.1, 0.12);
    const eR = eL.clone(); eR.position.z = -0.12;
    g.add(tail, eL, eR);
    return g;
  }
  // Thân thoi dẹt
  body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), M(color));
  body.scale.set(1.1, 0.42, 0.22);
  body.castShadow = false;
  // Đầu nhọn nhẹ
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 8), M(color));
  nose.rotation.z = -Math.PI / 2; nose.position.set(0.55, 0, 0);
  // Đuôi tam giác (vẫy được)
  tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 3), M(color));
  tail.rotation.z = Math.PI / 2; tail.position.set(-0.62, 0, 0); tail.scale.z = 0.18;
  g.userData.tail = tail;
  // Vây lưng + vây bụng
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 3), M(color));
  dorsal.position.set(-0.02, 0.2, 0); dorsal.scale.z = 0.35;
  const finB = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 3), M(color));
  finB.position.set(0.1, -0.14, 0); finB.rotation.x = Math.PI; finB.scale.z = 0.35;
  // Mắt
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), M(0x1a1a1a));
  eL.position.set(0.38, 0.06, 0.1);
  const eR = eL.clone(); eR.position.z = -0.1;
  g.add(body, nose, tail, dorsal, finB, eL, eR);
  return g;
}
function updateFish(t) {
  for (const f of fishMeshes) {
    f.angle += f.speed * 0.016;
    const x = f.cx + Math.cos(f.angle) * f.radius;
    const z = f.cz + Math.sin(f.angle) * f.radius * 0.55;
    f.group.position.set(x, f.depth + Math.sin(t * 2 + f.radius * 5) * 0.05, z);
    f.group.rotation.y = -f.angle + Math.PI / 2;
    // Đuôi vẫy + lưng nhấp nhô
    if (f.group.userData.tail) f.group.userData.tail.rotation.y = Math.sin(t * 9) * 0.4;
    if (f.ready) f.group.position.y += Math.sin(t * 4) * 0.04;
  }
}

/* ---------- Động vật 3D ---------- */
const animalMeshes = [];
let animalSyncKey = "";

function syncAnimals() {
  if (!S) return;
  const key = S.animals.map(a => a.id).join(",");
  if (key === animalSyncKey) return;
  animalSyncKey = key;
  while (animalMeshes.length) {
    const m = animalMeshes.pop();
    scene.remove(m.group);
    m.group.traverse?.((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }
  S.animals.forEach((a, i) => {
    let g;
    if (a.id === "chicken") g = buildChicken();
    else if (a.id === "duck") g = buildDuck();
    else g = buildCow();
    const hx = t2x(COOP.x + COOP.w / 2) + (i - 1) * 1.6;
    const hz = t2z(COOP.y + COOP.h) + 1.5 + (i % 2) * 1.2;
    g.position.set(hx, 0, hz);
    animalMeshes.push({ group: g, homeX: hx, homeZ: hz, dir: Math.random() * Math.PI * 2, timer: Math.random() * 3, fed: a.fed });
    scene.add(g);
  });
}
function buildChicken() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mat(0xf5f5f0));
  body.position.y = 0.42; body.scale.set(1, 0.9, 1.2); body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), mat(0xf5f5f0));
  head.position.set(0, 0.75, 0.28);
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.14), mat(0xe04b3a));
  comb.position.set(0, 0.92, 0.28);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), mat(0xf5a623));
  beak.position.set(0, 0.73, 0.44); beak.rotation.x = Math.PI / 2;
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 4), mat(0xf5a623));
  legs.position.y = 0.14;
  g.add(body, head, comb, beak, legs);
  return g;
}
function buildDuck() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat(0xfafafa));
  body.position.y = 0.38; body.scale.set(1, 0.9, 1.25); body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), mat(0xfafafa));
  head.position.set(0, 0.72, 0.26);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.2), mat(0xf5a623));
  beak.position.set(0, 0.68, 0.44);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 5), mat(0xfafafa));
  tail.position.set(0, 0.45, -0.32); tail.rotation.x = -Math.PI / 2.6;
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 4), mat(0xf5a623));
  legs.position.y = 0.12;
  g.add(body, head, beak, tail, legs);
  return g;
}
function buildCow() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.75), mat(0xf2ede4));
  body.position.y = 0.85; body.castShadow = true;
  const patch1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.78), mat(0x2b2b2b));
  patch1.position.set(0.35, 0.95, 0);
  const patch2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.78), mat(0x2b2b2b));
  patch2.position.set(-0.45, 0.7, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.45), mat(0xf2ede4));
  head.position.set(0.95, 1.0, 0); head.castShadow = true;
  const horn1 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), mat(0xd9cbb0));
  horn1.position.set(0.95, 1.3, 0.18);
  const horn2 = horn1.clone(); horn2.position.z = -0.18;
  const legs = [];
  for (const [lx, lz] of [[-0.55, 0.25], [-0.55, -0.25], [0.55, 0.25], [0.55, -0.25]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), mat(0xe8e2d8));
    leg.position.set(lx, 0.25, lz); leg.castShadow = true;
    legs.push(leg); g.add(leg);
  }
  g.add(body, patch1, patch2, head, horn1, horn2, ...legs);
  g.userData.legs = legs;
  return g;
}
function updateAnimals(t, dt) {
  animalMeshes.forEach((a, i) => {
    a.timer -= dt / 60;
    if (a.timer <= 0) {
      a.timer = 2 + Math.random() * 3;
      a.dir = Math.random() * Math.PI * 2;
      a.walking = Math.random() > 0.4;
    }
    if (a.walking) {
      const sp = (a.group.userData.isCow ? 0.4 : 0.8) * dt / 60;
      const nx = a.group.position.x + Math.cos(a.dir) * sp;
      const nz = a.group.position.z + Math.sin(a.dir) * sp;
      // Giữ trong sân chuồng
      if (Math.abs(nx - a.homeX) < 1.6 && Math.abs(nz - a.homeZ) < 1.2) {
        a.group.position.x = nx; a.group.position.z = nz;
      } else a.dir += Math.PI / 2;
      a.group.rotation.y = -a.dir + Math.PI / 2;
      const legs = a.group.userData?.legs;
      if (legs) { const sw = Math.sin(t * 8) * 0.3; legs[0].rotation.x = sw; legs[3].rotation.x = sw; legs[1].rotation.x = -sw; legs[2].rotation.x = -sw; }
      a.group.position.y = Math.abs(Math.sin(t * 8)) * 0.05;
    } else a.group.position.y = 0;
    // Đã cho ăn: động vật hơi nhún vui
    if (S.animals[i]?.fed) a.group.rotation.z = Math.sin(t * 6) * 0.03;
  });
}
// đánh dấu bò để tốc độ đi khác
const _origBuildCow = buildCow;
buildCow = function () { const g = _origBuildCow(); g.userData.isCow = true; return g; };

/* ---------- Trang trí 3D ---------- */
const decorMeshes = new Map();
let decorSyncKey = "";

function syncDecor() {
  if (!S) return;
  const key = JSON.stringify(S.decor);
  if (key === decorSyncKey) return;
  decorSyncKey = key;
  for (const [k, m] of decorMeshes) {
    scene.remove(m);
    m.traverse?.((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }
  decorMeshes.clear();
  for (const k in S.decor) {
    const [x, y] = k.split(",").map(Number);
    const g = buildDecorMesh(S.decor[k]);
    g.position.set(t2x(x), 0, t2z(y));
    scene.add(g);
    decorMeshes.set(k, g);
  }
}
function buildDecorMesh(id) {
  const g = new THREE.Group();
  const M = mat;
  if (id === "fence") {
    for (const px of [-0.7, 0.7]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), M(0x9a7742));
      post.position.set(px, 0.45, 0); post.castShadow = true;
      g.add(post);
    }
    for (const hy of [0.45, 0.75]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.07), M(0xb58a52));
      rail.position.set(0, hy, 0);
      g.add(rail);
    }
  } else if (id === "flower") {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.36, 0.4, 10), M(0xb5651d));
    pot.position.y = 0.2; pot.castShadow = true;
    g.add(pot);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10), M(0x5b3a1e));
    soil.position.y = 0.4;
    g.add(soil);
    const cols = [0xe04b3a, 0xf5c542, 0xd97fd4, 0xffffff];
    for (let i = 0; i < 5; i++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), M(cols[i % cols.length]));
      const ang = (i / 5) * Math.PI * 2;
      fl.position.set(Math.cos(ang) * 0.26, 0.55 + (i % 2) * 0.08, Math.sin(ang) * 0.26);
      g.add(fl);
    }
  } else if (id === "bench") {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.5), M(0x9a7742));
    seat.position.y = 0.45; seat.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.08), M(0x9a7742));
    back.position.set(0, 0.72, -0.21);
    g.add(seat, back);
    for (const lx of [-0.55, 0.55]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.4), M(0x6e5327));
      leg.position.set(lx, 0.22, 0);
      g.add(leg);
    }
  } else if (id === "lamp") {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 6), M(0x4a4a4a));
    pole.position.y = 0.75; pole.castShadow = true;
    const glass = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshLambertMaterial({ color: 0xffd97a, emissive: 0xffb020, emissiveIntensity: 0.9 }));
    glass.position.y = 1.65;
    g.add(pole, glass);
  } else if (id === "tree") {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.0, 6), M(0x8a5a2b));
    trunk.position.y = 0.5; trunk.castShadow = true;
    const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), M(0x4c8a35));
    c1.position.y = 1.4; c1.castShadow = true;
    const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), M(0x5da23f));
    c2.position.set(0.3, 1.75, 0.1);
    g.add(trunk, c1, c2);
  } else if (id === "xmas") {
    // 🎄 Cây thông Noel TO: 3 tầng lá thông + quài màu + sao vàng phát sáng
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.9, 8), M(0x6e4a1f));
    trunk.position.y = 0.45; trunk.castShadow = true;
    g.add(trunk);
    const tiers = [
      { r: 1.55, h: 1.5, y: 1.35 },
      { r: 1.15, h: 1.3, y: 2.5 },
      { r: 0.78, h: 1.1, y: 3.5 },
    ];
    tiers.forEach((t) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 10), M(0x1f6e33));
      cone.position.y = t.y; cone.castShadow = true;
      g.add(cone);
    });
    // Quài trang trí quanh cây
    const cols = [0xe04b3a, 0xf5c542, 0x6fb1e8, 0xff8fb5];
    for (let i = 0; i < 9; i++) {
      const tier = tiers[i % 3];
      const ang = (i / 9) * Math.PI * 2 + 0.4;
      const rr = tier.r * 0.62;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), M(cols[i % cols.length]));
      ball.position.set(Math.cos(ang) * rr, tier.y + (i % 2) * 0.25, Math.sin(ang) * rr);
      g.add(ball);
    }
    // Sao vàng trên đỉnh
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.26), new THREE.MeshLambertMaterial({ color: 0xffd54a, emissive: 0xffc020, emissiveIntensity: 1 }));
    star.position.y = 4.35;
    g.add(star);
  }
  return g;
}

/* ============================================================
   INPUT — bàn phím + cảm ứng
   ============================================================ */
const keys = {};
let selectedSlot = 0;
let facing = { dx: 0, dy: 1 };
const joy = { active: false, x: 0, y: 0, id: null };
let pinchStart = null;
let buildMode = null; // null | {type:'place', id} | {type:'remove'}
function setBuildMode(m) {
  buildMode = m;
  const chip = $("mode-chip");
  if (!chip) return;
  if (m) {
    $("mode-text").textContent = m.type === "place"
      ? "🚧 Đang đặt: " + DECOR[m.id].name + (m.id === "fence" ? " (bấm Dùng để nối dài)" : "")
      : "🗑️ Chế độ thu hồi — bấm Dùng cạnh vật cần gỡ";
    chip.classList.remove("hidden");
  } else chip.classList.add("hidden");
}

window.addEventListener("keydown", (e) => {
  if (authScreenVisible()) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  if ((k >= "1" && k <= "9") || k === "0") {
    const i = k === "0" ? 9 : parseInt(k) - 1;
    if (i < TOOLS.length && slotAvailable(i)) { selectedSlot = i; renderToolbar(); }
  }
  if (k === " " || k === "e") doAction();
  if (k === "x") useDiamond();
  if (k === "b") togglePanel("shop-panel");
  if (k === "q") togglePanel("bag-panel");
  if (k === "g") togglePanel("build-panel");
  if (k === "enter") trySleep();
  if (k === "escape") { setBuildMode(null); closePanels(); }
  if (e.ctrlKey && k === "s") { e.preventDefault(); saveGame(true); }
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

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

$("btn-action").addEventListener("click", () => doAction());
$("btn-diamond-m").addEventListener("click", () => useDiamond());
$("mode-exit").addEventListener("click", () => { setBuildMode(null); toast("Đã thoát chế độ xây dựng"); });
$("btn-shop-m").addEventListener("click", () => togglePanel("shop-panel"));
$("btn-bag-m").addEventListener("click", () => togglePanel("bag-panel"));
$("btn-sleep-m").addEventListener("click", () => trySleep());
$("btn-build-m").addEventListener("click", () => togglePanel("build-panel"));
$("btn-save-m").addEventListener("click", () => saveGame(true));

/* ============================================================
   VÒNG LẶP GAME
   ============================================================ */
let lastT = 0, started = false;
function loop(t) {
  const dt = Math.min((t - lastT) / 16.67, 3); lastT = t;
  update(dt);
  renderFrame(t);
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
   HÀNH ĐỘNG
   ============================================================ */
function doAction() {
  if (!S || authScreenVisible()) return;
  const { x, y } = facingTile();
  const k = keyOf(x, y);
  const tool = TOOLS[selectedSlot];

  // Chế độ xây dựng — nếu không đặt/gỡ được ở ô này thì tự thoát và làm hành động thường
  if (buildMode) {
    const dDef = DECOR[buildMode.type === "place" ? buildMode.id : "fence"];
    const useDiamonds = buildMode.type === "place" && DECOR[buildMode.id]?.currency === "diamond";
    if (buildMode.type === "place") {
      const cost = DECOR[buildMode.id].cost;
      const have = useDiamonds ? (S.diamonds || 0) : S.gold;
      if (canPlaceDecor(x, y) && have >= cost) {
        if (useDiamonds) S.diamonds -= cost; else S.gold -= cost;
        S.decor[k] = buildMode.id;
        syncDecor(); updateHUD(); sfx("buy");
        if (buildMode.id === "fence") {
          toast("Đã đặt hàng rào! (tiếp tục bấm Dùng để đặt thêm)");
        } else {
          toast("Đã đặt " + DECOR[buildMode.id].name + "!");
          setBuildMode(null); // kết thúc tự động (trừ hàng rào để nối dài)
        }
        saveGame();
        return;
      }
      // Không đặt được -> thoát chế độ, chạy tiếp hành động thường
      setBuildMode(null);
      toast(have < cost ? (useDiamonds ? "Không đủ 💎 — đã thoát chế độ đặt" : "Không đủ vàng — đã thoát chế độ đặt") : "Ô này không đặt được — đã thoát chế độ đặt");
    } else if (buildMode.type === "remove") {
      if (S.decor[k]) {
        const removed = DECOR[S.decor[k]];
        const isDia = removed?.currency === "diamond";
        const refund = Math.floor((removed?.cost || 0) / 2);
        if (isDia) S.diamonds = (S.diamonds || 0) + refund; else S.gold += refund;
        delete S.decor[k];
        syncDecor(); updateHUD(); sfx("sell");
        toast("Đã thu hồi (+" + refund + (isDia ? "💎) — bấm tiếp để gỡ ô khác, ✕ để thoát" : "💰) — bấm tiếp để gỡ ô khác, ✕ để thoát"));
        saveGame();
        return;
      }
      // Không có gì để gỡ -> thoát chế độ, chạy tiếp hành động thường
      setBuildMode(null);
      toast("Không có gì để thu hồi — đã thoát chế độ");
    }
  }

  const tile = S.tiles[k];

  // Thu hoạch ưu tiên
  if (tile?.c && cropReady(tile.c)) { harvest(tile); return; }

  // Gần công trình -> mở panel tương ứng
  if (inRect(x, y, POND) || (nearRect(x, y, POND) && !isFarmTile(x, y))) { togglePanel("pond-panel"); return; }
  if (nearRect(x, y, COOP)) { togglePanel("coop-panel"); return; }
  if (Math.abs(x - DOOR.x) <= 1 && Math.abs(y - DOOR.y) <= 1) { togglePanel("sleep-panel"); return; }
  if (Math.abs(x - SHOP_COUNTER.x) <= 1 && Math.abs(y - SHOP_COUNTER.y) <= 1) { togglePanel("shop-panel"); return; }

  if (!isFarmTile(x, y)) { toast("Chỉ canh tác được trên đất ruộng!"); return; }
  if (S.energy <= 0) { toast("Quá mệt rồi! Hãy đi ngủ để hồi phục ⚡"); return; }

  if (tool.id === "hoe") {
    if (S.decor[k]) { toast("Có đồ trang trí ở đây — thu hồi trước nhé! 🧹"); return; }
    if (tile?.t) { toast("Đất đã được cuốc rồi."); return; }
    if (tile?.c) return;
    S.tiles[k] = { t: 1, w: 0, c: null };
    useEnergy(ENERGY.till); sfx("till");
  } else if (tool.id === "water") {
    if (!tile?.t) { toast("Cần cuốc đất trước đã!"); return; }
    if (tile.c) {
      // Cây cần tưới đủ WATER_NEEDED lần mới chín
      if (cropReady(tile.c)) { toast("Cây đã chín — thu hoạch thôi! 🌾"); return; }
      tile.c.stage = Math.min(WATER_NEEDED, tile.c.stage + 1);
      tile.c.w = 1;
      useEnergy(ENERGY.water); sfx("water");
      if (cropReady(tile.c)) toast("🌿 Cây đã đủ nước — chín rồi! Thu hoạch đi!");
      else toast("💧 Cây đã tưới " + tile.c.stage + "/" + WATER_NEEDED + " lần");
      syncPlots(); updateHUD(); saveGame();
      return;
    }
    if (tile.w) { toast("Đã tưới nước rồi."); return; }
    tile.w = 1;
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
function cropReady(c) { return c.stage >= WATER_NEEDED; }

// 💎 Dùng kim cương: cây đang lớn chín ngay lập tức
function useDiamond() {
  if (!S || authScreenVisible()) return;
  const { x, y } = facingTile();
  const tile = S.tiles[keyOf(x, y)];
  if (!tile?.c) { toast("Đứng cạnh cây đang lớn mới dùng kim cương được!"); return; }
  if (cropReady(tile.c)) { toast("Cây này đã chín rồi — thu hoạch thôi! 🌾"); return; }
  if ((S.diamonds || 0) < 1) { toast("Hết kim cương! Lên cấp sẽ được tặng 💎"); return; }
  S.diamonds--;
  tile.c.stage = WATER_NEEDED;
  sfx("levelup");
  toast("💎 Kim cương phát sáng — cây chín ngay lập tức! 🌾");
  syncPlots(); updateHUD(); saveGame();
}

function harvest(tile) {
  const def = CROPS[tile.c.id];
  if (S.energy <= 0) { toast("Quá mệt rồi! Hãy đi ngủ để hồi phục ⚡"); return; }
  const key = "crop_" + tile.c.id;
  S.inv[key] = (S.inv[key] || 0) + 1;
  gainXP(def.xp);
  if (def.regrow) { tile.c.stage = WATER_NEEDED - 2; tile.c.w = 0; } // mọc lại: cần tưới thêm 2 lần
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
    S.diamonds = (S.diamonds || 0) + DIAMOND_PER_LEVEL;
    const unlocked = [
      ...CROP_IDS.filter((id) => CROPS[id].level === S.level).map((id) => CROPS[id].name),
      ...FISH_IDS.filter((id) => FISH[id].level === S.level).map((id) => "cá " + FISH[id].name),
      ...ANIMAL_IDS.filter((id) => ANIMALS[id].level === S.level).map((id) => ANIMALS[id].name),
    ];
    showLevelUp(S.level, unlocked);
  }
}
function showLevelUp(lv, unlocked) {
  $("levelup-num").textContent = "Cấp " + lv + "!";
  const el = $("levelup-toast");
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2600);
  if (unlocked.length) toast("🌱 Mở khóa: " + unlocked.join(", ") + "!");
  toast("💎 Nhận " + DIAMOND_PER_LEVEL + " kim cương thưởng lên cấp!");
  sfx("levelup");
}

/* ============================================================
   NGỦ QUA ĐÊM — cây lớn, cá lớn, gà đẻ trứng, bò cho sữa
   ============================================================ */
function trySleep() { if (!authScreenVisible()) togglePanel("sleep-panel"); }
function doSleep() {
  if (sleeping || !S) return;
  sleeping = true;
  closePanels();
  // Màn hình ngủ + đếm giây: lần đầu 1s, mỗi lần sau +1s
  const ov = $("sleep-overlay");
  $("sleep-count").textContent = S.sleepTime + " giây";
  ov.classList.remove("hidden");
  setTimeout(() => {
    applySleep();
    sleeping = false;
    ov.classList.add("hidden");
    S.sleepTime = Math.min(15, S.sleepTime + 1); // lần sau ngủ lâu hơn 1s
    saveGame(); updateHUD();
  }, S.sleepTime * 1000);
}
function applySleep() {
  let fishGrew = 0, eggs = 0, milk = 0;
  // Cây KHÔNG lớn theo ngày nữa — chín theo số lần tưới. Chỉ làm khô đất.
  for (const k in S.tiles) {
    const t = S.tiles[k];
    if (t.c) t.c.w = 0;
    t.w = 0;
  }
  // Cá: chỉ lớn nếu được cho ăn
  for (const f of S.fish) {
    if (f.fed && f.stage < FISH[f.id].days) { f.stage++; fishGrew++; }
    f.fed = false;
  }
  // Động vật: nếu được cho ăn thì ra sản phẩm
  for (const a of S.animals) {
    if (a.fed) {
      const def = ANIMALS[a.id];
      S.inv[def.produce] = (S.inv[def.produce] || 0) + 1;
      if (a.id === "chicken") eggs++;
      else milk++;
      gainXP(def.xp);
    }
    a.fed = false;
  }
  S.day++; S.energy = 100;
  const parts = [];
  if (fishGrew) parts.push(fishGrew + " cá lớn");
  if (eggs) parts.push(eggs + " 🥚");
  if (milk) parts.push(milk + " 🥛");
  toast("☀️ Ngày mới! " + (parts.length ? parts.join(", ") : "Đừng quên cho cá & vật nuôi ăn!"));
  syncPlots(); syncFish(); syncAnimals();
}
let sleeping = false;
$("btn-sleep-confirm").onclick = doSleep;
$("btn-sleep-diamond").onclick = () => {
  if ((S?.diamonds || 0) < 1) { toast("Cần 1 💎 để ngủ nhanh!"); return; }
  S.diamonds--;
  S.sleepTime = 1; // quay lại từ đầu
  updateHUD();
  doSleep();
};
const sleepObserver = new MutationObserver(() => {
  if (!$("sleep-panel").classList.contains("hidden") && S) {
    const ready = Object.values(S.tiles).filter((t) => t.c && cropReady(t.c)).length;
    const fishReady = S.fish.filter((f) => f.stage >= FISH[f.id].days).length;
    $("sleep-info").textContent = `Ruộng: ${ready} cây chín · Ao: ${fishReady} cá bắt được · Thời gian ngủ hiện tại: ${S.sleepTime}s (mỗi lần +1s) · Dùng 1 💎 để ngủ lại nhanh như lúc đầu`;
  }
});
sleepObserver.observe($("sleep-panel"), { attributes: true });

/* ============================================================
   PANELS
   ============================================================ */
function togglePanel(id) {
  const el = $(id);
  const show = el.classList.contains("hidden");
  closePanels();
  if (show) {
    if (id === "shop-panel") renderShop();
    if (id === "bag-panel") renderBag();
    if (id === "pond-panel") renderPond();
    if (id === "coop-panel") renderCoop();
    if (id === "build-panel") renderBuild();
    el.classList.remove("hidden");
  }
}
function closePanels() {
  ["shop-panel", "bag-panel", "sleep-panel", "pond-panel", "coop-panel", "build-panel"].forEach((id) => $(id).classList.add("hidden"));
  // Lưu ý: KHÔNG xoá buildMode ở đây — đặt trang trí cần giữ chế độ khi đóng panel
}
document.querySelectorAll(".panel-close").forEach((b) => (b.onclick = () => { setBuildMode(null); closePanels(); }));

function sectionTitle(txt) {
  const d = document.createElement("div");
  d.className = "section-title";
  d.textContent = txt;
  return d;
}

/* ---- Cửa hàng ---- */
function renderShop() {
  const list = $("shop-list");
  list.innerHTML = "";
  // Hạt giống
  list.appendChild(sectionTitle("🌱 Hạt giống"));
  CROP_IDS.forEach((id) => {
    const c = CROPS[id];
    const locked = c.level > S.level;
    list.appendChild(shopRow(c.emoji, "Hạt " + c.name, `tưới ${WATER_NEEDED} lần là chín · bán ${c.sell}💰 · ${c.xp} XP${c.regrow ? " · mọc lại 🌿" : ""}${locked ? " · 🔒 Lv." + c.level : ""}`, c.seedCost, locked, () => buySeed(id)));
  });
  // Cá giống
  list.appendChild(sectionTitle("🐟 Cá giống (thả vào ao)"));
  FISH_IDS.forEach((id) => {
    const f = FISH[id];
    const locked = f.level > S.level;
    const full = S.fish.length >= FISH_MAX;
    list.appendChild(shopRow(f.emoji, "Cá " + f.name + " giống", `lớn ${f.days} ngày · bán ${f.sell}💰 · ao ${S.fish.length}/${FISH_MAX}${locked ? " · 🔒 Lv." + f.level : ""}`, f.cost, locked || full, () => buyFish(id), full ? "Ao đầy!" : null));
  });
  // Động vật
  list.appendChild(sectionTitle("🐔 Động vật (chuồng)"));
  ANIMAL_IDS.forEach((id) => {
    const a = ANIMALS[id];
    const locked = a.level > S.level;
    const count = S.animals.filter((x) => x.id === id).length;
    const full = count >= a.max;
    list.appendChild(shopRow(a.emoji, a.name, `cho ${a.produceEmoji} mỗi ngày (khi được cho ăn) · bán ${a.produceEmoji} ${a.sell}💰 · đang có ${count}/${a.max}${locked ? " · 🔒 Lv." + a.level : ""}`, a.cost, locked || full, () => buyAnimal(id), full ? "Chuồng đầy!" : null));
  });
}
function shopRow(emoji, name, desc, cost, disabled, onBuy, note, currency) {
  const cur = currency === "diamond" ? "💎" : "💰";
  const row = document.createElement("div");
  row.className = "shop-item" + (disabled ? " locked" : "");
  row.innerHTML = `<span class="item-emoji">${emoji}</span>
    <div class="grow"><div class="name">${name}</div><div class="desc">${desc}${note ? " · <b style='color:#ffb0a0'>" + note + "</b>" : ""}</div></div>
    <button class="btn btn-small" ${disabled ? "disabled" : ""}>${cost}${cur}</button>`;
  if (!disabled) row.querySelector("button").onclick = onBuy;
  return row;
}
function buySeed(id) {
  const c = CROPS[id];
  if (S.gold < c.seedCost) { toast("Không đủ vàng!"); return; }
  S.gold -= c.seedCost;
  S.inv["seed_" + id] = (S.inv["seed_" + id] || 0) + 1;
  sfx("buy"); updateHUD(); renderToolbar(); renderShop(); saveGame();
}
function buyFish(id) {
  const f = FISH[id];
  if (S.fish.length >= FISH_MAX) { toast("Ao đã đầy!"); return; }
  if (S.gold < f.cost) { toast("Không đủ vàng!"); return; }
  S.gold -= f.cost;
  S.fish.push({ id, stage: 0, fed: false });
  sfx("buy"); toast("Thả cá " + f.name + " vào ao! 🐟 Nhớ cho ăn mỗi ngày.");
  syncFish(); updateHUD(); renderShop(); saveGame();
}
function buyAnimal(id) {
  const a = ANIMALS[id];
  const count = S.animals.filter((x) => x.id === id).length;
  if (count >= a.max) { toast("Chuồng đầy!"); return; }
  if (S.gold < a.cost) { toast("Không đủ vàng!"); return; }
  S.gold -= a.cost;
  S.animals.push({ id, fed: false });
  sfx("buy"); toast("Đã mua " + a.name + "! Cho ăn mỗi ngày để " + a.produceEmoji);
  syncAnimals(); updateHUD(); renderShop(); saveGame();
}

/* ---- Túi đồ ---- */
const EXTRA_SELL = { egg: { name: "Trứng", emoji: "🥚", sell: 45 }, milk: { name: "Sữa", emoji: "🥛", sell: 120 }, duck_egg: { name: "Trứng vịt", emoji: "🥚", sell: 80 } };
function sellInfo(key) {
  if (key.startsWith("crop_")) { const c = CROPS[key.slice(5)]; return { name: c.name, emoji: c.emoji, sell: c.sell }; }
  if (key.startsWith("fish_")) { const f = FISH[key.slice(5)]; return { name: f.name, emoji: f.emoji, sell: f.sell }; }
  return EXTRA_SELL[key];
}
function renderBag() {
  const list = $("bag-list");
  list.innerHTML = "";
  const keys = Object.keys(S.inv).filter((k) => S.inv[k] > 0 && k !== "v");
  const seeds = keys.filter((k) => k.startsWith("seed_"));
  const sellable = keys.filter((k) => !k.startsWith("seed_") && sellInfo(k));
  if (!seeds.length && !sellable.length) {
    list.innerHTML = '<p class="muted">Túi trống trơn! Ra ruộng trồng trọt đi 🌱</p>';
    return;
  }
  if (sellable.length) list.appendChild(sectionTitle("💰 Bán được"));
  sellable.forEach((k) => {
    const info = sellInfo(k);
    const row = document.createElement("div");
    row.className = "bag-item";
    row.innerHTML = `<span class="item-emoji">${info.emoji}</span>
      <div class="grow"><div class="name">${info.name} ×${S.inv[k]}</div>
      <div class="desc">Bán ${info.sell}💰/cái → tổng ${info.sell * S.inv[k]}💰</div></div>
      <button class="btn btn-small btn-primary">Bán tất cả</button>`;
    row.querySelector("button").onclick = () => {
      S.gold += info.sell * S.inv[k];
      S.inv[k] = 0;
      sfx("sell"); toast("Đã bán " + info.name + "!");
      updateHUD(); renderBag(); renderToolbar(); saveGame();
    };
    list.appendChild(row);
  });
  if (seeds.length) list.appendChild(sectionTitle("🌱 Hạt giống"));
  seeds.forEach((k) => {
    const c = CROPS[k.slice(5)];
    const row = document.createElement("div");
    row.className = "bag-item";
    row.innerHTML = `<span class="item-emoji">${c.emoji}</span>
      <div class="grow"><div class="name">Hạt ${c.name} ×${S.inv[k]}</div><div class="desc">Dùng để gieo trồng</div></div>`;
    list.appendChild(row);
  });
}

/* ---- Ao cá ---- */
function renderPond() {
  const list = $("pond-list");
  list.innerHTML = "";
  const head = document.createElement("div");
  head.className = "muted";
  head.textContent = `Ao: ${S.fish.length}/${FISH_MAX} con · Cá lớn lên mỗi sáng nếu được cho ăn`;
  list.appendChild(head);
  if (S.fish.length) {
    list.appendChild(sectionTitle("🐠 Trong ao"));
    S.fish.forEach((f, i) => {
      const def = FISH[f.id];
      const ready = f.stage >= def.days;
      const row = document.createElement("div");
      row.className = "shop-item";
      row.innerHTML = `<span class="item-emoji">${f.emoji}</span>
        <div class="grow"><div class="name">Cá ${def.name}${ready ? " — SẴN SÀNG! 🎣" : ""}</div>
        <div class="desc">${ready ? "Bắt lên bán " + def.sell + "💰" : "Lớn: " + f.stage + "/" + def.days + " ngày · " + (f.fed ? "đã ăn 😋" : "đói bụng…")}</div></div>
        <button class="btn btn-small ${ready ? "btn-primary" : ""}" ${ready ? "" : "disabled"}>${ready ? "Bắt 🎣" : "..."}</button>`;
      if (ready) row.querySelector("button").onclick = () => catchFish(i);
      list.appendChild(row);
    });
    const feedBtn = document.createElement("button");
    feedBtn.className = "btn btn-block";
    feedBtn.textContent = "🍞 Cho tất cả ăn (⚡" + ENERGY.feedPond + ")";
    feedBtn.onclick = () => {
      if (S.energy < ENERGY.feedPond) { toast("Quá mệt để cho ăn!"); return; }
      useEnergy(ENERGY.feedPond);
      S.fish.forEach((f) => { f.fed = true; });
      sfx("water"); toast("Cá đã được cho ăn! 🐟");
      updateHUD(); renderPond(); saveGame();
    };
    list.appendChild(feedBtn);
  } else {
    list.innerHTML += '<p class="muted">Ao đang trống. Mua cá giống phía dưới để thả nuôi!</p>';
  }
  list.appendChild(sectionTitle("🛒 Mua cá giống"));
  FISH_IDS.forEach((id) => {
    const f = FISH[id];
    const locked = f.level > S.level;
    const full = S.fish.length >= FISH_MAX;
    list.appendChild(shopRow(f.emoji, "Cá " + f.name + " giống", `lớn ${f.days} ngày · bán ${f.sell}💰 · +${f.xp} XP${locked ? " · 🔒 Lv." + f.level : ""}`, f.cost, locked || full, () => { buyFish(id); renderPond(); }, full ? "Ao đầy!" : null));
  });
}
function catchFish(i) {
  const f = S.fish[i];
  const def = FISH[f.id];
  S.fish.splice(i, 1);
  S.inv["fish_" + f.id] = (S.inv["fish_" + f.id] || 0) + 1;
  gainXP(def.xp);
  useEnergy(2); sfx("harvest");
  toast("Bắt được cá " + def.name + "! (+" + def.xp + " XP)");
  syncFish(); updateHUD(); renderPond(); saveGame();
}

/* ---- Chuồng ---- */
function renderCoop() {
  const list = $("coop-list");
  list.innerHTML = "";
  const head = document.createElement("div");
  head.className = "muted";
  head.textContent = "Cho vật nuôi ăn mỗi ngày → sang ngày chúng cho sản phẩm (tự vào túi)";
  list.appendChild(head);
  ANIMAL_IDS.forEach((id) => {
    const a = ANIMALS[id];
    const mine = S.animals.filter((x) => x.id === id);
    if (!mine.length) return;
    list.appendChild(sectionTitle(a.emoji + " " + a.name + " (" + mine.length + "/" + a.max + ")"));
    mine.forEach((an, i) => {
      const row = document.createElement("div");
      row.className = "shop-item";
      row.innerHTML = `<span class="item-emoji">${a.emoji}</span>
        <div class="grow"><div class="name">${a.name} #${i + 1}</div>
        <div class="desc">${an.fed ? "Đã ăn hôm nay 😋" : "Đang đói…"}</div></div>`;
      list.appendChild(row);
    });
  });
  const hungry = S.animals.filter((a) => !a.fed).length;
  if (hungry) {
    const feedBtn = document.createElement("button");
    feedBtn.className = "btn btn-block";
    feedBtn.textContent = "🍞 Cho tất cả ăn (⚡" + hungry + ")";
    feedBtn.onclick = () => {
      if (S.energy < hungry) { toast("Quá mệt để cho ăn!"); return; }
      useEnergy(hungry);
      S.animals.forEach((a) => { a.fed = true; });
      sfx("buy"); toast("Động vật đã no bụng! 🐔🐄");
      syncAnimals(); updateHUD(); renderCoop(); saveGame();
    };
    list.appendChild(feedBtn);
  }
  list.appendChild(sectionTitle("🛒 Mua thêm"));
  ANIMAL_IDS.forEach((id) => {
    const a = ANIMALS[id];
    const locked = a.level > S.level;
    const count = S.animals.filter((x) => x.id === id).length;
    const full = count >= a.max;
    list.appendChild(shopRow(a.emoji, a.name, `mỗi ngày cho ${a.produceEmoji} ${a.produceName} (bán ${a.sell}💰)${locked ? " · 🔒 Lv." + a.level : ""}`, a.cost, locked || full, () => { buyAnimal(id); renderCoop(); }, full ? "Đủ rồi!" : null));
  });
}

/* ---- Xây dựng trang trí ---- */
function renderBuild() {
  const list = $("build-list");
  list.innerHTML = "";
  if (buildMode) {
    const status = document.createElement("div");
    status.className = "build-status";
    status.textContent = buildMode.type === "place"
      ? "🖱️ Đang đặt: " + DECOR[buildMode.id].name + " — đi tới nơi rồi bấm Dùng ✋ (đặt nhiều lần được)"
      : "🖱️ Đang thu hồi — đứng cạnh vật trang trí rồi bấm Dùng ✋";
    const done = document.createElement("button");
    done.className = "btn btn-primary btn-block";
    done.textContent = "✓ Xong";
    done.onclick = () => { setBuildMode(null); renderBuild(); };
    list.appendChild(status);
    list.appendChild(done);
  }
  list.appendChild(sectionTitle("🛒 Mua & đặt (đặt nhiều lần, mỗi lần trừ tiền)"));
  DECOR_IDS.forEach((id) => {
    const d = DECOR[id];
    const isDia = d.currency === "diamond";
    const afford = isDia ? (S.diamonds || 0) >= d.cost : S.gold >= d.cost;
    list.appendChild(shopRow(d.emoji, d.name, isDia ? `giá ${d.cost}💎 (kim cương) · thu hồi hoàn lại 50%` : `giá ${d.cost}💰 · thu hồi hoàn lại 50%`, d.cost, !afford, () => {
      setBuildMode({ type: "place", id });
      closePanels();
      toast("Đi tới ô trống rồi bấm Dùng ✋ để đặt " + d.name);
    }, null, d.currency));
  });
  list.appendChild(sectionTitle("🧹 Thu hồi"));
  const rm = document.createElement("button");
  rm.className = "btn btn-block";
  rm.textContent = "Thu hồi trang trí (hoàn 50%)";
  rm.onclick = () => {
    setBuildMode({ type: "remove" });
    closePanels();
    toast("Đứng cạnh vật muốn thu hồi rồi bấm Dùng ✋");
  };
  list.appendChild(rm);
}

/* ============================================================
   HUD & TOOLBAR
   ============================================================ */
function updateHUD() {
  $("hud-gold").textContent = S.gold;
  $("hud-level").textContent = S.level;
  $("hud-energy").textContent = S.energy;
  $("hud-diamond").textContent = S.diamonds || 0;
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
function renderFrame(t = performance.now() / 1000) {
  const px = w2x(S.px), pz = w2z(S.py);
  playerGroup.position.set(px, 0, pz);
  playerGroup.rotation.y = Math.atan2(facing.dx, facing.dy);
  if (playerShadow) playerShadow.position.set(px, 0.02, pz);

  const legs = playerGroup.userData.legs, arms = playerGroup.userData.arms;
  if (playerGroup.userData.moving) {
    const sw = Math.sin(t * 6) * 0.42;
    legs[0].rotation.x = sw;  legs[1].rotation.x = -sw;
    arms[0].rotation.x = -sw * 0.75; arms[1].rotation.x = sw * 0.75;
    playerGroup.position.y = Math.abs(Math.sin(t * 6)) * 0.08;
  } else {
    legs[0].rotation.x = 0; legs[1].rotation.x = 0;
    // Thở nhẹ khi đứng yên
    arms[0].rotation.x = Math.sin(t * 1.6) * 0.06;
    arms[1].rotation.x = -Math.sin(t * 1.6) * 0.06;
    playerGroup.position.y = 0;
  }

  const ft = facingTile();
  highlightMesh.position.set(t2x(ft.x), 0.06, t2z(ft.y));

  // Nước ao gợn sóng nhẹ
  if (waterMesh) {
    waterMesh.position.y = -0.38 + Math.sin(t * 1.6) * 0.02;
    waterMesh.material.opacity = 0.6 + Math.sin(t * 2.2) * 0.04;
  }

  // Cây chín lắc lư
  for (const [, entry] of plotMeshes) {
    const holder = entry.cropHolder;
    if (holder.children.length) {
      const ready = holder.userData?.ready;
      holder.rotation.z = ready ? Math.sin(t * 3 + holder.position.x) * 0.06 : 0;
    }
    holder.userData = holder.userData || {};
  }

  // Cá bơi + động vật đi lại
  updateFish(t);
  updateAnimals(t, Math.min(3, 1));

  // Camera bám theo
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
  S.gender = chosenGender; // áp lựa chọn Nam/Nữ ở màn hình đăng nhập
  $("auth-screen").classList.add("hidden");
  $("game-root").classList.remove("hidden");
  if (!started) {
    started = true;
    initThree();
    buildGround();
    buildHouse();
    buildShop();
    buildCoop();
    buildPlayer(S.gender);
    buildHighlight();
    syncPlots(); syncFish(); syncAnimals(); syncDecor();
    camera.position.set(w2x(S.px), 14, w2z(S.py) + 16);
    requestAnimationFrame((t) => { lastT = t; loop(t); });
  } else {
    fishSyncKey = ""; animalSyncKey = ""; decorSyncKey = "";
    syncPlots(); syncFish(); syncAnimals(); syncDecor();
    buildPlayer(S.gender);
  }
  renderToolbar();
  updateHUD();
}

initSupabase();
if (!supabaseConfigured() && loadLocal()) {
  $("cloud-status").textContent = "💾 Có tiến trình đã lưu trên máy này — chọn \"Chơi thử\" để tiếp tục.";
}
// Vào nhanh chế độ khách qua URL ?#guest
if (location.hash.includes("guest")) {
  const go = () => { const b = $("auth-guest"); if (b && !authScreenVisible()) return; b?.click(); };
  go();
  setTimeout(go, 400);
}

/* Âm thanh */
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

/* Handle debug cho kiểm thử */
window.__farm = {
  get state() { return S; },
  doAction, syncPlots, syncFish, syncAnimals, syncDecor, gainXP, CROPS, FISH, ANIMALS, DECOR,
  get plots() { return plotMeshes; },
  get scene() { return scene; },
  get renderer() { return renderer; },
  get player() { return playerGroup; },
  get camera() { return camera; },
  get fishMeshes() { return fishMeshes; },
  get animalMeshes() { return animalMeshes; },
  get decorMeshes() { return decorMeshes; },
  get facing() { return facing; },
  set facing(v) { facing = v; },
  buildPlayer,
  get shadow() { return playerShadow; },
  renderFrame,
};
