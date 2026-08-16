const pageNames = {
  home: "控制中心",
  equipment: "装备词条",
  resources: "资源计算",
  modules: "定制模组记录",
};

const panels = document.querySelectorAll("[data-view-panel]");
const navItems = document.querySelectorAll("[data-view]");
const openButtons = document.querySelectorAll("[data-open-view]");
const currentPage = document.querySelector("#currentPage");
const sidebar = document.querySelector("#sidebar");
const overlay = document.querySelector("#sidebarOverlay");
const menuButton = document.querySelector("#menuButton");

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
}

function openView(view, updateHash = true) {
  const target = pageNames[view] ? view : "home";

  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.viewPanel === target);
  });

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.view === target);
  });

  currentPage.textContent = pageNames[target];
  document.title = `${pageNames[target]} · NIKKE 指挥官工具箱`;

  if (updateHash) history.pushState(null, "", `#${target}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  closeSidebar();
}

navItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    openView(item.dataset.view);
  });
});

openButtons.forEach((button) => {
  button.addEventListener("click", () => openView(button.dataset.openView));
});

menuButton.addEventListener("click", () => {
  const isOpen = sidebar.classList.toggle("open");
  overlay.classList.toggle("open", isOpen);
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

overlay.addEventListener("click", closeSidebar);

window.addEventListener("popstate", () => {
  openView(window.location.hash.slice(1) || "home", false);
});

const formatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
document.querySelector("#currentDate").textContent = formatter.format(new Date());

openView(window.location.hash.slice(1) || "home", false);

// Equipment attribute manager
const ATTRIBUTE_DEFINITIONS = [
  { id: "element", name: "优越代码伤害增加", min: 9.54, max: 29.16 },
  { id: "hit", name: "命中率增加", min: 4.77, max: 14.63 },
  { id: "ammo", name: "最大装弹数增加", min: 27.84, max: 85.37 },
  { id: "attack", name: "攻击力增加", min: 4.77, max: 14.63 },
  { id: "chargeDamage", name: "蓄力伤害增加", min: 4.77, max: 14.63 },
  { id: "chargeSpeed", name: "蓄力速度增加", min: 1.98, max: 6.09 },
  { id: "critRate", name: "暴击率增加", min: 2.30, max: 7.07 },
  { id: "critDamage", name: "暴击伤害增加", min: 6.64, max: 20.36 },
  { id: "defense", name: "防御力增加", min: 4.77, max: 14.63 },
];

const EQUIPMENT_SLOTS = {
  head: { name: "头部", fullName: "头部装备", index: "01" },
  chest: { name: "躯干", fullName: "躯干装备", index: "02" },
  arms: { name: "手臂", fullName: "手臂装备", index: "03" },
  legs: { name: "腿部", fullName: "腿部装备", index: "04" },
};

const STORAGE_KEY = "nikke-equipment-manager-v1";
let equipmentData = loadEquipmentData();
let activeCharacterId = equipmentData.activeCharacterId;
let activeSlot = "head";
let previewObjectUrl = "";

const equipmentElements = {
  characterSelect: document.querySelector("#characterSelect"),
  addCharacterButton: document.querySelector("#addCharacterButton"),
  deleteCharacterButton: document.querySelector("#deleteCharacterButton"),
  recordedCount: document.querySelector("#recordedCount"),
  totalTierCount: document.querySelector("#totalTierCount"),
  aggregateGrid: document.querySelector("#aggregateGrid"),
  slotTabs: document.querySelector("#slotTabs"),
  selectedSlotIndex: document.querySelector("#selectedSlotIndex"),
  selectedSlotName: document.querySelector("#selectedSlotName"),
  slotState: document.querySelector("#slotState"),
  attributeList: document.querySelector("#attributeList"),
  referenceList: document.querySelector("#referenceList"),
  uploadTrigger: document.querySelector("#uploadTrigger"),
  imageInput: document.querySelector("#equipmentImageInput"),
  dialog: document.querySelector("#equipmentDialog"),
  form: document.querySelector("#equipmentForm"),
  preview: document.querySelector("#equipmentPreview"),
  scanProgress: document.querySelector("#scanProgress"),
  scanMessage: document.querySelector("#scanMessage"),
  resultRows: document.querySelector("#resultRows"),
  dialogSubtitle: document.querySelector("#dialogSubtitle"),
};

function makeCharacter(name) {
  return {
    id: `character-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    equipment: { head: [], chest: [], arms: [], legs: [] },
  };
}

