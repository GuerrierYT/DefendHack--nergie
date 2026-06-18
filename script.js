const activities = [
  {
    id: "led",
    title: "Éclairer avec une LED",
    description: "Une ampoule de 10 W allumée pendant 10 heures.",
    cost: 0.1,
    color: "#f4ba42",
  },
  {
    id: "phone",
    title: "Recharger un téléphone",
    description: "Une charge complète d'un smartphone récent.",
    cost: 0.012,
    color: "#2f6f9f",
  },
  {
    id: "kettle",
    title: "Faire bouillir de l'eau",
    description: "Une bouilloire puissante pendant quelques minutes.",
    cost: 0.12,
    color: "#dc5c46",
  },
  {
    id: "laptop",
    title: "Travailler sur ordinateur",
    description: "Un ordinateur portable efficace pendant 5 heures.",
    cost: 0.3,
    color: "#7a8f36",
  },
  {
    id: "washer",
    title: "Lancer une lessive",
    description: "Un cycle standard, surtout si l'eau est chauffée.",
    cost: 0.65,
    color: "#2f8a68",
  },
  {
    id: "oven",
    title: "Cuire au four",
    description: "Un four électrique proche de 2 kW pendant 30 minutes.",
    cost: 1,
    color: "#b95f34",
  },
  {
    id: "heater",
    title: "Chauffer une pièce",
    description: "Un radiateur de 1 kW pendant une heure.",
    cost: 1,
    color: "#c4473b",
  },
  {
    id: "ebike",
    title: "Rouler en vélo électrique",
    description: "Une longue sortie, selon batterie, vitesse et relief.",
    cost: 0.5,
    color: "#487b8f",
  },
];

const state = {
  quantities: {},
  budget: 1,
};

const grid = document.querySelector("#activity-grid");
const remainingEl = document.querySelector("#remaining-kwh");
const usedEl = document.querySelector("#used-kwh");
const actionCountEl = document.querySelector("#action-count");
const meterFill = document.querySelector("#meter-fill");
const resetButton = document.querySelector("#reset-button");
const resultTitle = document.querySelector("#result-title");
const resultCopy = document.querySelector("#result-copy");
const selectionList = document.querySelector("#selection-list");
const kwhScoreEl = document.querySelector("#kwh-score");
const kwhMissionEl = document.querySelector("#kwh-mission");
const canvas = document.querySelector("#energy-canvas");
const ctx = canvas.getContext("2d");
const missionIds = ["missions", "jeu", "rendement", "stockage", "mix"];

function openMission(id, shouldPush = true) {
  const target = missionIds.includes(id) ? id : "missions";

  missionIds.forEach((missionId) => {
    const section = document.querySelector(`#${missionId}`);
    section.hidden = missionId !== target;
  });

  document.querySelectorAll(".module-nav a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${target}`);
  });

  if (shouldPush && window.location.hash !== `#${target}`) {
    history.pushState(null, "", `#${target}`);
  }

  window.scrollTo({ top: 0, behavior: shouldPush ? "smooth" : "auto" });
}

function initMissionNavigation() {
  document.querySelectorAll("[data-mission]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openMission(trigger.dataset.mission);
    });
  });

  window.addEventListener("popstate", () => {
    openMission(window.location.hash.slice(1), false);
  });

  window.addEventListener("hashchange", () => {
    openMission(window.location.hash.slice(1), false);
  });

  openMission(window.location.hash.slice(1) || "missions", false);
}

function formatKwh(value) {
  return `${value.toFixed(3).replace(".", ",")} kWh`;
}

function getUsed() {
  return activities.reduce((sum, activity) => {
    return sum + getQuantity(activity.id) * activity.cost;
  }, 0);
}

function getRemaining() {
  return Math.max(0, state.budget - getUsed());
}

function getQuantity(id) {
  return state.quantities[id] || 0;
}

function getTotalActions() {
  return Object.values(state.quantities).reduce((sum, quantity) => sum + quantity, 0);
}

function getSelectedActivities() {
  return activities.filter((activity) => getQuantity(activity.id) > 0);
}

