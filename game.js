/* ============================================================
   NÔNG TRẠI VUI VẺ — game nông trại 2D kiểu Stardew Valley
   Canvas + Supabase (auth + lưu tiến trình theo tài khoản)
   ============================================================ */
"use strict";

/* ---------- Hằng số ---------- */
const TILE = 40, COLS = 24, ROWS = 15;
const W = COLS * TILE, H = ROWS * TILE;
const PLAYER_SPEED = 2.6;
const ENERGY = { till: 4, water: 2, plant: 3, harvest: 2 };
const START_GOLD = 500;

const CROPS = {
  turnip:  { name: "Củ cải",  emoji: "🥬", seedCost: 20,  sell: 40,  days: 2, xp: 4,  level: 1, color: "#e8e8f5", leaf: "#7ec850" },
  potato:  { name: "Khoai tây", emoji: "🥔", seedCost: 45,  sell: 95,  days: 4, xp: 9,  level: 2, color: "#c9a15f", leaf: "#5da23f" },
  corn:    { name: "Ngô",     emoji: "🌽", seedCost: 80,  sell: 170, days: 6, xp: 16, level: 3, color: "#f5c542", leaf: "#4c8a35" },
  tomato:  { name: "Cà chua", emoji: "🍅", seedCost: 120, sell: 95,  days: 7, xp: 22, level: 4, color: "#e04b3a", leaf: "#3f7a2e", regrow: 3 },
  pumpkin: { name: "Bí ngô",  emoji: "🎃", seedCost: 220, sell: 420, days: 9, xp: 40, level: 5, color: "#e88b1a", leaf: "#3a6d28" },
};
const CROP_IDS = Object.keys(CROPS);
const TOOLS = [
  { id: "hoe",    emoji: "⛏️", name: "Cuốc" },
  { id: "water",  emoji: "💧", name: "Bình tưới" },
  ...CROP_IDS.map((id) => ({ id: "seed_" + id, emoji: CROPS[id].emoji, name: "Hạt " + CROPS[id].name, seed: id })),
];

/* ---------- Bản đồ ---------- */
// Nhà (góc trên trái), cửa hàng (góc trên phải), ao (giữa), đất canh tác ở giữa
const HOUSE = { x: 1, y: 1, w: 5, h: 4 };   // ô chiếm chỗ + cửa ở (3,4)
const SHOP  = { x: 18, y: 1, w: 4, h: 3 };
const POND  = { x: 10, y: 2, w: 5, h: 3 };
const FARM  = { x: 3, y: 6, w: 18, h: 7 };  // vùng được phép cuốc đất
const DOOR  = { x: 3, y: 4 };
const SHOP_COUNTER = { x: 19, y: 4 };

function inRect(x, y, r) { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; }
function isSolid(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
  return inRect(x, y, HOUSE) || inRect(x, y, SHOP) || inRect(x, y, POND);
}
function isFarmTile(x, y) {
  return inRect(x, y, FARM) && !inRect(x, y, POND);
}

/* ---------- Trạng thái game ---------- */
let S = null; // state
function freshState() {
  return {
    v: 1,
    gold: START_GOLD,
    level: 1,
    xp: 0,
    day: 1,
    energy: 100,
    inv: { seed_turnip: 6 }, // quà khởi đầu
    tiles: {}, // "x,y" -> {t:1 (đã cuốc), w:1 (đã tưới), c:{id, stage, w, r}}
    px: 8 * TILE, py: 8 * TILE,
  };
}
const xpNeed = (lv) => lv * 50;

/* ---------- Canvas ---------- */
const cvs = document.getElementById("game-canvas");
const ctx = cvs.getContext("2d");
cvs.width = W; cvs.height = H;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
cvs.width = W * DPR; cvs.height = H * DPR;
cvs.style.aspectRatio = "1.5";
ctx.scale(DPR, DPR);

/* ---------- Input ---------- */
const keys = {};
let selectedSlot = 0;
let facing = { dx: 0, dy: 1 };