function loadEquipmentData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.characters?.length) {
      saved.characters.forEach((character) => {
        character.equipment = { head: [], chest: [], arms: [], legs: [], ...character.equipment };
      });
      return saved;
    }
  } catch (error) {
    console.warn("Unable to restore equipment data", error);
  }
  const character = makeCharacter("默认角色");
  return { activeCharacterId: character.id, characters: [character] };
}

function persistEquipmentData() {
  equipmentData.activeCharacterId = activeCharacterId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(equipmentData));
}

function getActiveCharacter() {
  return equipmentData.characters.find((character) => character.id === activeCharacterId) || equipmentData.characters[0];
}

function getAttributeDefinition(id) {
  return ATTRIBUTE_DEFINITIONS.find((definition) => definition.id === id);
}

function getTiers(definition) {
  return Array.from({ length: 15 }, (_, index) =>
    Number((definition.min + ((definition.max - definition.min) * index) / 14).toFixed(2)),
  );
}

function nearestTier(attributeId, value) {
  const definition = getAttributeDefinition(attributeId);
  if (!definition || !Number.isFinite(value)) return null;
  const tiers = getTiers(definition);
  let index = 0;
  tiers.forEach((tier, tierIndex) => {
    if (Math.abs(tier - value) < Math.abs(tiers[index] - value)) index = tierIndex;
  });
  return { level: index + 1, value: tiers[index], difference: Math.abs(tiers[index] - value) };
}

function renderReferenceList() {
  equipmentElements.referenceList.replaceChildren(
    ...ATTRIBUTE_DEFINITIONS.map((definition) => {
      const item = document.createElement("div");
      item.className = "reference-item";
      const name = document.createElement("strong");
      name.textContent = definition.name;
      const range = document.createElement("span");
      range.textContent = `${definition.min.toFixed(2)}% — ${definition.max.toFixed(2)}%`;
      const levels = document.createElement("small");
      levels.textContent = getTiers(definition).map((value) => value.toFixed(2)).join(" · ");
      item.append(name, range, levels);
      return item;
    }),
  );
}

function renderCharacterSelect() {
  equipmentElements.characterSelect.replaceChildren(
    ...equipmentData.characters.map((character) => {
      const option = document.createElement("option");
      option.value = character.id;
      option.textContent = character.name;
      option.selected = character.id === activeCharacterId;
      return option;
    }),
  );
  equipmentElements.deleteCharacterButton.disabled = equipmentData.characters.length === 1;
}

function renderAttributeSummary(character) {
  const allAttributes = Object.values(character.equipment).flatMap((attributes) => attributes || []);
  const totals = new Map();
  let totalTiers = 0;

  allAttributes.forEach((attribute) => {
    const definition = getAttributeDefinition(attribute.type);
    if (!definition || !Number.isFinite(attribute.value)) return;
    const resolvedTier = Number.isFinite(attribute.tier)
      ? attribute.tier
      : nearestTier(attribute.type, attribute.value)?.level || 0;
    const current = totals.get(attribute.type) || { value: 0, tiers: 0, count: 0 };
    current.value += attribute.value;
    current.tiers += resolvedTier;
    current.count += 1;
    totals.set(attribute.type, current);
    totalTiers += resolvedTier;
  });

  equipmentElements.totalTierCount.textContent = String(totalTiers);

  if (!totals.size) {
    const empty = document.createElement("div");
    empty.className = "aggregate-empty";
    empty.innerHTML = "<strong>暂无综合数据</strong><span>录入任意部位装备后，将在这里汇总角色词条</span>";
    equipmentElements.aggregateGrid.replaceChildren(empty);
    return;
  }

  equipmentElements.aggregateGrid.replaceChildren(
    ...ATTRIBUTE_DEFINITIONS.filter((definition) => totals.has(definition.id)).map((definition) => {
      const total = totals.get(definition.id);
      const card = document.createElement("article");
      card.className = "aggregate-item";
      const label = document.createElement("div");
      label.className = "aggregate-label";
      const name = document.createElement("strong");
      name.textContent = definition.name;
      const sourceCount = document.createElement("small");
      sourceCount.textContent = `${total.count} 个部位词条`;
      label.append(name, sourceCount);
      const value = document.createElement("b");
      value.textContent = `${total.value.toFixed(2)}%`;
      const tiers = document.createElement("span");
      tiers.textContent = `合计 ${total.tiers} 阶`;
      card.append(label, value, tiers);
      return card;
    }),
  );
}

