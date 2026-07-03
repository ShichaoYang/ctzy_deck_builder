const state = {
  cards: [],
  extras: [],
  filtered: [],
  decks: [],
  activeDeckId: "",
  previewCard: null,
};

const els = {
  grid: document.querySelector("#cardGrid"),
  resultCount: document.querySelector("#resultCount"),
  search: document.querySelector("#searchInput"),
  faction: document.querySelector("#factionFilter"),
  type: document.querySelector("#typeFilter"),
  rarity: document.querySelector("#rarityFilter"),
  cost: document.querySelector("#costFilter"),
  sort: document.querySelector("#sortSelect"),
  quickFactions: document.querySelector("#quickFactions"),
  deckList: document.querySelector("#deckList"),
  deckTotal: document.querySelector("#deckTotal"),
  uniqueTotal: document.querySelector("#uniqueTotal"),
  leaderTotal: document.querySelector("#leaderTotal"),
  curve: document.querySelector("#curve"),
  deckTitle: document.querySelector("#deckTitle"),
  deckSelect: document.querySelector("#deckSelect"),
  mobileDeckToggle: document.querySelector("#mobileDeckToggle"),
  mobileDeckCount: document.querySelector("#mobileDeckCount"),
  deckPanel: document.querySelector("#deckPanel"),
  toast: document.querySelector("#toast"),
  preview: document.querySelector("#preview"),
  previewImage: document.querySelector("#previewImage"),
  previewSerial: document.querySelector("#previewSerial"),
  previewName: document.querySelector("#previewName"),
  previewMeta: document.querySelector("#previewMeta"),
  previewSkill: document.querySelector("#previewSkill"),
  previewUpgrade: document.querySelector("#previewUpgrade"),
  previewFlavor: document.querySelector("#previewFlavor"),
  shareImageModal: document.querySelector("#shareImageModal"),
  shareImagePreview: document.querySelector("#shareImagePreview"),
  downloadShareImage: document.querySelector("#downloadShareImage"),
};

const STORAGE_KEY = "ctzy-ty01-deck";
const DEFAULT_DECK_TITLE = "未命名牌组";
const leaders = new Set(["主帅"]);
const rarityOrder = ["至臻", "传说", "史诗", "稀有", "普通"];
const externalLink = "https://xyxxcx.sanguosha.com/h5/link.html?prefix=1JW4ZgBxdev";

init();

async function init() {
  const response = await fetch("data/cards.json?v=20260701c");
  const payload = await response.json();
  state.cards = payload.cards;
  state.extras = payload.extras || [];
  restoreDecks();
  fillFilters();
  bindEvents();
  applyFilters();
  renderDeck();
  importDeckFromUrl();
}

function bindEvents() {
  [els.search, els.faction, els.type, els.rarity, els.cost, els.sort].forEach((el) => {
    el.addEventListener("input", applyFilters);
  });
  document.querySelector("#clearFilters").addEventListener("click", clearFilters);
  document.querySelector("#clearDeck").addEventListener("click", clearDeck);
  document.querySelector("#generateDeckImage").addEventListener("click", generateDeckImage);
  document.querySelector("#importDeckImage").addEventListener("change", importDeckFromImage);
  document.querySelector("#copyDeck").addEventListener("click", copyDeck);
  document.querySelector("#renameDeck").addEventListener("click", renameDeck);
  document.querySelector("#newDeck").addEventListener("click", newDeck);
  document.querySelector("#deleteDeck").addEventListener("click", deleteDeck);
  els.deckSelect.addEventListener("change", switchDeck);
  document.querySelector("#openExternalLink").addEventListener("click", openExternalLink);
  document.querySelector("#closePreview").addEventListener("click", closePreview);
  document.querySelector("#closeShareImage").addEventListener("click", closeShareImage);
  document.querySelector("#previewAdd").addEventListener("click", () => {
    if (state.previewCard) addCard(state.previewCard.id);
  });
  els.preview.addEventListener("click", (event) => {
    if (event.target === els.preview) closePreview();
  });
  els.mobileDeckToggle.addEventListener("click", () => {
    els.deckPanel.classList.toggle("open");
  });
}