window.addEventListener("keydown", (e) => {
  if (authScreenVisible()) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  if (k >= "1" && k <= "6") {
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

/* ---------- Tiện ích ---------- */
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
let sb = null;          // supabase client
let currentUser = null; // { id, email }

function supabaseConfigured() {
  const c = window.SUPABASE_CONFIG || {};
  return typeof c.url === "string" &&
    /^https?:\/\/.+\.supabase\.(co|in)/.test(c.url) &&
    typeof c.anonKey === "string" && c.anonKey.length > 20 &&
    !c.url.includes("YOUR-PROJECT");
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
    // Tự động đăng nhập nếu phiên còn hiệu lực
    sb.auth.getSession().then(({ data }) => {
      if (data?.session?.user) onSignedIn(data.session.user);
    });
    sb.auth.onAuthStateChange((_ev, session) => {
      if (session?.user && (!currentUser || currentUser.id !== session.user.id)) onSignedIn(session.user);
    });
  } catch (err) {
    console.error("Supabase init failed:", err);
    $("cloud-status").textContent = "⚠️ Lỗi kết nối Supabase — dùng chế độ khách.";
  }
}

function authScreenVisible() { return !$("auth-screen").classList.contains("hidden"); }

// ---- UI auth ----
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
  } catch (e) {
    err.textContent = translateAuthError(e.message);
  } finally {
    $("auth-submit").disabled = false;
  }
};
function translateAuthError(msg) {
  if (/invalid login/i.test(msg)) return "Sai email hoặc mật khẩu.";
  if (/already registered/i.test(msg)) return "Email này đã được đăng ký — hãy đăng nhập.";
  if (/rate/i.test(msg)) return "Thử lại sau ít phút nhé (quá nhiều lần thử).";
  if (/valid email/i.test(msg)) return "Email không hợp lệ.";
  if (/at least 6/i.test(msg)) return "Mật khẩu cần tối thiểu 6 ký tự.";
  return msg;
}

$("auth-guest").onclick = () => {
  currentUser = null;
  startGame(loadLocal() || freshState());
};

$("btn-logout").onclick = async () => {
  if (sb) { try { await saveGame(true); await sb.auth.signOut(); } catch (_) {} }
  location.reload();
};

function onSignedIn(user) {
  currentUser = { id: user.id, email: user.email };
  $("auth-screen").classList.add("hidden");
  // Tải tiến trình đã lưu (nếu có)
  loadCloud().then((state) => {
    if (state) { S = state; toast("Đã tải tiến trình của bạn!"); }
    else { S = freshState(); toast("Chào mừng đến với nông trại mới!"); saveCloud(); }
    startGame(S);
  });
}

/* ---- Local (khách) ---- */
const LS_KEY = "farm_save_guest";
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch { return null; }
}
function saveLocal() {
  if (!S) return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (_) {}
}
function migrate(st) {
  // Đảm bảo đủ field khi load save cũ
  const f = freshState();
  return Object.assign(f, st, { inv: Object.assign({}, st.inv || {}) });
}

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
   BẮT ĐẦU GAME
   ============================================================ */
function startGame(state) {
  S = state;
  $("auth-screen").classList.add("hidden");
  $("game-root").classList.remove("hidden");
  renderToolbar();
  updateHUD();
  requestAnimationFrame(loop);
}

/* ============================================================
   VÒNG LẶP GAME
   ============================================================ */
let lastT = 0;
function loop(t) {
  const dt = Math.min((t - lastT) / 16.67, 3); lastT = t;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  let dx = 0, dy = 0;
  if (keys["w"] || keys["arrowup"]) dy -= 1;
  if (keys["s"] || keys["arrowdown"]) dy += 1;
  if (keys["a"] || keys["arrowleft"]) dx -= 1;
  if (keys["d"] || keys["arrowright"]) dx += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    facing = Math.abs(dx) > Math.abs(dy) ? { dx: Math.sign(dx), dy: 0 } : { dx: 0, dy: Math.sign(dy) };
    tryMove(dx * PLAYER_SPEED * dt, dy * PLAYER_SPEED * dt);
  }
}

function tryMove(mx, my) {
  const r = 12; // bán kính va chạm
  let nx = S.px + mx, ny = S.py + my;
  if (!collides(nx + Math.sign(mx) * r, S.py)) S.px = nx;
  if (!collides(S.px, ny + Math.sign(my) * r)) S.py = ny;
}
function collides(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return isSolid(tx, ty);
}

/* ============================================================
   HÀNH ĐỘNG (cuốc / trồng / tưới / thu hoạch)
   ============================================================ */
function facingTile() {
  const cx = Math.floor((S.px + TILE / 2) / TILE);
  const cy = Math.floor((S.py + TILE / 2) / TILE);
  return { x: cx + facing.dx, y: cy + facing.dy };
}
function keyOf(x, y) { return x + "," + y; }