function renderEquipment() {
  const character = getActiveCharacter();
  if (!character) return;
  const attributes = character.equipment[activeSlot] || [];
  const slot = EQUIPMENT_SLOTS[activeSlot];
  equipmentElements.selectedSlotIndex.textContent = slot.index;
  equipmentElements.selectedSlotName.textContent = slot.fullName;
  equipmentElements.slotState.textContent = attributes.length ? `已记录 ${attributes.length} 条` : "尚未记录";
  equipmentElements.slotState.classList.toggle("complete", attributes.length === 3);
  document.querySelectorAll(".slot-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.slot === activeSlot));

  if (!attributes.length) {
    const empty = document.createElement("div");
    empty.className = "attribute-empty";
    empty.innerHTML = "<div><span>NO DATA</span>上传该部位的装备详情截图以记录词条</div>";
    equipmentElements.attributeList.replaceChildren(empty);
  } else {
    equipmentElements.attributeList.replaceChildren(
      ...attributes.map((attribute, index) => {
        const definition = getAttributeDefinition(attribute.type);
        const row = document.createElement("div");
        row.className = "attribute-row";
        row.innerHTML = `<span>0${index + 1}</span><strong></strong><b>${attribute.value.toFixed(2)}%</b><small>第 ${attribute.tier} 阶</small>`;
        row.querySelector("strong").textContent = definition?.name || attribute.type;
        return row;
      }),
    );
  }

  const count = Object.values(character.equipment).reduce((total, list) => total + list.length, 0);
  equipmentElements.recordedCount.textContent = `${count} / 12`;
  renderAttributeSummary(character);
}

function renderEquipmentManager() {
  renderCharacterSelect();
  renderEquipment();
}

function showToast(message, isError = false) {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function createResultRow(attribute = {}) {
  const row = document.createElement("div");
  row.className = "result-row";
  const select = document.createElement("select");
  select.className = "result-type";
  select.setAttribute("aria-label", "词条类型");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "请选择词条类型";
  placeholder.selected = !attribute.type;
  select.append(placeholder);
  select.append(
    ...ATTRIBUTE_DEFINITIONS.map((definition) => {
      const option = document.createElement("option");
      option.value = definition.id;
      option.textContent = definition.name;
      option.selected = definition.id === attribute.type;
      return option;
    }),
  );
  const valueWrap = document.createElement("div");
  valueWrap.className = "value-wrap";
  const input = document.createElement("input");
  input.className = "result-value";
  input.type = "number";
  input.inputMode = "decimal";
  input.step = "0.01";
  input.min = "0";
  input.placeholder = "0.00";
  input.setAttribute("aria-label", "词条数值");
  input.value = Number.isFinite(attribute.value) ? attribute.value.toFixed(2) : "";
  const suffix = document.createElement("span");
  suffix.textContent = "%";
  const hint = document.createElement("small");
  hint.className = "tier-hint";
  valueWrap.append(input, suffix);
  row.append(select, valueWrap, hint);
  const updateHint = () => {
    const enteredValue = Number.parseFloat(input.value);
    if (!select.value && Number.isFinite(enteredValue)) {
      const candidates = getTierMatches(enteredValue).map((match) => getAttributeDefinition(match.type).name.replace("增加", ""));
      hint.className = "tier-hint warning";
      hint.textContent = candidates.length ? `数值可能属于：${candidates.join(" / ")}` : "请选择词条类型";
      return;
    }
    const tier = nearestTier(select.value, enteredValue);
    hint.className = "tier-hint";
    if (!tier) {
      hint.textContent = "请输入截图中的百分比";
      return;
    }
    const exact = tier.difference < 0.015;
    hint.classList.add(exact ? "valid" : "warning");
    hint.textContent = exact
      ? `匹配第 ${tier.level} 阶 · ${tier.value.toFixed(2)}%`
      : `将校正为第 ${tier.level} 阶 · ${tier.value.toFixed(2)}%`;
  };
  select.addEventListener("change", updateHint);
  input.addEventListener("input", updateHint);
  updateHint();
  return row;
}

function setResultRows(attributes = []) {
  const padded = Array.from({ length: 3 }, (_, index) => attributes[index] || {});
  equipmentElements.resultRows.replaceChildren(...padded.map(createResultRow));
}

function normalizeOcrText(text) {
  return text
    .replace(/[oO](?=\.?\d)/g, "0")
    .replace(/(\d)\s*[，,。．·]\s*(\d{1,2})/g, "$1.$2")
    .replace(/％/g, "%")
    .replace(/[ \t]+/g, " ");
}

const ATTRIBUTE_KEYWORDS = [
  ["chargeDamage", ["蓄力伤害", "蓄伤"]],
  ["chargeSpeed", ["蓄力速度", "蓄速"]],
  ["critDamage", ["暴击伤害", "暴伤"]],
  ["critRate", ["暴击率", "暴率"]],
  ["element", ["优越代码", "优势代码", "代码伤害", "优越代"]],
  ["ammo", ["最大装弹", "装弹数", "装弹"]],
  ["attack", ["攻击力", "攻击"]],
  ["defense", ["防御力", "防御"]],
  ["hit", ["命中率", "命中"]],
];

function findTypeInText(text) {
  const compact = text.replace(/\s/g, "");
  return ATTRIBUTE_KEYWORDS.find(([, keywords]) => keywords.some((keyword) => compact.includes(keyword)))?.[0] || "";
}

function getTierMatches(value, tolerance = 0.10) {
  return ATTRIBUTE_DEFINITIONS.flatMap((definition) => {
    const tier = nearestTier(definition.id, value);
    return tier && tier.difference <= tolerance ? [{ type: definition.id, ...tier }] : [];
  });
}

function extractDecimalValues(text) {
  const normalized = normalizeOcrText(text);
  const decimals = [...normalized.matchAll(/(?:^|[^\d])(\d{1,3}\.\d{1,2})(?=%|[^\d]|$)/g)]
    .map((match) => Number.parseFloat(match[1]));
  // OCR frequently drops the tiny decimal point in the game font. Restore it
  // only when the resulting value exists in one of the known 15-level tables.
  const restored = [...normalized.matchAll(/(?:^|[^\d.])(\d{3,4})(?=%|[^\d.]|$)/g)]
    .map((match) => Number.parseFloat(`${match[1].slice(0, -2)}.${match[1].slice(-2)}`));
  return [...decimals, ...restored]
    .filter((value) => Number.isFinite(value) && getTierMatches(value).length);
}

function parseOcrAttributes(rawText, numericOnlyText = "") {
  const text = normalizeOcrText(rawText);
  const attributes = [];
  const consumedValues = [];
  const detectedTypes = [];

  text.split(/\r?\n/).forEach((line) => {
    const type = findTypeInText(line);
    if (type && !detectedTypes.includes(type)) detectedTypes.push(type);
    const values = extractDecimalValues(line);
    if (!type || !values.length) return;
    const value = values.find((candidate) => !type || getTierMatches(candidate).some((match) => match.type === type)) ?? values[0];
    attributes.push({ type, value });
    consumedValues.push(value);
  });

  const allValues = extractDecimalValues(`${text}\n${numericOnlyText}`);

  // Chinese and blue percentages are sometimes returned as separate OCR
  // blocks. Reconnect them through type-specific tier compatibility.
  detectedTypes.forEach((type) => {
    if (attributes.length >= 3 || attributes.some((item) => item.type === type)) return;
    const value = allValues.find((candidate) =>
      !consumedValues.some((used) => Math.abs(used - candidate) < 0.005)
      && getTierMatches(candidate).some((match) => match.type === type));
    if (!Number.isFinite(value)) return;
    attributes.push({ type, value });
    consumedValues.push(value);
  });

  // The game font often defeats Chinese OCR while the blue percentages remain
  // readable. Recover those values independently and infer a type only when the
  // 15-level table makes it unambiguous.
  allValues.forEach((value) => {
    if (attributes.length >= 3) return;
    const alreadyUsed = consumedValues.some((used) => Math.abs(used - value) < 0.005);
    if (alreadyUsed) return;
    const matches = getTierMatches(value);
    const unusedMatches = matches.filter((match) => !attributes.some((item) => item.type && item.type === match.type));
    attributes.push({ type: unusedMatches.length === 1 ? unusedMatches[0].type : "", value });
    consumedValues.push(value);
  });

  return attributes.slice(0, 3);
}

async function createOcrImage(file, options = {}) {
  const {
    cropLeft = 0,
    cropRight = 1,
    binary = false,
  } = options;
  const image = await createImageBitmap(file);
  const sourceX = Math.round(image.width * cropLeft);
  const sourceWidth = Math.max(1, Math.round(image.width * (cropRight - cropLeft)));
  const scale = Math.min(5, Math.max(2, 2400 / Math.max(sourceWidth, image.height)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, 0, sourceWidth, image.height, 0, 0, canvas.width, canvas.height);
  if (binary) {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray = pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114;
      // The attribute panel is pale while both gray and cyan glyphs are much
      // darker. A hard split removes row borders, gradients and button texture.
      const value = gray > 205 ? 255 : 0;
      pixels.data[index] = value;
      pixels.data[index + 1] = value;
      pixels.data[index + 2] = value;
    }
    context.putImageData(pixels, 0, 0);
  }
  image.close();
  return canvas;
}

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-tesseract]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Tesseract), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.dataset.tesseract = "true";
    script.onload = () => resolve(window.Tesseract);
    script.onerror = reject;
    document.head.append(script);
  });
}