function renderActivities() {
  const remaining = getRemaining();
  grid.innerHTML = "";

  activities.forEach((activity) => {
    const quantity = getQuantity(activity.id);
    const card = document.createElement("article");
    card.className = "activity-card";
    card.style.setProperty("--activity-color", activity.color);
    card.innerHTML = `
      <div class="activity-top">
        <span class="activity-icon" aria-hidden="true"></span>
        <span class="activity-quantity">${quantity}</span>
      </div>
      <div>
        <h3>${activity.title}</h3>
        <p>${activity.description}</p>
      </div>
      <div class="activity-cost">
        <span>Coût unitaire</span>
        <span>${formatKwh(activity.cost)}</span>
      </div>
      <div class="activity-controls">
        <button class="round-button minus-button" type="button" aria-label="Retirer ${activity.title}">−</button>
        <button class="round-button plus-button" type="button" aria-label="Ajouter ${activity.title}">+</button>
      </div>
    `;

    const minusButton = card.querySelector(".minus-button");
    const plusButton = card.querySelector(".plus-button");
    minusButton.disabled = quantity === 0;
    plusButton.disabled = activity.cost > remaining + 0.0001;
    minusButton.addEventListener("click", () => removeActivity(activity));
    plusButton.addEventListener("click", () => addActivity(activity));
    grid.append(card);
  });
}

function addActivity(activity) {
  if (activity.cost > getRemaining() + 0.0001) {
    return;
  }

  state.quantities[activity.id] = getQuantity(activity.id) + 1;
  update();
}

function removeActivity(activity) {
  const quantity = getQuantity(activity.id);

  if (quantity === 0) {
    return;
  }

  state.quantities[activity.id] = quantity - 1;

  if (state.quantities[activity.id] === 0) {
    delete state.quantities[activity.id];
  }

  update();
}

function renderTimeline() {
  selectionList.innerHTML = "";

  if (getTotalActions() === 0) {
    const empty = document.createElement("li");
    empty.innerHTML = `
      <span class="timeline-index">0</span>
      <strong>Aucun usage choisi</strong>
      <span>${formatKwh(0)}</span>
    `;
    selectionList.append(empty);
    return;
  }

  getSelectedActivities()
    .forEach((item, index) => {
      const quantity = getQuantity(item.id);
      const total = item.cost * quantity;
      const row = document.createElement("li");
      row.innerHTML = `
        <span class="timeline-index">${index + 1}</span>
        <strong>${quantity} × ${item.title}</strong>
        <span>${formatKwh(total)}</span>
      `;
      selectionList.append(row);
    });
}

function renderMeterBar() {
  meterFill.innerHTML = "";
  meterFill.dataset.tip = getTotalActions() > 0
    ? "Couleurs = usages choisis"
    : "Gris = energie restante";
  meterFill.previousElementSibling.dataset.tip = meterFill.dataset.tip;

  getSelectedActivities().forEach((activity) => {
    const value = getQuantity(activity.id) * activity.cost;
    const segment = document.createElement("span");
    segment.className = "meter-segment";
    segment.style.setProperty("--segment-color", activity.color);
    segment.style.flexGrow = value.toString();
    segment.title = `${getQuantity(activity.id)} × ${activity.title} : ${formatKwh(value)}`;
    meterFill.append(segment);
  });

  const remaining = getRemaining();
  const emptySegment = document.createElement("span");
  emptySegment.className = "meter-segment meter-segment-empty";
  emptySegment.style.flexGrow = remaining.toString();
  emptySegment.title = `Budget restant : ${formatKwh(remaining)}`;
  meterFill.append(emptySegment);
}