function doAction() {
  const { x, y } = facingTile();
  const k = keyOf(x, y);
  const tool = TOOLS[selectedSlot];
  const tile = S.tiles[k];

  // 1) Thu hoạch luôn ưu tiên
  if (tile?.c && cropReady(tile.c)) { harvest(x, y, tile); return; }

  // 2) Ngủ / cửa hàng nếu đứng cạnh
  if (Math.abs(x - DOOR.x) <= 1 && Math.abs(y - DOOR.y) <= 1) { togglePanel("sleep-panel"); return; }
  if (Math.abs(x - SHOP_COUNTER.x) <= 1 && Math.abs(y - SHOP_COUNTER.y) <= 1) { togglePanel("shop-panel"); return; }

  // 3) Công cụ
  if (!isFarmTile(x, y)) { toast("Chỉ canh tác được trên đất ruộng!"); return; }
  if (S.energy <= 0) { toast("Quá mệt rồi! Hãy đi ngủ để hồi phục ⚡"); return; }

  if (tool.id === "hoe") {
    if (tile?.t) { toast("Đất đã được cuốc rồi."); return; }
    if (tile?.c) return;
    S.tiles[k] = { t: 1, w: 0, c: null };
    useEnergy(ENERGY.till);
    sfx("till");
  } else if (tool.id === "water") {
    if (!tile?.t) { toast("Cần cuốc đất trước đã!"); return; }
    if (tile.w) { toast("Đã tưới nước rồi."); return; }
    tile.w = 1;
    if (tile.c) tile.c.w = 1;
    useEnergy(ENERGY.water);
    sfx("water");
  } else if (tool.seed) {
    if (!tile?.t) { toast("Cần cuốc đất trước khi gieo hạt!"); return; }
    if (tile.c) { toast("Ô này đã có cây."); return; }
    const seedKey = "seed_" + tool.seed;
    if ((S.inv[seedKey] || 0) <= 0) { toast("Hết hạt giống! Mua ở cửa hàng 🏪"); return; }
    S.inv[seedKey]--;
    S.tiles[k].c = { id: tool.seed, stage: 0, w: 0, r: 0 };
    useEnergy(ENERGY.plant);
    sfx("plant");
    renderToolbar();
  }
  updateHUD();
}
function cropReady(c) { return c.stage >= CROPS[c.id].days; }