async function recognizeEquipmentImage(file) {
  equipmentElements.scanProgress.classList.remove("hidden");
  equipmentElements.scanMessage.textContent = "正在加载中文识别模型，首次使用可能需要一些时间。";
  try {
    const Tesseract = await loadTesseract();
    const textImage = await createOcrImage(file);
    const result = await Tesseract.recognize(textImage, "chi_sim+eng", {
      tessedit_pageseg_mode: "11",
      preserve_interword_spaces: "1",
      logger(message) {
        if (message.status === "recognizing text") {
          const percent = Math.round((message.progress || 0) * 100);
          equipmentElements.scanProgress.querySelector("span").textContent = `正在识别截图文字… ${percent}%`;
        }
      },
    });
    // Percentages always occupy the middle-right band of the game panel.
    // Isolating that band prevents equipment stats and lock icons from being
    // interpreted as attribute values.
    const numberImage = await createOcrImage(file, { cropLeft: 0.43, cropRight: 0.82, binary: true });
    let attributes = parseOcrAttributes(result.data.text);
    if (attributes.length < 3) {
      equipmentElements.scanProgress.querySelector("span").textContent = "正在补充识别数值…";
      const numberResult = await Tesseract.recognize(numberImage, "eng", {
        tessedit_pageseg_mode: "11",
        tessedit_char_whitelist: "0123456789.%",
      });
      attributes = parseOcrAttributes(result.data.text, numberResult.data.text);
      if (attributes.some((attribute) => !attribute.type)) {
        equipmentElements.scanProgress.querySelector("span").textContent = "正在补充识别词条…";
        const typeImage = await createOcrImage(file, { cropLeft: 0.04, cropRight: 0.66, binary: true });
        const typeResult = await Tesseract.recognize(typeImage, "chi_sim", {
          tessedit_pageseg_mode: "11",
          preserve_interword_spaces: "1",
        });
        attributes = parseOcrAttributes(`${result.data.text}\n${typeResult.data.text}`, numberResult.data.text);
        console.debug("Equipment OCR", {
          full: result.data.text,
          types: typeResult.data.text,
          numbers: numberResult.data.text,
        });
      }
    }
    setResultRows(attributes);
    equipmentElements.scanMessage.textContent = attributes.length === 3
      ? attributes.some((attribute) => !attribute.type)
        ? "已提取 3 个数值；部分中文名称无法确认，请选择对应词条类型。"
        : "已识别 3 条词条，请核对类型和数值后保存。"
      : `识别到 ${attributes.length} 条有效词条，请根据截图补全或修正。`;
  } catch (error) {
    console.warn("OCR unavailable", error);
    equipmentElements.scanMessage.textContent = "自动识别暂不可用，请直接对照左侧截图手动填写三条词条。";
  } finally {
    equipmentElements.scanProgress.classList.add("hidden");
  }
}