function renderDebrief() {
  const used = getUsed();
  const remaining = getRemaining();

  if (getTotalActions() === 0) {
    resultTitle.textContent = "Ton kWh est prêt.";
    resultCopy.textContent =
      "Ajoute quelques usages pour voir comment une même quantité d'énergie peut paraître immense ou minuscule selon l'appareil.";
    return;
  }

  if (remaining < 0.001) {
    resultTitle.textContent = "Budget épuisé : tu as dépensé 1 kWh.";
    resultCopy.textContent =
      "Le kWh mesure une quantité d'énergie. Un appareil très puissant le consomme vite ; un appareil sobre peut fonctionner longtemps avec la même réserve.";
    return;
  }

  if (used < 0.25) {
    resultTitle.textContent = "Tu es dans les petits usages.";
    resultCopy.textContent =
      "L'éclairage LED et les appareils électroniques efficaces consomment peu à l'échelle d'un kWh. La chaleur, elle, change souvent les ordres de grandeur.";
    return;
  }

  if (used < 0.75) {
    resultTitle.textContent = "Le kWh commence à se remplir.";
    resultCopy.textContent =
      "Des usages modestes additionnés finissent par compter. C'est l'un des bons réflexes scientifiques : penser puissance, durée, puis énergie.";
    return;
  }

  resultTitle.textContent = "Il ne reste presque plus d'énergie.";
  resultCopy.textContent =
    "Un seul usage thermique peut absorber une grande partie du budget. Ce n'est pas moral, c'est physique : chauffer demande beaucoup d'énergie utile.";
}

function renderKwhChallenge() {
  const used = getUsed();
  const remaining = getRemaining();
  const score = Math.round(Math.min(used / state.budget, 1) * 100);

  kwhScoreEl.textContent = `${score} / 100`;

  if (used === 0) {
    kwhMissionEl.textContent = "Approche-toi de 1 kWh sans dépasser.";
  } else if (remaining <= 0.02) {
    kwhMissionEl.textContent = "Défi réussi : ton budget est presque parfaitement utilisé.";
  } else if (remaining <= 0.15) {
    kwhMissionEl.textContent = "Très proche. Il reste juste un petit usage à caser.";
  } else {
    kwhMissionEl.textContent = "Continue : il reste encore de la marge dans ton kWh.";
  }
}

function drawCanvas() {
  const width = canvas.width;
  const height = canvas.height;
  const usedRatio = getUsed() / state.budget;
  const remainingRatio = 1 - usedRatio;

  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(1, "#eaf4ef");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#dbe8e2";
  for (let x = 20; x < width; x += 34) {
    ctx.fillRect(x, 26, 1, height - 52);
  }
  for (let y = 26; y < height; y += 34) {
    ctx.fillRect(20, y, width - 40, 1);
  }

  const batteryX = 54;
  const batteryY = 62;
  const batteryW = 236;
  const batteryH = 92;
  const capW = 22;

  ctx.lineWidth = 5;
  ctx.strokeStyle = "#16211f";
  ctx.strokeRect(batteryX, batteryY, batteryW, batteryH);
  ctx.fillStyle = "#16211f";
  ctx.fillRect(batteryX + batteryW + 2, batteryY + 24, capW, 44);

  const fillW = Math.max(0, (batteryW - 14) * remainingRatio);
  const fillGradient = ctx.createLinearGradient(batteryX, 0, batteryX + batteryW, 0);
  fillGradient.addColorStop(0, "#dc5c46");
  fillGradient.addColorStop(0.48, "#f4ba42");
  fillGradient.addColorStop(1, "#2f8a68");
  ctx.fillStyle = fillGradient;
  ctx.fillRect(batteryX + 7, batteryY + 7, fillW, batteryH - 14);

  ctx.fillStyle = "#16211f";
  ctx.font = "800 30px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(remainingRatio * 100)}%`, batteryX + batteryW / 2, 124);

  ctx.font = "700 14px system-ui";
  ctx.fillStyle = "#65736e";
  ctx.fillText("réserve de 1 kWh", batteryX + batteryW / 2, 184);
}

function update() {
  const used = getUsed();
  const remaining = getRemaining();

  remainingEl.textContent = formatKwh(remaining);
  usedEl.textContent = formatKwh(used);
  actionCountEl.textContent = getTotalActions().toString();

  renderActivities();
  renderMeterBar();
  renderTimeline();
  renderDebrief();
  renderKwhChallenge();
  drawCanvas();
}