function harvest(x, y, tile) {
  const def = CROPS[tile.c.id];
  if (S.energy <= 0) { toast("Quá mệt rồi! Hãy đi ngủ để hồi phục ⚡"); return; }
  const key = "crop_" + tile.c.id;
  S.inv[key] = (S.inv[key] || 0) + 1;
  gainXP(def.xp);
  if (def.regrow) { tile.c.stage = def.days - def.regrow; tile.c.w = 0; }
  else { tile.c = null; tile.w = 0; tile.t = 1; }
  useEnergy(ENERGY.harvest);
  sfx("harvest");
  toast("Thu hoạch được 1 " + def.name + "! (+" + def.xp + " XP)");
  renderToolbar();
  updateHUD();
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
  // Cây chỉ lớn lên nếu đã được tưới hôm đó
  let grew = 0;
  for (const k in S.tiles) {
    const t = S.tiles[k];
    if (t.c && !cropReady(t.c) && t.c.w) {
      t.c.stage = Math.min(t.c.stage + 1, CROPS[t.c.id].days);
      grew++;
    }
    if (t.c) t.c.w = 0;
    t.w = 0;
  }
  S.day++;
  S.energy = 100;
  closePanels();
  toast("☀️ Ngày mới! " + (grew ? grew + " cây đã lớn lên." : "Đừng quên tưới nước!"));
  saveGame();
  updateHUD();
}
$("btn-sleep-confirm").onclick = doSleep;
// Hiện thông tin khi mở panel ngủ
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
      <span style="font-size:26px">${c.emoji}</span>
      <div class="grow">
        <div class="name">Hạt ${c.name}</div>
        <div class="desc">${c.days} ngày · bán ${c.sell}💰 · ${c.xp} XP ${c.regrow ? "· mọc lại 🌿" : ""} ${locked ? "· 🔒 Cần Lv." + c.level : ""}</div>
      </div>
      <button class="btn btn-small" ${locked || S.gold < c.seedCost ? "disabled" : ""}>${c.seedCost}💰</button>`;
    if (!locked) row.querySelector("button").onclick = () => {
      if (S.gold < c.seedCost) { toast("Không đủ vàng!"); return; }
      S.gold -= c.seedCost;
      S.inv["seed_" + id] = (S.inv["seed_" + id] || 0) + 1;
      sfx("buy");
      updateHUD(); renderToolbar(); renderShop();
      saveGame();
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
      <span style="font-size:26px">${c.emoji}</span>
      <div class="grow"><div class="name">${c.name} ×${S.inv[k]}</div>
      <div class="desc">Bán ${c.sell}💰/cái → tổng ${c.sell * S.inv[k]}💰</div></div>
      <button class="btn btn-small btn-primary">Bán tất cả</button>`;
    row.querySelector("button").onclick = () => {
      S.gold += c.sell * S.inv[k];
      S.inv[k] = 0;
      sfx("sell");
      toast("Đã bán " + c.name + "!");
      updateHUD(); renderBag(); renderToolbar();
      saveGame();
    };
    list.appendChild(row);
  });
  seedKeys.forEach((k) => {
    const id = k.slice(5), c = CROPS[id];
    const row = document.createElement("div");
    row.className = "bag-item";
    row.innerHTML = `<span style="font-size:26px">${c.emoji}</span>
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
   VẼ GAME (pixel-art bằng canvas)
   ============================================================ */
// Nền cỏ được tạo ngẫu nhiên 1 lần
const grassNoise = [];
for (let i = 0; i < 400; i++) grassNoise.push({ x: Math.random() * W, y: Math.random() * H, s: 1 + Math.random() * 2 });

function render() {
  drawGround();
  drawFarmTiles();
  drawBuildings();
  drawPlayer();
  drawTileHighlight();
}

function drawGround() {
  ctx.fillStyle = "#6aa84f";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.06)";
  grassNoise.forEach((g) => ctx.fillRect(g.x | 0, g.y | 0, g.s, g.s));
  // Vùng ruộng (đất hơi khác màu)
  ctx.fillStyle = "rgba(160,120,70,.25)";
  ctx.fillRect(FARM.x * TILE, FARM.y * TILE, FARM.w * TILE, FARM.h * TILE);
  // Ao
  const px = POND.x * TILE, py = POND.y * TILE, pw = POND.w * TILE, ph = POND.h * TILE;
  ctx.fillStyle = "#4a90d9";
  roundRect(px + 4, py + 4, pw - 8, ph - 8, 18, true);
  ctx.fillStyle = "rgba(255,255,255,.25)";
  roundRect(px + 12, py + 10, pw * 0.4, 6, 3, true);
}

function drawFarmTiles() {
  for (const k in S.tiles) {
    const [x, y] = k.split(",").map(Number);
    const t = S.tiles[k];
    const px = x * TILE, py = y * TILE;
    // Đất
    ctx.fillStyle = t.w ? "#5b3a1e" : "#8a5a2b";
    roundRect(px + 2, py + 2, TILE - 4, TILE - 4, 5, true);
    ctx.strokeStyle = "rgba(0,0,0,.15)";
    ctx.beginPath();
    ctx.moveTo(px + 6, py + 13); ctx.lineTo(px + TILE - 6, py + 13);
    ctx.moveTo(px + 6, py + 26); ctx.lineTo(px + TILE - 6, py + 26);
    ctx.stroke();
    // Cây
    if (t.c) drawCrop(px, py, t.c);
  }
}

function drawCrop(px, py, c) {
  const def = CROPS[c.id];
  const ready = cropReady(c);
  const cx = px + TILE / 2, base = py + TILE - 8;
  if (ready) {
    // Cây trưởng thành + hiệu ứng lấp lánh
    ctx.fillStyle = def.leaf;
    ctx.beginPath(); ctx.ellipse(cx, base - 14, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(cx, base - 18, 7, 0, Math.PI * 2); ctx.fill();
    const tw = Math.sin(performance.now() / 300 + px) * 0.5 + 0.5;
    if (tw > 0.6) { ctx.fillStyle = "rgba(255,255,180,.9)"; ctx.fillRect(px + 6, py + 6, 4, 4); }
  } else {
    // Theo giai đoạn: mầm → cây nhỏ → gần chín
    const hgt = 4 + (c.stage / def.days) * 16;
    ctx.strokeStyle = def.leaf; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx, base - hgt); ctx.stroke();
    ctx.fillStyle = def.leaf;
    const ls = 3 + (c.stage / def.days) * 5;
    ctx.beginPath(); ctx.ellipse(cx - ls, base - hgt, ls * 0.7, ls * 0.4, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + ls, base - hgt, ls * 0.7, ls * 0.4, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1;
  }
  // Giọt nước nếu đã tưới hôm nay
  if (c.w && !ready) { ctx.font = "10px sans-serif"; ctx.fillText("💧", px + TILE - 12, py + 10); }
}

function drawBuildings() {
  // Nhà
  const hx = HOUSE.x * TILE, hy = HOUSE.y * TILE, hw = HOUSE.w * TILE, hh = HOUSE.h * TILE;
  ctx.fillStyle = "#b5651d"; roundRect(hx, hy + 20, hw, hh - 20, 4, true);          // tường
  ctx.fillStyle = "#8b3a1a";                                                          // mái
  ctx.beginPath();
  ctx.moveTo(hx - 8, hy + 26); ctx.lineTo(hx + hw / 2, hy - 12); ctx.lineTo(hx + hw + 8, hy + 26);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#6b4423"; roundRect(hx + hw / 2 - 14, hy + hh - 34, 28, 34, 4, true); // cửa
  ctx.fillStyle = "#9fd48a"; ctx.font = "13px sans-serif"; ctx.fillText("🏠", hx + hw / 2 - 8, hy + hh - 12);
  ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif";
  ctx.fillText("Nhà của bạn", hx + 22, hy + hh + 14);
  // Cửa hàng
  const sx = SHOP.x * TILE, sy = SHOP.y * TILE, sw = SHOP.w * TILE, sh = SHOP.h * TILE;
  ctx.fillStyle = "#7a5230"; roundRect(sx, sy + 14, sw, sh - 14, 4, true);
  ctx.fillStyle = "#d9534f";
  ctx.beginPath(); ctx.moveTo(sx - 6, sy + 18); ctx.lineTo(sx + sw / 2, sy - 10); ctx.lineTo(sx + sw + 6, sy + 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif"; ctx.fillText("🏪 CỬA HÀNG", sx + 18, sy + 38);
  // Quầy bán hàng (nơi tương tác)
  const qx = SHOP_COUNTER.x * TILE, qy = SHOP_COUNTER.y * TILE;
  ctx.fillStyle = "#a0713f"; roundRect(qx, qy, TILE, TILE - 6, 4, true);
  ctx.fillStyle = "#f5c542"; ctx.font = "16px sans-serif"; ctx.fillText("💰", qx + 11, qy + 22);

  // Bảng chỉ dẫn
  ctx.fillStyle = "rgba(0,0,0,.45)"; roundRect(W / 2 - 150, H - 30, 300, 24, 8, true);
  ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("🏠 Đến cửa nhà để ngủ · 🏪 Đến quầy để mua/bán", W / 2, H - 13);
  ctx.textAlign = "left";
}

function drawPlayer() {
  const px = S.px, py = S.py;
  const bob = (Math.floor(performance.now() / 150) % 2) * 2;
  // bóng
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath(); ctx.ellipse(px + TILE / 2, py + TILE - 4, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
  // chân
  ctx.fillStyle = "#3a5a8a";
  ctx.fillRect(px + 12, py + 28, 6, 8 - bob / 2);
  ctx.fillRect(px + 22, py + 28, 6, 8 - (2 - bob) / 2);
  // thân (áo)
  ctx.fillStyle = "#e04b3a";
  roundRect(px + 10, py + 16, 20, 14, 4, true);
  // đầu
  ctx.fillStyle = "#f0c8a0";
  ctx.beginPath(); ctx.arc(px + TILE / 2, py + 10, 9, 0, Math.PI * 2); ctx.fill();
  // mũ nông dân
  ctx.fillStyle = "#f5c542";
  ctx.beginPath(); ctx.ellipse(px + TILE / 2, py + 4, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(px + TILE / 2, py - 1, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
  // mắt theo hướng
  ctx.fillStyle = "#222";
  const ex = px + TILE / 2 + facing.dx * 3, ey = py + 10 + facing.dy * 2;
  ctx.fillRect(ex - 3, ey, 2, 2); ctx.fillRect(ex + 2, ey, 2, 2);
}

function drawTileHighlight() {
  const { x, y } = facingTile();
  ctx.strokeStyle = "rgba(255,255,255,.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
  ctx.lineWidth = 1;
}

function roundRect(x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill(); else ctx.stroke();
}

/* ---- Âm thanh nhỏ bằng WebAudio ---- */
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
    const [freq, dur, wave] = map[type] || [440, 0.1, "sine"];
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (_) {}
}

/* ============================================================
   KHỞI ĐỘNG
   ============================================================ */
initSupabase();
if (!supabaseConfigured() && loadLocal()) {
  // Có save cũ trên máy → vào thẳng chế độ khách nếu người dùng muốn (vẫn hiện màn hình auth)
  $("cloud-status").textContent = "💾 Có tiến trình đã lưu trên máy này — chọn \"Chơi thử\" để tiếp tục.";
}