function openImageDialog(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast("图片不能超过 10 MB", true);
    return;
  }
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  equipmentElements.preview.src = previewObjectUrl;
  equipmentElements.dialogSubtitle.textContent = `${getActiveCharacter().name} / ${EQUIPMENT_SLOTS[activeSlot].name} · 保存后覆盖该部位原记录`;
  equipmentElements.scanProgress.querySelector("span").textContent = "正在识别截图文字…";
  equipmentElements.scanMessage.textContent = "";
  setResultRows(getActiveCharacter().equipment[activeSlot]);
  equipmentElements.dialog.showModal();
  recognizeEquipmentImage(file);
}

equipmentElements.characterSelect.addEventListener("change", (event) => {
  activeCharacterId = event.target.value;
  persistEquipmentData();
  renderEquipment();
});

equipmentElements.addCharacterButton.addEventListener("click", () => {
  const name = window.prompt("输入角色名称（最多 20 个字）");
  const cleanName = name?.trim().slice(0, 20);
  if (!cleanName) return;
  const character = makeCharacter(cleanName);
  equipmentData.characters.push(character);
  activeCharacterId = character.id;
  persistEquipmentData();
  renderEquipmentManager();
  showToast(`已添加角色：${cleanName}`);
});

equipmentElements.deleteCharacterButton.addEventListener("click", () => {
  const character = getActiveCharacter();
  if (equipmentData.characters.length === 1 || !character) return;
  if (!window.confirm(`确定删除“${character.name}”及其全部装备记录吗？`)) return;
  equipmentData.characters = equipmentData.characters.filter((item) => item.id !== character.id);
  activeCharacterId = equipmentData.characters[0].id;
  persistEquipmentData();
  renderEquipmentManager();
  showToast("角色及装备记录已删除");
});