const efficiencyChains = [
  {
    id: "ev",
    title: "Électricité → batterie → moteur",
    context: "Faire avancer un véhicule électrique.",
    color: "#2f6f9f",
    steps: [
      { label: "Réseau", efficiency: 0.95 },
      { label: "Charge batterie", efficiency: 0.9 },
      { label: "Moteur", efficiency: 0.88 },
    ],
  },
  {
    id: "thermal-car",
    title: "Essence → moteur thermique → roues",
    context: "Faire avancer une voiture thermique.",
    color: "#dc5c46",
    steps: [
      { label: "Moteur", efficiency: 0.32 },
      { label: "Transmission", efficiency: 0.9 },
    ],
  },
  {
    id: "gas-heat",
    title: "Gaz → chaudière → chaleur",
    context: "Chauffer directement un logement.",
    color: "#b95f34",
    steps: [
      { label: "Combustion", efficiency: 0.92 },
      { label: "Distribution", efficiency: 0.88 },
    ],
  },
  {
    id: "hydrogen",
    title: "Électricité → hydrogène → électricité",
    context: "Stocker longtemps puis restituer.",
    color: "#487b8f",
    steps: [
      { label: "Électrolyse", efficiency: 0.7 },
      { label: "Compression", efficiency: 0.9 },
      { label: "Pile à combustible", efficiency: 0.55 },
    ],
  },
];

const storageTechs = {
  battery: { label: "Batteries", efficiency: 0.9, cost: 3.8, color: "#2f6f9f" },
  step: { label: "STEP", efficiency: 0.8, cost: 1.7, color: "#2f8a68" },
  hydrogen: { label: "Hydrogène", efficiency: 0.38, cost: 5.4, color: "#487b8f" },
};

const mixSources = [
  { id: "nuclear", label: "Nucléaire", value: 35, color: "#7a8f36", carbon: 12, cost: 55, stability: 92 },
  { id: "solar", label: "Solaire", value: 20, color: "#f4ba42", carbon: 45, cost: 45, stability: 35 },
  { id: "wind", label: "Éolien", value: 20, color: "#2f8a68", carbon: 14, cost: 50, stability: 42 },
  { id: "hydro", label: "Hydraulique", value: 10, color: "#2f6f9f", carbon: 8, cost: 60, stability: 82 },
  { id: "gas", label: "Gaz", value: 15, color: "#dc5c46", carbon: 420, cost: 80, stability: 88 },
];

const mixState = Object.fromEntries(mixSources.map((source) => [source.id, source.value]));
const mixLocked = Object.fromEntries(mixSources.map((source) => [source.id, false]));

function formatUnits(value, unit) {
  return `${Math.round(value)} ${unit}`;
}

function getChainUseful(chain) {
  return chain.steps.reduce((energy, step) => energy * step.efficiency, 100);
}

function initEfficiencyGame() {
  const options = document.querySelector("#efficiency-options");

  efficiencyChains.forEach((chain) => {
    const button = document.createElement("button");
    button.className = "option-button";
    button.type = "button";
    button.style.setProperty("--option-color", chain.color);
    button.innerHTML = `
      <span></span>
      <strong>${chain.title}</strong>
      <small>${chain.context}</small>
    `;
    button.addEventListener("click", () => renderEfficiency(chain.id));
    options.append(button);
  });

  renderEfficiency(efficiencyChains[0].id);
}

function renderEfficiency(id) {
  const chain = efficiencyChains.find((item) => item.id === id);
  const flow = document.querySelector("#efficiency-flow");
  const usefulEl = document.querySelector("#efficiency-useful");
  const lossEl = document.querySelector("#efficiency-loss");
  const noteEl = document.querySelector("#efficiency-note");
  const scoreEl = document.querySelector("#efficiency-score");
  const challengeEl = document.querySelector("#efficiency-challenge");
  const optionButtons = document.querySelectorAll("#efficiency-options .option-button");
  let current = 100;

  optionButtons.forEach((button, index) => {
    button.classList.toggle("selected", efficiencyChains[index].id === id);
  });

  flow.innerHTML = "";
  chain.steps.forEach((step) => {
    const before = current;
    current *= step.efficiency;
    const lost = before - current;
    const row = document.createElement("div");
    row.className = "flow-row";
    row.dataset.tip = `Vert utile, rouge perdu : -${Math.round(lost)}`;
    row.innerHTML = `
      <div>
        <strong>${step.label}</strong>
        <span>${Math.round(step.efficiency * 100)}% de rendement</span>
      </div>
      <div class="flow-bar">
        <span class="flow-useful" style="width: ${current}%"></span>
        <span class="flow-loss" style="width: ${lost}%"></span>
      </div>
      <b>${formatUnits(current, "unités")}</b>
    `;
    flow.append(row);
  });

  const useful = getChainUseful(chain);
  usefulEl.textContent = formatUnits(useful, "unités");
  lossEl.textContent = formatUnits(100 - useful, "unités");
  usefulEl.parentElement.dataset.tip = "Energie en sortie";
  lossEl.parentElement.dataset.tip = "Energie dissipee";
  scoreEl.textContent = `${Math.round(useful)} / 100`;
  challengeEl.textContent =
    useful >= 70
      ? "Défi réussi : cette chaîne garde beaucoup d'énergie exploitable."
      : "Défi à améliorer : trop d'énergie devient difficile à utiliser à la sortie.";
  noteEl.textContent =
    useful > 70
      ? "Cette chaîne garde beaucoup d'énergie utile. Les pertes existent, mais elles restent limitées."
      : useful > 45
        ? "Le rendement est moyen : une part importante de l'énergie change de forme avant l'usage final."
        : "La chaîne multiplie les conversions. C'est utile dans certains cas, mais coûteux en énergie.";
  renderEnergyAnimation(chain);
}