function openExternalLink() {
  const isDesktop = window.matchMedia("(min-width: 901px)").matches;
  if (!isDesktop) {
    window.location.assign(externalLink);
    return;
  }
  const opened = window.open(externalLink, "_blank", "noopener");
  if (!opened) showToast("浏览器拦截了新页面，请允许弹窗后重试");
}

function fillFilters() {
  fillSelect(els.faction, "全部势力", unique("faction"));
  fillSelect(els.type, "全部类别", uniqueTypes());
  fillSelect(els.rarity, "全部稀有度", sortRarities(unique("rarity")));
  fillSelect(els.cost, "全部", ["with", "without"], formatUpgradeFilterOption);

  els.quickFactions.innerHTML = "";
  unique("faction").forEach((faction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = faction;
    button.addEventListener("click", () => {
      els.faction.value = els.faction.value === faction ? "" : faction;
      applyFilters();
    });
    els.quickFactions.append(button);
  });
}

function fillSelect(select, label, values, formatter = (value) => value) {
  select.innerHTML = `<option value="">${label}</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = formatter(value);
    select.append(option);
  });
}

function formatUpgradeFilterOption(value) {
  return value === "with" ? "有界限突破" : "无界限突破";
}

function unique(key) {
  return [...new Set(state.cards.map((card) => String(card[key] ?? "")).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-Hans-CN", { numeric: true })
  );
}

function applyFilters() {
  const query = els.search.value.trim().toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  state.filtered = state.cards.filter((card) => {
    const haystack = [card.id, card.serial, card.name, card.traditionalName, card.title, card.skill, card.upgrade, card.artist]
      .join(" ")
      .toLowerCase();
    const matchesQuery = terms.every((term) => haystack.includes(term));
    return (
      matchesQuery &&
      matches(card.faction, els.faction.value) &&
      matchesType(card, els.type.value) &&
      matches(card.rarity, els.rarity.value) &&
      matchesUpgrade(card, els.cost.value)
    );
  });

  sortCards(state.filtered);
  syncQuickButtons();
  renderGrid();
}

function matches(value, expected) {
  return !expected || String(value) === expected;
}

function splitTypes(value) {
  return String(value || "")
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueTypes() {
  return [...new Set(state.cards.flatMap((card) => splitTypes(card.type)))].sort((a, b) =>
    a.localeCompare(b, "zh-Hans-CN", { numeric: true })
  );
}

function matchesType(card, expected) {
  return !expected || splitTypes(card.type).includes(expected);
}

function matchesUpgrade(card, expected) {
  if (!expected) return true;
  const hasUpgrade = Boolean(String(card.upgrade || "").trim());
  return expected === "with" ? hasUpgrade : !hasUpgrade;
}

function sortCards(cards) {
  const mode = els.sort.value;
  cards.sort((a, b) => {
    if (mode === "cost") return a.cost - b.cost || bySerial(a, b);
    if (mode === "name") return a.name.localeCompare(b.name, "zh-Hans-CN") || bySerial(a, b);
    if (mode === "rarity") return byRarity(a, b) || bySerial(a, b);
    return bySerial(a, b);
  });
}

function sortRarities(values) {
  return [...values].sort((a, b) => rarityRank(a) - rarityRank(b) || a.localeCompare(b, "zh-Hans-CN"));
}

function rarityRank(rarity) {
  const index = rarityOrder.indexOf(rarity);
  return index === -1 ? rarityOrder.length : index;
}

function byRarity(a, b) {
  return rarityRank(a.rarity) - rarityRank(b.rarity);
}

function byLeader(a, b) {
  return Number(leaders.has(b.type)) - Number(leaders.has(a.type));
}
function bySerial(a, b) {
  return a.id.localeCompare(b.id, "zh-Hans-CN", { numeric: true });
}

function syncQuickButtons() {
  [...els.quickFactions.children].forEach((button) => {
    button.classList.toggle("active", button.textContent === els.faction.value);
  });
}

function renderGrid() {
  els.resultCount.textContent = `${state.filtered.length} 张卡`;
  const cards = [...state.filtered, ...state.extras];
  els.grid.innerHTML = cards.map(cardTile).join("");

  els.grid.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => addCard(button.dataset.add));
  });
  els.grid.querySelectorAll("[data-preview]").forEach((button) => {
    button.addEventListener("click", () => openPreview(button.dataset.preview));
  });
}

function cardTile(card) {
  const name = cardDisplayName(card);
  const inDeck = activeCards()[card.id] || 0;
  return `
    <article class="card-tile">
      <div class="card-art">
        ${card.image ? `<img src="${card.image}" alt="${escapeHtml(name)}">` : `<div class="missing-art">暂无图片</div>`}
        <button type="button" data-preview="${card.id}" aria-label="查看 ${escapeHtml(name)}"></button>
      </div>
      <div class="card-info">
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(card.serial)} · ${escapeHtml(card.faction)} · ${escapeHtml(card.type)} · ${escapeHtml(card.rarity)}</p>
        <p>${card.cost ? `休整${card.cost}` : "无休整"}</p>
        <div class="card-actions">
          <button type="button" data-add="${card.id}">加入${inDeck ? ` (${inDeck})` : ""}</button>
          <button type="button" data-preview="${card.id}">详情</button>
        </div>
      </div>
    </article>
  `;
}

function addCard(id, amount = 1) {
  const card = findCard(id);
  if (!card) return;
  const cards = activeCards();
  const current = cards[id] || 0;
  const max = leaders.has(card.type) ? 1 : 3;
  const next = Math.min(max, current + amount);
  if (next === current) {
    showToast(`${cardDisplayName(card)} 已达到上限`);
    return;
  }
  cards[id] = next;
  saveDecks();
  renderDeck();
  renderGrid();
}

function removeCard(id, amount = 1) {
  const cards = activeCards();
  const current = cards[id] || 0;
  const next = current - amount;
  if (next > 0) {
    cards[id] = next;
  } else {
    delete cards[id];
  }
  saveDecks();
  renderDeck();
  renderGrid();
}

function renderDeck() {
  const deck = activeDeck();
  const entries = deckEntries();
  const total = entries.reduce((sum, item) => sum + item.qty, 0);
  const leaderTotal = entries.filter((item) => leaders.has(item.card.type)).reduce((sum, item) => sum + item.qty, 0);
  els.deckTitle.textContent = deck.title;
  els.deckTotal.textContent = total;
  els.uniqueTotal.textContent = entries.length;
  els.leaderTotal.textContent = leaderTotal;
  els.mobileDeckCount.textContent = total;
  renderDeckSelect();
  renderCurve(entries);
  els.deckList.innerHTML = entries.length ? entries.map(deckRow).join("") : `<p class="empty">点击卡牌上的“加入”开始组卡。</p>`;

  els.deckList.querySelectorAll("[data-inc]").forEach((button) => {
    button.addEventListener("click", () => addCard(button.dataset.inc));
  });
  els.deckList.querySelectorAll("[data-dec]").forEach((button) => {
    button.addEventListener("click", () => removeCard(button.dataset.dec));
  });
}

function renderDeckSelect() {
  els.deckSelect.innerHTML = state.decks
    .map((deck) => `<option value="${deck.id}">${escapeHtml(deck.title)} (${deckTotal(deck.cards)})</option>`)
    .join("");
  els.deckSelect.value = state.activeDeckId;
}

function deckEntries(deck = activeDeck()) {
  return Object.entries(deck.cards || {})
    .map(([id, qty]) => ({ card: findCard(id), qty }))
    .filter((item) => item.card)
    .sort((a, b) => a.card.cost - b.card.cost || bySerial(a.card, b.card));
}

function deckRow({ card, qty }) {
  const name = cardDisplayName(card);
  return `
    <div class="deck-row">
      ${card.image ? `<img src="${card.image}" alt="${escapeHtml(name)}">` : `<div></div>`}
      <div>
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(card.id)} · ${escapeHtml(card.faction)} · ${escapeHtml(card.type)} · ${card.cost ? `休整${card.cost}` : "无休整"}</p>
      </div>
      <div class="qty">
        <button type="button" data-dec="${card.id}" aria-label="减少">-</button>
        <span>${qty}</span>
        <button type="button" data-inc="${card.id}" aria-label="增加">+</button>
      </div>
    </div>
  `;
}

function renderCurve(entries) {
  const buckets = [
    ["0", "无休整"],
    ["1", "休整1"],
    ["2", "休整2"],
  ];
  els.curve.innerHTML = buckets
    .map(([cost, label]) => {
      const qty = entries.filter((item) => String(item.card.cost) === cost).reduce((sum, item) => sum + item.qty, 0);
      return `<div class="curve-item"><span>${label}</span><strong>${qty}</strong></div>`;
    })
    .join("");
}

function findCard(id) {
  return state.cards.find((card) => card.id === id) || state.extras.find((card) => card.id === id);
}

function clearFilters() {
  els.search.value = "";
  els.faction.value = "";
  els.type.value = "";
  els.rarity.value = "";
  els.cost.value = "";
  els.sort.value = "serial";
  applyFilters();
}

function clearDeck() {
  if (!Object.keys(activeCards()).length) return;
  if (!confirm("确定清空当前牌组吗？")) return;
  activeDeck().cards = {};
  saveDecks();
  renderDeck();
  renderGrid();
}

function renameDeck() {
  const deck = activeDeck();
  const next = prompt("牌组名称", deck.title);
  if (!next) return;
  deck.title = next.trim();
  saveDecks();
  renderDeck();
}

function newDeck() {
  const title = prompt("新牌组名称", `牌组 ${state.decks.length + 1}`);
  if (!title) return;
  const deck = createDeck(title.trim());
  state.decks.push(deck);
  state.activeDeckId = deck.id;
  saveDecks();
  renderDeck();
  renderGrid();
  showToast("已新建牌组");
}

function deleteDeck() {
  if (state.decks.length <= 1) {
    showToast("至少保留一套牌组");
    return;
  }
  const deck = activeDeck();
  if (!confirm(`确定删除“${deck.title}”吗？`)) return;
  state.decks = state.decks.filter((item) => item.id !== deck.id);
  state.activeDeckId = state.decks[0].id;
  saveDecks();
  renderDeck();
  renderGrid();
}

function switchDeck() {
  state.activeDeckId = els.deckSelect.value;
  saveDecks();
  renderDeck();
  renderGrid();
}

function loadStarter() {
  const faction = els.faction.value || prompt("输入要导入的预组势力：魏、蜀、吴、群", "魏");
  if (!faction) return;
  const next = {};
  state.cards.forEach((card) => {
    if (card.starterDeck === `预组${faction}` && card.starterCount > 0) {
      next[card.id] = card.starterCount;
    }
  });
  if (!Object.keys(next).length) {
    showToast(`没有找到“预组${faction}”`);
    return;
  }
  activeDeck().cards = next;
  activeDeck().title = `TY01 预组${faction}`;
  saveDecks();
  renderDeck();
  renderGrid();
  showToast(`已导入预组${faction}`);
}

async function copyDeck() {
  const text = deckText();
  if (!text) {
    showToast("牌组为空");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制牌组清单");
  } catch {
    showToast("浏览器不允许写入剪贴板");
  }
}

async function exportDeck() {
  const payload = JSON.stringify({ version: 2, activeDeckId: state.activeDeckId, decks: state.decks }, null, 2);
  try {
    await navigator.clipboard.writeText(payload);
    showToast("已导出全部牌组到剪贴板");
  } catch {
    prompt("浏览器不允许自动写入剪贴板，请手动复制下面的全部牌组 JSON", payload);
  }
}

async function importDeck() {
  let text = "";
  try {
    text = await navigator.clipboard.readText();
  } catch {
    text = prompt("浏览器不允许自动读取剪贴板，请粘贴牌组 JSON", "") || "";
  }

  try {
    const payload = JSON.parse(text);
    applyImportedDecks(payload);
    saveDecks();
    renderDeck();
    renderGrid();
    showToast("已从剪贴板导入牌组");
  } catch {
    showToast("剪贴板里不是有效牌组 JSON");
  }
}

async function generateDeckImage() {
  const deck = activeDeck();
  const entries = deckEntriesByRarity(deck);
  if (!entries.length) {
    showToast("牌组为空");
    return;
  }
  if (!window.QRCode?.toCanvas) {
    showToast("二维码生成库加载失败，请刷新后重试");
    return;
  }

  showToast("正在生成长图...");
  const shareUrl = buildShareUrl(deck);
  const cols = 4;
  const cardW = 230;
  const cardH = Math.round(cardW * 1039 / 744);
  const gap = 20;
  const pad = 34;
  const headerH = 116;
  const footerH = 230;
  const rows = Math.ceil(entries.length / cols);
  const width = pad * 2 + cols * cardW + (cols - 1) * gap;
  const height = pad + headerH + rows * cardH + Math.max(0, rows - 1) * gap + footerH + pad;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f3f1eb";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#1e2428";
  ctx.font = "700 42px Microsoft YaHei, sans-serif";
  ctx.fillText(deck.title || DEFAULT_DECK_TITLE, pad, pad + 44);
  ctx.font = "24px Microsoft YaHei, sans-serif";
  ctx.fillStyle = "#6b716e";
  ctx.fillText(`总张数 ${deckTotal(deck.cards)} · 不同卡 ${entries.length}`, pad, pad + 84);

  for (let index = 0; index < entries.length; index += 1) {
    const { card, qty } = entries[index];
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = pad + col * (cardW + gap);
    const y = pad + headerH + row * (cardH + gap);
    await drawCardImage(ctx, card, x, y, cardW, cardH);
    drawQuantityBadge(ctx, qty, x + cardW - 58, y + cardH - 48);
  }

  const qrSize = 180;
  const footerTop = height - pad - footerH + 24;
  ctx.fillStyle = "#1e2428";
  ctx.font = "700 30px Microsoft YaHei, sans-serif";
  ctx.fillText("扫码导入这套牌", pad, footerTop + 38);
  ctx.font = "20px Microsoft YaHei, sans-serif";
  ctx.fillStyle = "#6b716e";
  wrapCanvasText(ctx, shareUrl, pad, footerTop + 78, width - pad * 3 - qrSize, 28, 3);
  await drawQr(ctx, shareUrl, width - pad - qrSize, height - pad - qrSize, qrSize);

  const dataUrl = canvas.toDataURL("image/png");
  els.shareImagePreview.src = dataUrl;
  els.downloadShareImage.href = dataUrl;
  els.downloadShareImage.download = `${safeFilename(deck.title || "ctzy-deck")}.png`;
  els.shareImageModal.hidden = false;
  showToast("长图已生成");
}

function closeShareImage() {
  els.shareImageModal.hidden = true;
}

function deckEntriesByRarity(deck = activeDeck()) {
  return deckEntries(deck).sort((a, b) => byLeader(a.card, b.card) || byRarity(a.card, b.card) || a.card.cost - b.card.cost || bySerial(a.card, b.card));
}

async function drawCardImage(ctx, card, x, y, width, height) {
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(x, y, width, height);
  try {
    const img = await loadImage(card.image);
    ctx.drawImage(img, x, y, width, height);
  } catch {
    ctx.fillStyle = "#d9d4c8";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = "#1e2428";
    ctx.font = "24px Microsoft YaHei, sans-serif";
    ctx.fillText(cardDisplayName(card), x + 14, y + 44, width - 28);
  }
}

function drawQuantityBadge(ctx, qty, x, y) {
  ctx.fillStyle = "rgba(159, 59, 53, 0.94)";
  roundRect(ctx, x, y, 52, 38, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "700 24px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`x${qty}`, x + 26, y + 20);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  let line = "";
  let lines = 0;
  for (const char of text) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = char;
      lines += 1;
      if (lines >= maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
}

async function drawQr(ctx, text, x, y, size) {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, text, { width: size, margin: 1, errorCorrectionLevel: "M" });
  ctx.drawImage(qrCanvas, x, y, size, size);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function buildShareUrl(deck) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("deck", encodeDeckPayload(deck));
  return url.toString();
}

function encodeDeckPayload(deck) {
  const payload = {
    t: deck.title || DEFAULT_DECK_TITLE,
    c: Object.entries(deck.cards || {})
      .filter(([, qty]) => Number(qty) > 0)
      .map(([id, qty]) => [compactShareCardId(id), qty])
      .sort(),
  };
  return base64UrlEncode(JSON.stringify(payload));
}

function decodeDeckPayload(code) {
  const payload = JSON.parse(base64UrlDecode(code));
  const cards = {};
  for (const [rawId, qty] of payload.c || []) {
    const id = expandShareCardId(rawId);
    const card = findCard(id);
    if (card) cards[id] = Math.max(1, Math.min(Number(qty) || 1, leaders.has(card.type) ? 1 : 3));
  }
  return { title: payload.t || "导入牌组", cards };
}

function compactShareCardId(id) {
  return String(id).replace(/^TY01-/, "");
}

function expandShareCardId(id) {
  const text = String(id || "").trim();
  if (!text) return "";
  return text.includes("-") ? text : `TY01-${text.padStart(3, "0")}`;
}

function base64UrlEncode(text) {
  return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(text) {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - text.length % 4) % 4);
  return decodeURIComponent(escape(atob(base64)));
}

function importDeckFromUrl() {
  const code = new URL(window.location.href).searchParams.get("deck");
  if (!code) return;
  try {
    importSharedDeck(decodeDeckPayload(code));
    const clean = new URL(window.location.href);
    clean.searchParams.delete("deck");
    window.history.replaceState({}, "", clean.toString());
    showToast("已从二维码链接导入牌组");
  } catch {
    showToast("二维码链接里的牌组数据无效");
  }
}

function importSharedDeck(deckData) {
  if (!Object.keys(deckData.cards || {}).length) throw new Error("Empty deck");
  const deck = createDeck(deckData.title || "导入牌组", deckData.cards);
  state.decks.push(deck);
  state.activeDeckId = deck.id;
  saveDecks();
  renderDeck();
  renderGrid();
}

async function importDeckFromImage(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const text = await readQrFromImage(file);
    const code = deckCodeFromQrText(text);
    if (!code) throw new Error("No deck code");
    importSharedDeck(decodeDeckPayload(code));
    showToast("已从长图导入牌组");
  } catch {
    showToast("没有识别到有效的卡组二维码");
  }
}

async function readQrFromImage(file) {
  if ("BarcodeDetector" in window) {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const bitmap = await createImageBitmap(file);
    const codes = await detector.detect(bitmap);
    if (codes.length) return codes[0].rawValue;
  }
  if (window.jsQR) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImage(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const cropSize = Math.min(canvas.width, canvas.height, Math.max(360, Math.round(Math.min(canvas.width, canvas.height) * 0.45)));
      const cropX = Math.max(0, canvas.width - cropSize);
      const cropY = Math.max(0, canvas.height - cropSize);
      const cropped = readQrFromCanvas(ctx, cropX, cropY, cropSize, cropSize);
      if (cropped) return cropped;
      const full = readQrFromCanvas(ctx, 0, 0, canvas.width, canvas.height);
      if (full) return full;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  throw new Error("No QR code");
}

function readQrFromCanvas(ctx, x, y, width, height) {
  const imageData = ctx.getImageData(x, y, width, height);
  return jsQR(imageData.data, width, height)?.data || "";
}

function deckCodeFromQrText(text) {
  try {
    return new URL(text).searchParams.get("deck");
  } catch {
    return text?.trim() || "";
  }
}

function safeFilename(value) {
  return String(value).replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60) || "ctzy-deck";
}
function deckText() {
  const entries = deckEntries();
  if (!entries.length) return "";
  return [
    activeDeck().title,
    ...entries.map(({ card, qty }) => `${qty} ${card.id} ${cardDisplayName(card)} (${card.faction}/${card.type}/${card.rarity})`),
  ].join("\n");
}

function openPreview(id) {
  const card = findCard(id);
  if (!card) return;
  state.previewCard = card;
  els.previewImage.src = card.image || "";
  els.previewImage.alt = cardDisplayName(card);
  els.previewSerial.textContent = card.serial;
  els.previewName.textContent = cardDisplayName(card);
  els.previewMeta.textContent = `${card.faction} · ${card.type} · ${card.rarity} · ${card.cost ? `休整${card.cost}` : "无休整"} · ${card.artist || "未知画师"}`;
  els.previewSkill.textContent = card.skill || "暂无技能文本";
  els.previewUpgrade.textContent = card.upgrade || "";
  els.previewFlavor.textContent = card.flavor ? `风味：${card.flavor}` : "";
  els.preview.hidden = false;
}

function closePreview() {
  els.preview.hidden = true;
  state.previewCard = null;
}

function activeDeck() {
  let deck = state.decks.find((item) => item.id === state.activeDeckId);
  if (!deck) {
    deck = state.decks[0] || createDeck(DEFAULT_DECK_TITLE);
    if (!state.decks.length) state.decks.push(deck);
    state.activeDeckId = deck.id;
  }
  deck.cards ||= {};
  deck.title ||= DEFAULT_DECK_TITLE;
  return deck;
}

function activeCards() {
  return activeDeck().cards;
}

function createDeck(title, cards = {}) {
  return {
    id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title || DEFAULT_DECK_TITLE,
    cards,
  };
}

function deckTotal(cards) {
  return Object.values(cards || {}).reduce((sum, qty) => sum + Number(qty || 0), 0);
}

function normalizeDeck(deck, fallbackTitle = DEFAULT_DECK_TITLE) {
  return {
    id: deck.id || createDeck().id,
    title: deck.title || fallbackTitle,
    cards: deck.cards || deck.deck || {},
  };
}

function applyImportedDecks(payload, replace = true) {
  let decks = [];
  let activeDeckId = "";

  if (Array.isArray(payload.decks)) {
    decks = payload.decks.map((deck, index) => normalizeDeck(deck, `牌组 ${index + 1}`));
    activeDeckId = payload.activeDeckId || decks[0]?.id || "";
  } else if (payload.deck || payload.cards) {
    const title = payload.title || DEFAULT_DECK_TITLE;
    decks = [createDeck(title, payload.deck || payload.cards || {})];
    activeDeckId = decks[0].id;
  }

  if (!decks.length) {
    if (replace) throw new Error("No decks found");
    decks = [createDeck(DEFAULT_DECK_TITLE)];
    activeDeckId = decks[0].id;
  }

  state.decks = decks;
  state.activeDeckId = decks.some((deck) => deck.id === activeDeckId) ? activeDeckId : decks[0].id;
}

function saveDecks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, activeDeckId: state.activeDeckId, decks: state.decks }));
}

function restoreDecks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    applyImportedDecks(saved, false);
  } catch {
    state.decks = [createDeck(DEFAULT_DECK_TITLE)];
    state.activeDeckId = state.decks[0].id;
  }
}

function cardDisplayName(card) {
  return card.title ? `${card.title}·${card.name}` : card.name;
}
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1800);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