equipmentElements.slotTabs.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-slot]");
  if (!tab) return;
  activeSlot = tab.dataset.slot;
  renderEquipment();
});

equipmentElements.uploadTrigger.addEventListener("click", () => equipmentElements.imageInput.click());
equipmentElements.imageInput.addEventListener("change", (event) => {
  openImageDialog(event.target.files[0]);
  event.target.value = "";
});

equipmentElements.form.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const rows = [...equipmentElements.resultRows.querySelectorAll(".result-row")];
  const values = rows.map((row) => ({
    type: row.querySelector(".result-type").value,
    value: Number.parseFloat(row.querySelector(".result-value").value),
  })).filter((item) => item.type || Number.isFinite(item.value));
  if (!values.length) {
    equipmentElements.scanMessage.textContent = "至少需要填写 1 条有效词条。";
    return;
  }
  if (values.some((item) => !item.type)) {
    equipmentElements.scanMessage.textContent = "请为每个已识别数值选择词条类型。";
    return;
  }
  if (values.some((item) => !Number.isFinite(item.value))) {
    equipmentElements.scanMessage.textContent = "请为已选择的词条填写数值。";
    return;
  }
  if (new Set(values.map((item) => item.type)).size !== values.length) {
    equipmentElements.scanMessage.textContent = "同一件装备的有效词条不能重复。";
    return;
  }
  const snapped = values.map((item) => {
    const tier = nearestTier(item.type, item.value);
    return { type: item.type, value: tier.value, tier: tier.level };
  });
  getActiveCharacter().equipment[activeSlot] = snapped;
  persistEquipmentData();
  renderEquipment();
  equipmentElements.dialog.close();
  showToast(`${getActiveCharacter().name}的${EQUIPMENT_SLOTS[activeSlot].name}词条已更新`);
});

equipmentElements.dialog.addEventListener("close", () => {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = "";
  }
});

renderReferenceList();
renderEquipmentManager();