function renderEnergyAnimation(chain) {
  const field = document.querySelector("#particle-field");
  const particleScale = 0.22;
  let current = 100;
  let cursor = 0;
  const nodes = ["Entrée", ...chain.steps.map((step) => step.label), "Sortie"];
  const nodeCount = nodes.length;

  field.innerHTML = "";

  const track = document.createElement("div");
  track.className = "stream-track";
  track.dataset.tip = "Vert continue, rouge sort";
  track.innerHTML = `
    <div class="stream-line" aria-hidden="true"></div>
    <div class="stream-labels">
      ${nodes.map((node) => `<span>${node}</span>`).join("")}
    </div>
  `;

  chain.steps.forEach((step, stepIndex) => {
    const before = current;
    const from = (stepIndex / (nodeCount - 1)) * 100;
    const to = ((stepIndex + 1) / (nodeCount - 1)) * 100;
    const movingCount = Math.max(5, Math.round(before * particleScale));

    for (let index = 0; index < movingCount; index += 1) {
      track.append(createStreamParticle("green", from, to, index, stepIndex));
    }

    current *= step.efficiency;
    const lost = before - current;
    const lossCount = Math.max(1, Math.round(lost * particleScale));
    const lossPoint = to;

    for (let index = 0; index < lossCount; index += 1) {
      track.append(createStreamParticle("red", lossPoint, lossPoint, index, stepIndex));
    }

    const lossLabel = document.createElement("span");
    lossLabel.className = "stream-loss-label";
    lossLabel.style.left = `${lossPoint}%`;
    lossLabel.textContent = `-${Math.round(lost)}`;
    lossLabel.dataset.tip = "Perte a cette etape";
    track.append(lossLabel);
  });

  const finalFrom = ((nodeCount - 2) / (nodeCount - 1)) * 100;
  const finalCount = Math.max(4, Math.round(current * particleScale));

  for (let index = 0; index < finalCount; index += 1) {
    track.append(createStreamParticle("green", finalFrom, 100, index, chain.steps.length));
  }

  field.append(track);
}

function createStreamParticle(kind, from, to, index, stepIndex) {
  const particle = document.createElement("span");
  particle.className = `stream-particle ${kind === "red" ? "stream-loss" : "stream-useful"}`;
  particle.style.setProperty("--from", `${from}%`);
  particle.style.setProperty("--to", `${to}%`);
  particle.style.setProperty("--delay", `${index * 0.16 + stepIndex * 0.08}s`);
  particle.style.setProperty("--lane", `${(index % 5) * 8 - 16}px`);
  particle.style.setProperty("--drop", `${36 + (index % 4) * 10}px`);
  return particle;
}

function initStorageGame() {
  ["battery", "step", "hydrogen"].forEach((id) => {
    const input = document.querySelector(`#${id}-storage`);
    input.addEventListener("input", renderStorage);
  });

  renderStorage();
}

