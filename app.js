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
};

const STORAGE_KEY = "ctzy-ty01-deck";
const DEFAULT_DECK_TITLE = "未命名牌组";
const leaders = new Set(["主帅"]);

init();

async function init() {
  const response = await fetch("data/cards.json");
  const payload = await response.json();
  state.cards = payload.cards;
  state.extras = payload.extras || [];
  restoreDecks();
  fillFilters();
  bindEvents();
  applyFilters();
  renderDeck();
}

function bindEvents() {
  [els.search, els.faction, els.type, els.rarity, els.cost, els.sort].forEach((el) => {
    el.addEventListener("input", applyFilters);
  });
  document.querySelector("#clearFilters").addEventListener("click", clearFilters);
  document.querySelector("#clearDeck").addEventListener("click", clearDeck);
  document.querySelector("#copyDeck").addEventListener("click", copyDeck);
  document.querySelector("#exportDeck").addEventListener("click", exportDeck);
  document.querySelector("#importDeck").addEventListener("click", importDeck);
  document.querySelector("#renameDeck").addEventListener("click", renameDeck);
  document.querySelector("#newDeck").addEventListener("click", newDeck);
  document.querySelector("#deleteDeck").addEventListener("click", deleteDeck);
  els.deckSelect.addEventListener("change", switchDeck);
  document.querySelector("#loadStarter").addEventListener("click", loadStarter);
  document.querySelector("#closePreview").addEventListener("click", closePreview);
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

function fillFilters() {
  fillSelect(els.faction, "全部势力", unique("faction"));
  fillSelect(els.type, "全部类别", unique("type"));
  fillSelect(els.rarity, "全部稀有度", unique("rarity"));
  fillSelect(els.cost, "全部休整", unique("cost").sort((a, b) => Number(a) - Number(b)));

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

function fillSelect(select, label, values) {
  select.innerHTML = `<option value="">${label}</option>`;
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === "0" || value === 0 ? "无休整" : `休整${value}`;
    select.append(option);
  });
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
    const haystack = [card.id, card.serial, card.name, card.traditionalName, card.title, card.skill, card.artist]
      .join(" ")
      .toLowerCase();
    const matchesQuery = terms.every((term) => haystack.includes(term));
    return (
      matchesQuery &&
      matches(card.faction, els.faction.value) &&
      matches(card.type, els.type.value) &&
      matches(card.rarity, els.rarity.value) &&
      matches(String(card.cost), els.cost.value)
    );
  });

  sortCards(state.filtered);
  syncQuickButtons();
  renderGrid();
}

function matches(value, expected) {
  return !expected || String(value) === expected;
}

function sortCards(cards) {
  const mode = els.sort.value;
  cards.sort((a, b) => {
    if (mode === "cost") return a.cost - b.cost || bySerial(a, b);
    if (mode === "name") return a.name.localeCompare(b.name, "zh-Hans-CN") || bySerial(a, b);
    if (mode === "rarity") return a.rarity.localeCompare(b.rarity, "zh-Hans-CN") || bySerial(a, b);
    return bySerial(a, b);
  });
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
  const inDeck = activeCards()[card.id] || 0;
  return `
    <article class="card-tile">
      <div class="card-art">
        ${card.image ? `<img src="${card.image}" alt="${escapeHtml(card.name)}">` : `<div class="missing-art">暂无图片</div>`}
        <button type="button" data-preview="${card.id}" aria-label="查看 ${escapeHtml(card.name)}"></button>
      </div>
      <div class="card-info">
        <h3>${escapeHtml(card.name)}</h3>
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
    showToast(`${card.name} 已达到上限`);
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
  return `
    <div class="deck-row">
      ${card.image ? `<img src="${card.image}" alt="${escapeHtml(card.name)}">` : `<div></div>`}
      <div>
        <h3>${escapeHtml(card.name)}</h3>
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

function deckText() {
  const entries = deckEntries();
  if (!entries.length) return "";
  return [
    activeDeck().title,
    ...entries.map(({ card, qty }) => `${qty} ${card.id} ${card.name} (${card.faction}/${card.type}/${card.rarity})`),
  ].join("\n");
}

function openPreview(id) {
  const card = findCard(id);
  if (!card) return;
  state.previewCard = card;
  els.previewImage.src = card.image || "";
  els.previewImage.alt = card.name;
  els.previewSerial.textContent = card.serial;
  els.previewName.textContent = `${card.title ? `${card.title} ` : ""}${card.name}`;
  els.previewMeta.textContent = `${card.faction} · ${card.type} · ${card.rarity} · ${card.cost ? `休整${card.cost}` : "无休整"} · ${card.artist || "未知画师"}`;
  els.previewSkill.textContent = card.skill || "暂无技能文本";
  els.previewUpgrade.textContent = card.upgrade ? `升级：${card.upgrade}` : "";
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