function renderStorage() {
  const values = {
    battery: Number(document.querySelector("#battery-storage").value),
    step: Number(document.querySelector("#step-storage").value),
    hydrogen: Number(document.querySelector("#hydrogen-storage").value),
  };
  const eveningNeed = 72;
  const dayEl = document.querySelector("#storage-day");
  let delivered = 0;
  let losses = 0;
  let cost = 0;

  dayEl.innerHTML = "";

  Object.entries(values).forEach(([id, stored]) => {
    const tech = storageTechs[id];
    const restored = stored * tech.efficiency;
    delivered += restored;
    losses += stored - restored;
    cost += stored * tech.cost;

    document.querySelector(`#${id}-storage-value`).textContent = stored.toString();

    const block = document.createElement("div");
    block.className = "storage-block";
    block.style.setProperty("--storage-color", tech.color);
    block.dataset.tip = `${tech.label}: energie restituee`;
    block.innerHTML = `
      <span>${tech.label}</span>
      <strong>${Math.round(restored)} MWh</strong>
      <small>${Math.round(tech.efficiency * 100)}% restitué · coût ${Math.round(tech.cost)}/MWh</small>
    `;
    dayEl.append(block);
  });

  const gap = Math.max(0, eveningNeed - delivered);
  const surplus = Math.max(0, delivered - eveningNeed);
  const score = Math.max(0, Math.min(100, Math.round(100 - gap * 1.15 - Math.max(0, losses - 25) * 0.9 - surplus * 0.35 - cost * 0.04)));

  document.querySelector("#storage-delivered").textContent = formatUnits(delivered, "MWh");
  document.querySelector("#storage-gap").textContent = formatUnits(gap, "MWh");
  document.querySelector("#storage-loss").textContent = formatUnits(losses, "MWh");
  document.querySelector("#storage-cost").textContent = Math.round(cost).toString();
  document.querySelector("#storage-delivered").parentElement.dataset.tip = "Sortie utile";
  document.querySelector("#storage-gap").parentElement.dataset.tip = "Besoin non couvert";
  document.querySelector("#storage-loss").parentElement.dataset.tip = "Perdu au stockage";
  document.querySelector("#storage-cost").parentElement.dataset.tip = "Indice economique";
  renderStorageVisuals(values, delivered, losses, gap, surplus, cost, eveningNeed);
  document.querySelector("#storage-score").textContent = `${score} / 100`;
  document.querySelector("#storage-challenge").textContent =
    gap === 0 && losses < 25 && cost < 230
      ? "Défi réussi : la nuit passe avec des pertes et un coût maîtrisés."
      : gap > 0
        ? "Objectif : augmente ou déplace le stockage pour couvrir le soir."
        : cost >= 230
          ? "Objectif : couvre le soir avec un système moins coûteux."
          : "Objectif : réduis les pertes ou le surdimensionnement.";
  document.querySelector("#storage-note").textContent =
    gap > 0
      ? "Il manque encore de l'énergie au moment utile. Le stockage se juge autant en quantité qu'en disponibilité."
      : surplus > 24
        ? "La nuit passe, mais tu as surdimensionné le stockage. La résilience a un coût matériel et économique."
        : "La nuit passe avec une marge raisonnable. Les pertes restent visibles, surtout sur les longues chaînes.";
}

function renderStorageVisuals(values, delivered, losses, gap, surplus, cost, eveningNeed) {
  const curve = document.querySelector("#storage-curve");
  const balance = document.querySelector("#storage-balance");
  const costBars = document.querySelector("#storage-cost-bars");
  const coverage = Math.min(100, Math.round((delivered / eveningNeed) * 100));
  const balanceTotal = Math.max(eveningNeed, delivered + losses, 1);

  curve.innerHTML = "";
  [
    { label: "0h", solar: 0, demand: 38 },
    { label: "6h", solar: 18, demand: 42 },
    { label: "12h", solar: 92, demand: 46 },
    { label: "18h", solar: 12, demand: 72 },
    { label: "22h", solar: 0, demand: 66 },
  ].forEach((point) => {
    const column = document.createElement("div");
    column.className = "curve-column";
    column.dataset.tip = `${point.label}: soleil ${point.solar}, besoin ${point.demand}`;
    column.innerHTML = `
      <div class="curve-bars">
        <span class="solar-bar" style="height: ${point.solar}%"></span>
        <span class="demand-bar" style="height: ${point.demand}%"></span>
      </div>
      <small>${point.label}</small>
    `;
    curve.append(column);
  });

  document.querySelector("#storage-coverage-fill").style.width = `${coverage}%`;
  document.querySelector("#storage-coverage-fill").closest(".storage-chart").dataset.tip =
    "Part du besoin couverte";
  document.querySelector("#storage-coverage-label").textContent = `${coverage}% couvert`;
  document.querySelector("#storage-surplus-label").textContent =
    surplus > 0 ? `${Math.round(surplus)} MWh marge` : `${Math.round(gap)} MWh manquants`;

  balance.parentElement.querySelector(".balance-legend")?.remove();
  balance.innerHTML = "";
  balance.parentElement.dataset.tip = "Utile, pertes, manque";
  [
    { label: "Restitué", value: delivered, color: "#2f8a68" },
    { label: "Pertes", value: losses, color: "#dc5c46" },
    { label: "Manque", value: gap, color: "#b95f34" },
  ].forEach((item) => {
    const segment = document.createElement("span");
    segment.style.width = `${Math.max(0, (item.value / balanceTotal) * 100)}%`;
    segment.style.background = item.color;
    segment.title = `${item.label} : ${formatUnits(item.value, "MWh")}`;
    segment.dataset.tip = item.label;
    balance.append(segment);
  });

  const legend = document.createElement("div");
  legend.className = "balance-legend";
  legend.innerHTML = `
    <span><b style="background:#2f8a68"></b>${formatUnits(delivered, "MWh")} restitués</span>
    <span><b style="background:#dc5c46"></b>${formatUnits(losses, "MWh")} pertes</span>
    <span><b style="background:#b95f34"></b>${formatUnits(gap, "MWh")} manque</span>
  `;
  balance.after(legend);

  costBars.innerHTML = "";
  Object.entries(values).forEach(([id, stored]) => {
    const tech = storageTechs[id];
    const techCost = stored * tech.cost;
    const row = document.createElement("div");
    row.className = "cost-row";
    row.dataset.tip = `${tech.label}: cout relatif`;
    row.innerHTML = `
      <span>${tech.label}</span>
      <div><i style="width: ${Math.min(100, (techCost / Math.max(cost, 1)) * 100)}%; background: ${tech.color}"></i></div>
      <strong>${Math.round(techCost)}</strong>
    `;
    costBars.append(row);
  });
}

function initMixGame() {
  const controls = document.querySelector("#mix-controls");

  mixSources.forEach((source) => {
    const control = document.createElement("div");
    control.className = "range-control mix-range";
    control.style.setProperty("--mix-color", source.color);
    control.innerHTML = `
      <div class="mix-range-head">
        <label for="mix-${source.id}-input">${source.label}</label>
        <button class="lock-button" type="button" data-lock="${source.id}" aria-pressed="false">
          <span aria-hidden="true"></span>
        </button>
      </div>
      <input id="mix-${source.id}-input" type="range" min="0" max="80" value="${source.value}" data-source="${source.id}">
      <strong><span id="mix-${source.id}-value">${source.value}</span>%</strong>
    `;
    control.querySelector("input").addEventListener("input", (event) => {
      updateMixSource(source.id, Number(event.target.value));
      renderMix();
    });
    control.querySelector(".lock-button").addEventListener("click", () => {
      toggleMixLock(source.id);
    });
    controls.append(control);
  });

  renderMix();
}

function toggleMixLock(sourceId) {
  mixLocked[sourceId] = !mixLocked[sourceId];
  renderMix();
}

function updateMixSource(sourceId, value) {
  if (mixLocked[sourceId]) {
    return;
  }

  const lockedTotal = mixSources
    .filter((source) => source.id !== sourceId && mixLocked[source.id])
    .reduce((sum, source) => sum + mixState[source.id], 0);
  const maxValue = Math.max(0, 100 - lockedTotal);

  mixState[sourceId] = value;
  mixState[sourceId] = Math.min(mixState[sourceId], maxValue);
  let total = Object.values(mixState).reduce((sum, item) => sum + item, 0);

  if (total <= 100) {
    return;
  }

  let overflow = total - 100;
  const others = mixSources
    .filter((source) => source.id !== sourceId && !mixLocked[source.id])
    .sort((a, b) => mixState[b.id] - mixState[a.id]);

  others.forEach((source) => {
    if (overflow <= 0) {
      return;
    }

    const reduction = Math.min(mixState[source.id], overflow);
    mixState[source.id] -= reduction;
    overflow -= reduction;
  });

  if (overflow > 0) {
    mixState[sourceId] = Math.max(0, mixState[sourceId] - overflow);
  }
}

function renderMix() {
  const rawTotal = Object.values(mixState).reduce((sum, value) => sum + value, 0);
  const total = rawTotal || 1;
  let carbon = 0;
  let cost = 0;
  let stability = 0;
  let cursor = 0;
  const gradientParts = [];

  mixSources.forEach((source) => {
    const value = mixState[source.id];
    const share = value / total;
    const start = cursor;
    const end = cursor + share * 100;
    cursor = end;

    carbon += share * source.carbon;
    cost += share * source.cost;
    stability += share * source.stability;
    gradientParts.push(`${source.color} ${start}% ${end}%`);
    document.querySelector(`#mix-${source.id}-value`).textContent = value.toString();
    const input = document.querySelector(`input[data-source="${source.id}"]`);
    const control = input.closest(".mix-range");
    const lockButton = control.querySelector(".lock-button");
    const isLocked = mixLocked[source.id];

    input.value = value.toString();
    input.disabled = isLocked;
    control.classList.toggle("locked", isLocked);
    lockButton.setAttribute("aria-pressed", isLocked.toString());
    lockButton.setAttribute(
      "aria-label",
      `${isLocked ? "Deverrouiller" : "Verrouiller"} ${source.label}`,
    );
    lockButton.title = isLocked ? "Deverrouiller" : "Verrouiller";
  });

  document.querySelector("#mix-donut").style.background =
    `conic-gradient(${gradientParts.join(", ")})`;
  document.querySelector("#mix-donut").dataset.tip = "Part de chaque source";
  document.querySelector("#mix-total").textContent = `${Math.round(rawTotal)}%`;
  document.querySelector("#mix-remaining").textContent = `${Math.max(0, 100 - Math.round(rawTotal))}%`;
  document.querySelector("#mix-carbon").textContent = `${Math.round(carbon)} g/kWh`;
  document.querySelector("#mix-cost").textContent = Math.round(cost).toString();
  document.querySelector("#mix-stability").textContent = `${Math.round(stability)}%`;
  document.querySelector("#mix-remaining").parentElement.dataset.tip = "Part encore libre";
  document.querySelector("#mix-carbon").parentElement.dataset.tip = "CO2 moyen";
  document.querySelector("#mix-cost").parentElement.dataset.tip = "Cout relatif";
  document.querySelector("#mix-stability").parentElement.dataset.tip = "Production pilotable";
  const score = Math.max(
    0,
    Math.min(100, Math.round(stability - carbon / 12 - Math.abs(100 - rawTotal) * 1.2)),
  );
  document.querySelector("#mix-score").textContent = `${score} / 100`;
  document.querySelector("#mix-challenge").textContent =
    rawTotal === 100 && carbon < 120 && stability >= 60
      ? "Défi réussi : demande couverte, CO2 bas, stabilité correcte."
      : rawTotal < 100
        ? "Objectif : complète le mix jusqu'à 100%."
        : "Objectif : baisse le CO2 sans trop perdre en stabilité.";
  document.querySelector("#mix-note").textContent =
    total < 90
      ? "Le mix ne couvre pas assez la demande : il faudrait importer, stocker ou réduire certains usages."
      : total > 115
        ? "Tu produis beaucoup plus que la demande moyenne. Sans flexibilité, une partie de cette énergie sera difficile à valoriser."
        : stability < 60
          ? "Le mix est bas carbone, mais très dépendant de la météo : le stockage et le pilotable deviennent importants."
          : "Le mix couvre la demande avec une stabilité correcte. Les indicateurs rappellent qu'un choix énergétique est multidimensionnel.";
}

resetButton.addEventListener("click", () => {
  state.quantities = {};
  update();
});

update();
initEfficiencyGame();
initStorageGame();
initMixGame();
initMissionNavigation();
