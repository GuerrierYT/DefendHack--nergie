const activities = [
  {
    id: "led",
    title: "Allumer une LED",
    description: "Une ampoule sobre de 10 W pendant 10 heures.",
    cost: 0.1,
    color: "#f4ba42",
  },
  {
    id: "phone",
    title: "Recharger un telephone",
    description: "Une charge complete d'un smartphone recent.",
    cost: 0.012,
    color: "#2f6f9f",
  },
  {
    id: "kettle",
    title: "Faire bouillir de l'eau",
    description: "Un appareil tres puissant, mais utilise peu de temps.",
    cost: 0.12,
    color: "#dc5c46",
  },
  {
    id: "laptop",
    title: "Travailler sur ordinateur",
    description: "Un ordinateur portable efficace pendant une demi-journee.",
    cost: 0.3,
    color: "#7a8f36",
  },
  {
    id: "washer",
    title: "Lancer une lessive",
    description: "Un cycle standard, sensible au chauffage de l'eau.",
    cost: 0.65,
    color: "#2f8a68",
  },
  {
    id: "oven",
    title: "Cuire au four",
    description: "Un four electrique proche de 2 kW pendant 30 minutes.",
    cost: 1,
    color: "#b95f34",
  },
  {
    id: "heater",
    title: "Chauffer une piece",
    description: "Un radiateur de 1 kW pendant une heure.",
    cost: 1,
    color: "#c4473b",
  },
  {
    id: "ebike",
    title: "Rouler en velo electrique",
    description: "Une longue sortie, selon batterie, vitesse et relief.",
    cost: 0.5,
    color: "#487b8f",
  },
];

const state = {
  quantities: {},
  budget: 1,
  unlimited: false,
};

const badgeState = {
  filter: "all",
  unlockedBadges: [],
  activeBadges: [],
  newBadgeCount: 0,
};

const grid = document.querySelector("#activity-grid");
const remainingEl = document.querySelector("#remaining-kwh");
const usedEl = document.querySelector("#used-kwh");
const actionCountEl = document.querySelector("#action-count");
const meterFill = document.querySelector("#meter-fill");
const resetButton = document.querySelector("#reset-button");
const unlimitedButton = document.querySelector("#unlimited-button");
const resultTitle = document.querySelector("#result-title");
const resultCopy = document.querySelector("#result-copy");
const selectionList = document.querySelector("#selection-list");
const kwhScoreEl = document.querySelector("#kwh-score");
const kwhMissionEl = document.querySelector("#kwh-mission");
const canvas = document.querySelector("#energy-canvas");
const ctx = canvas.getContext("2d");
const missionIds = ["missions", "voiture", "jeu", "rendement", "stockage", "mix", "badges"];

function openMission(id, shouldPush = true) {
  const target = missionIds.includes(id) ? id : "missions";

  if (target === "badges") {
    badgeState.newBadgeCount = 0;
    renderBadgeNotification();
  }

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

function renderBadgeNotification() {
  const badgeLink = document.querySelector('.module-nav a[data-mission="badges"]');

  if (!badgeLink) {
    return;
  }

  const count = badgeState.newBadgeCount;
  badgeLink.classList.toggle("has-badge-notification", count > 0);

  if (count > 0) {
    badgeLink.dataset.badgeCount = count > 9 ? "9+" : count.toString();
    badgeLink.setAttribute(
      "aria-label",
      `${count} nouveau${count > 1 ? "x" : ""} badge${count > 1 ? "s" : ""}. Voir les badges`,
    );
  } else {
    delete badgeLink.dataset.badgeCount;
    badgeLink.setAttribute("aria-label", "Badges");
  }
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

function getOverBudget() {
  return Math.max(0, getUsed() - state.budget);
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
    plusButton.disabled = !state.unlimited && activity.cost > remaining + 0.0001;
    minusButton.addEventListener("click", () => removeActivity(activity));
    plusButton.addEventListener("click", () => addActivity(activity));
    grid.append(card);
  });
}

function addActivity(activity) {
  if (!state.unlimited && activity.cost > getRemaining() + 0.0001) {
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
      <strong>Aucun usage pour l'instant</strong>
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
  const used = getUsed();
  const remaining = getRemaining();
  const overBudget = getOverBudget();
  const barTotal = Math.max(state.budget, used, 0.001);
  meterFill.innerHTML = "";
  meterFill.classList.toggle("over-budget", overBudget > 0);
  meterFill.dataset.tip = overBudget > 0
    ? `Au-dela du repere : ${formatKwh(overBudget)}`
    : getTotalActions() > 0
      ? "Couleurs = usages ajoutes"
      : "Gris = energie encore disponible";
  meterFill.previousElementSibling.dataset.tip = meterFill.dataset.tip;

  getSelectedActivities().forEach((activity) => {
    const value = getQuantity(activity.id) * activity.cost;
    const segment = document.createElement("span");
    segment.className = "meter-segment";
    segment.style.setProperty("--segment-color", activity.color);
    segment.style.flexGrow = (value / barTotal).toString();
    segment.title = `${getQuantity(activity.id)} × ${activity.title} : ${formatKwh(value)}`;
    meterFill.append(segment);
  });

  if (remaining > 0) {
    const emptySegment = document.createElement("span");
    emptySegment.className = "meter-segment meter-segment-empty";
    emptySegment.style.flexGrow = (remaining / barTotal).toString();
    emptySegment.title = `Budget restant : ${formatKwh(remaining)}`;
    meterFill.append(emptySegment);
  }
}

function renderDebrief() {
  const used = getUsed();
  const remaining = getRemaining();
  const overBudget = getOverBudget();

  if (getTotalActions() === 0) {
    resultTitle.textContent = "La reserve est prete.";
    resultCopy.textContent =
      "Ajoute des usages : la meme quantite d'energie change de visage selon la puissance et la duree.";
    return;
  }

  if (overBudget > 0) {
    resultTitle.textContent = `Tu vas au-dela de 1 kWh de ${formatKwh(overBudget)}.`;
    resultCopy.textContent =
      "Le mode illimite sert a additionner librement. Le total fait vite ressortir les usages qui pesent le plus.";
    return;
  }

  if (remaining < 0.001) {
    resultTitle.textContent = "Reserve vide : tu as utilise 1 kWh.";
    resultCopy.textContent =
      "Un kWh est une quantite d'energie. Un appareil puissant l'avale vite ; un appareil sobre peut durer longtemps.";
    return;
  }

  if (used < 0.25) {
    resultTitle.textContent = "Tu es dans les petits usages.";
    resultCopy.textContent =
      "Une LED ou un appareil electronique pese peu a l'echelle d'un kWh. La chaleur change souvent l'ordre de grandeur.";
    return;
  }

  if (used < 0.75) {
    resultTitle.textContent = "Le kWh commence a prendre forme.";
    resultCopy.textContent =
      "Additionner des usages modestes finit par compter. Le bon reflexe : puissance, duree, puis energie.";
    return;
  }

  resultTitle.textContent = "La reserve touche a sa fin.";
  resultCopy.textContent =
    "Un usage thermique peut prendre une grande part du budget. Ce n'est pas une morale : c'est un ordre de grandeur.";
}

function renderKwhChallenge() {
  const used = getUsed();
  const remaining = getRemaining();
  const overBudget = getOverBudget();
  const score = Math.round(Math.min(used / state.budget, 1) * 100);
  const selectedIds = getSelectedActivities().map((activity) => activity.id);
  const badges = [];

  kwhScoreEl.textContent = `${score} / 100`;

  if (used === 0) {
    kwhMissionEl.textContent = "Approche-toi de 1 kWh sans passer au-dela.";
  } else if (overBudget > 0) {
    kwhMissionEl.textContent = `Mode illimite : ${formatKwh(overBudget)} au-dela du repere.`;
  } else if (remaining <= 0.02) {
    kwhMissionEl.textContent = "Repere atteint : tu es tout pres de 1 kWh.";
  } else if (remaining <= 0.15) {
    kwhMissionEl.textContent = "Tres proche. Un petit usage peut encore entrer.";
  } else {
    kwhMissionEl.textContent = "Il reste de la marge : ajoute un usage et observe l'effet.";
  }

  if (used > 0 && overBudget === 0 && remaining <= 0.02) {
    badges.push("kwh-precision");
  }
  if (used > 0 && overBudget === 0 && remaining <= 0.0001) {
    badges.push("kwh-full");
  }
  if (getTotalActions() >= 4) {
    badges.push("kwh-composer");
  }
  if (selectedIds.some((id) => ["kettle", "oven", "heater"].includes(id))) {
    badges.push("kwh-heat");
  }
  unlockBadges(badges);
}

function drawCanvas() {
  const width = canvas.width;
  const height = canvas.height;
  const usedRatio = getUsed() / state.budget;
  const remainingRatio = 1 - usedRatio;
  const visibleRemainingRatio = Math.max(0, remainingRatio);

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

  const fillW = (batteryW - 14) * visibleRemainingRatio;
  const fillGradient = ctx.createLinearGradient(batteryX, 0, batteryX + batteryW, 0);
  fillGradient.addColorStop(0, "#dc5c46");
  fillGradient.addColorStop(0.48, "#f4ba42");
  fillGradient.addColorStop(1, "#2f8a68");
  ctx.fillStyle = fillGradient;
  ctx.fillRect(batteryX + 7, batteryY + 7, fillW, batteryH - 14);

  ctx.fillStyle = "#16211f";
  ctx.font = "800 30px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(
    getOverBudget() > 0 ? `${Math.round(usedRatio * 100)}%` : `${Math.round(visibleRemainingRatio * 100)}%`,
    batteryX + batteryW / 2,
    124,
  );

  ctx.font = "700 14px system-ui";
  ctx.fillStyle = "#65736e";
  ctx.fillText("réserve de 1 kWh", batteryX + batteryW / 2, 184);
}

function update() {
  const used = getUsed();
  const remaining = getRemaining();
  const overBudget = getOverBudget();

  remainingEl.previousElementSibling.textContent = overBudget > 0 ? "Au-dela du repere" : "Budget restant";
  remainingEl.textContent = overBudget > 0 ? formatKwh(overBudget) : formatKwh(remaining);
  usedEl.textContent = formatKwh(used);
  actionCountEl.textContent = getTotalActions().toString();
  unlimitedButton.classList.toggle("active", state.unlimited);
  unlimitedButton.setAttribute("aria-pressed", state.unlimited.toString());
  unlimitedButton.textContent = state.unlimited ? "Mode illimite actif" : "Mode illimite";

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
    title: "Electricite -> batterie -> moteur",
    context: "Une chaine courte, typique d'une voiture electrique.",
    color: "#2f6f9f",
    steps: [
      { label: "Réseau", efficiency: 0.95 },
      { label: "Charge batterie", efficiency: 0.9 },
      { label: "Moteur", efficiency: 0.88 },
    ],
  },
  {
    id: "thermal-car",
    title: "Essence -> moteur thermique -> roues",
    context: "Peu d'etapes, mais beaucoup de chaleur perdue.",
    color: "#dc5c46",
    steps: [
      { label: "Moteur", efficiency: 0.32 },
      { label: "Transmission", efficiency: 0.9 },
    ],
  },
  {
    id: "gas-heat",
    title: "Gaz -> chaudiere -> chaleur",
    context: "Une conversion directe, adaptee a la chaleur.",
    color: "#b95f34",
    steps: [
      { label: "Combustion", efficiency: 0.92 },
      { label: "Distribution", efficiency: 0.88 },
    ],
  },
  {
    id: "hydrogen",
    title: "Electricite -> hydrogene -> electricite",
    context: "Utile pour stocker longtemps, couteux en conversions.",
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

const vehicleSources = [
  { id: "grid-clean", label: "Reseau bas carbone", description: "Electricite peu carbone, type nucleaire et renouvelables.", output: "electricity", efficiency: 0.94, carbon: 45, cost: 58, mass: 0, color: "#2f6f9f", tags: ["lowCarbon"], directEmission: false },
  { id: "grid-average", label: "Reseau moyen", description: "Electricite melangee, plus ou moins carbonnee selon le pays.", output: "electricity", efficiency: 0.92, carbon: 230, cost: 50, mass: 0, color: "#487b8f", tags: [], directEmission: false },
  { id: "grid-fossil", label: "Reseau charbon/gaz", description: "Electricite produite surtout avec des combustibles fossiles.", output: "electricity", efficiency: 0.86, carbon: 620, cost: 42, mass: 0, color: "#6f5f4b", tags: ["fossil"], directEmission: false },
  { id: "solar-local", label: "Solaire local", description: "Tres bas carbone, mais production variable.", output: "electricity", efficiency: 0.9, carbon: 28, cost: 86, mass: 0, color: "#f4ba42", tags: ["lowCarbon"], directEmission: false },
  { id: "wind-local", label: "Eolien local", description: "Tres bas carbone, utile si la chaine accepte l'intermittence.", output: "electricity", efficiency: 0.91, carbon: 16, cost: 80, mass: 0, color: "#2f8a68", tags: ["lowCarbon"], directEmission: false },
  { id: "petrol", label: "Petrole essence", description: "Carburant dense, facile a stocker, mais tres carbone.", output: "liquid", efficiency: 0.97, carbon: 285, cost: 52, mass: 0, color: "#dc5c46", tags: ["fossil"], directEmission: true },
  { id: "diesel", label: "Petrole diesel", description: "Tres dense et efficace en thermique, emissions directes elevees.", output: "liquid", efficiency: 0.97, carbon: 270, cost: 55, mass: 0, color: "#b95f34", tags: ["fossil"], directEmission: true },
  { id: "biofuel", label: "Bioethanol", description: "Carburant liquide, carbone variable selon la production.", output: "liquid", efficiency: 0.94, carbon: 115, cost: 70, mass: 0, color: "#7a8f36", tags: ["bio"], directEmission: true },
  { id: "synthetic-fuel", label: "Carburant synthetique", description: "Liquide fabrique avec electricite et CO2 capte, couteux.", output: "liquid", efficiency: 0.55, carbon: 75, cost: 115, mass: 0, color: "#8b6fb0", tags: ["future"], directEmission: true },
  { id: "hydrogen-green", label: "Hydrogene vert", description: "Hydrogene produit par electrolyse bas carbone.", output: "hydrogen", efficiency: 0.66, carbon: 38, cost: 105, mass: 0, color: "#2f9f93", tags: ["lowCarbon"], directEmission: false },
  { id: "hydrogen-fossil", label: "Hydrogene gaz fossile", description: "Hydrogene courant mais carbone en amont.", output: "hydrogen", efficiency: 0.74, carbon: 360, cost: 82, mass: 0, color: "#487b8f", tags: ["fossil"], directEmission: false },
  { id: "wood-coal", label: "Bois ou charbon", description: "Source historique pour produire de la chaleur et de la vapeur.", output: "heat", efficiency: 0.72, carbon: 330, cost: 38, mass: 12, color: "#6f4f38", tags: ["historic"], directEmission: true },
  { id: "compressed-air-source", label: "Air comprime", description: "Air comprime avec electricite avant le trajet.", output: "pressure", efficiency: 0.62, carbon: 120, cost: 62, mass: 0, color: "#7aa8b8", tags: ["weird"], directEmission: false },
];

const vehicleStorages = [
  { id: "battery-lfp", label: "Batterie LFP", description: "Pack complet rempli : robuste, mais plus lourd qu'une batterie NMC.", input: "electricity", output: "electricity", efficiency: 0.92, range: 430, mass: 520, cost: 72, tags: ["battery"] },
  { id: "battery-li-ion", label: "Batterie lithium-ion", description: "Pack complet moderne, dense mais encore lourd a l'echelle d'une voiture.", input: "electricity", output: "electricity", efficiency: 0.9, range: 470, mass: 470, cost: 86, tags: ["battery"] },
  { id: "battery-solid", label: "Batterie solide avancee", description: "Hypothese futuriste : meilleure densite, mais pack complet toujours massif.", input: "electricity", output: "electricity", efficiency: 0.93, range: 560, mass: 400, cost: 125, tags: ["future", "battery"] },
  { id: "lead-acid", label: "Batterie plomb", description: "Ancienne technologie : faible densite, donc masse enorme meme pour peu d'autonomie.", input: "electricity", output: "electricity", efficiency: 0.78, range: 140, mass: 720, cost: 28, tags: ["historic", "battery"] },
  { id: "supercap", label: "Supercondensateurs", description: "Tres forte puissance et charge rapide, mais stockage d'energie peu dense.", input: "electricity", output: "electricity", efficiency: 0.95, range: 70, mass: 300, cost: 95, tags: ["future"] },
  { id: "gasoline-tank", label: "Reservoir essence plein", description: "Reservoir, pompe et carburant inclus : beaucoup plus leger qu'un pack batterie.", input: "liquid", output: "liquid", efficiency: 0.98, range: 680, mass: 58, cost: 35, tags: ["fuel"] },
  { id: "diesel-tank", label: "Reservoir diesel plein", description: "Reservoir rempli : carburant dense, autonomie elevee pour une masse moderee.", input: "liquid", output: "liquid", efficiency: 0.98, range: 780, mass: 64, cost: 40, tags: ["fuel"] },
  { id: "racing-tank", label: "Reservoir leger rempli", description: "Plus petit et plus sportif, mais masse du carburant incluse.", input: "liquid", output: "liquid", efficiency: 0.98, range: 420, mass: 38, cost: 58, tags: ["sport"] },
  { id: "h2-700", label: "Hydrogene 700 bars plein", description: "Hydrogene plus reservoirs carbone haute pression et vannes de securite.", input: "hydrogen", output: "hydrogen", efficiency: 0.9, range: 540, mass: 115, cost: 105, tags: ["hydrogen"] },
  { id: "h2-liquid", label: "Hydrogene liquide plein", description: "Hydrogene cryogenique, isolation, soupapes et systeme de maintien au froid inclus.", input: "hydrogen", output: "hydrogen", efficiency: 0.82, range: 640, mass: 150, cost: 135, tags: ["hydrogen", "future"] },
  { id: "boiler", label: "Chaudiere vapeur chargee", description: "Chaudiere, eau, combustible embarque et securite pression inclus.", input: "heat", output: "steam", efficiency: 0.58, range: 95, mass: 420, cost: 68, tags: ["historic", "steam"] },
  { id: "hot-buffer", label: "Reserve chaude chargee", description: "Stock thermique, isolant et echangeur : lourd pour une autonomie limitee.", input: "heat", output: "heat", efficiency: 0.72, range: 130, mass: 260, cost: 62, tags: ["historic"] },
  { id: "air-tank", label: "Reservoir air comprime plein", description: "Reservoir composite haute pression et air stocke : peu dense energetiquement.", input: "pressure", output: "pressure", efficiency: 0.78, range: 115, mass: 240, cost: 52, tags: ["weird"] },
];

const vehicleMotors = [
  { id: "steam-piston", label: "Moteur vapeur a piston", description: "Iconique, lent, beaucoup de pertes.", input: "steam", efficiency: 0.18, mass: 125, cost: 62, power: 34, tags: ["historic", "steam"] },
  { id: "steam-turbine", label: "Turbine vapeur", description: "Plus fluide, mais lourde pour une voiture.", input: "steam", efficiency: 0.26, mass: 145, cost: 88, power: 56, tags: ["historic", "steam"] },
  { id: "stirling", label: "Moteur Stirling", description: "Elegant et silencieux, puissance modeste.", input: "heat", efficiency: 0.29, mass: 92, cost: 76, power: 36, tags: ["historic", "weird"] },
  { id: "gasoline-na", label: "Essence atmospherique", description: "Simple, connu, rendement limite.", input: "liquid", efficiency: 0.27, mass: 78, cost: 48, power: 65, tags: ["thermal"] },
  { id: "gasoline-turbo", label: "Essence turbo", description: "Plus compact et puissant.", input: "liquid", efficiency: 0.34, mass: 86, cost: 70, power: 82, tags: ["thermal", "sport"] },
  { id: "diesel-modern", label: "Diesel haut rendement", description: "Bon rendement, plus lourd et complexe.", input: "liquid", efficiency: 0.42, mass: 104, cost: 78, power: 70, tags: ["thermal"] },
  { id: "wankel", label: "Moteur rotatif Wankel", description: "Compact et original, rendement modeste.", input: "liquid", efficiency: 0.24, mass: 58, cost: 86, power: 78, tags: ["weird", "sport"] },
  { id: "gas-turbine", label: "Turbine a gaz", description: "Tres puissante, peu adaptee au quotidien.", input: "liquid", efficiency: 0.22, mass: 74, cost: 112, power: 96, tags: ["weird", "sport"] },
  { id: "electric-dc", label: "Moteur electrique ancien", description: "Simple, moins efficace que les moteurs modernes.", input: "electricity", efficiency: 0.82, mass: 62, cost: 46, power: 54, tags: ["historic", "electric"] },
  { id: "induction", label: "Moteur asynchrone", description: "Robuste, sans aimants permanents.", input: "electricity", efficiency: 0.9, mass: 54, cost: 68, power: 76, tags: ["electric"] },
  { id: "pmsm", label: "Moteur aimants permanents", description: "Tres efficace et tres courant en VE modernes.", input: "electricity", efficiency: 0.94, mass: 44, cost: 88, power: 88, tags: ["electric"] },
  { id: "reluctance", label: "Moteur a reluctance", description: "Efficace, limite certains materiaux critiques.", input: "electricity", efficiency: 0.92, mass: 46, cost: 82, power: 82, tags: ["electric", "future"] },
  { id: "axial-flux", label: "Moteur axial flux", description: "Tres compact, tres moderne, cher.", input: "electricity", efficiency: 0.96, mass: 34, cost: 112, power: 96, tags: ["electric", "future", "sport"] },
  { id: "fuel-cell", label: "Pile a combustible + moteur", description: "Transforme l'hydrogene en electricite puis en mouvement.", input: "hydrogen", efficiency: 0.54, mass: 92, cost: 128, power: 72, tags: ["hydrogen", "electric"] },
  { id: "pneumatic", label: "Moteur pneumatique", description: "Fonctionne a l'air comprime, pertes fortes.", input: "pressure", efficiency: 0.32, mass: 42, cost: 44, power: 30, tags: ["weird"] },
];

const vehicleTransmissions = [
  { id: "direct", label: "Transmission directe", description: "Simple, peu de pertes, peu flexible.", efficiency: 0.97, mass: 10, cost: 20, rangeBonus: 0, tags: ["simple"] },
  { id: "reducer", label: "Reducteur simple", description: "Classique sur voiture electrique.", efficiency: 0.95, mass: 18, cost: 32, rangeBonus: 15, tags: ["electric"] },
  { id: "manual", label: "Boite manuelle", description: "Bon controle, pertes raisonnables.", efficiency: 0.92, mass: 35, cost: 36, rangeBonus: 0, tags: ["thermal"] },
  { id: "automatic", label: "Boite automatique", description: "Confortable, un peu plus de pertes.", efficiency: 0.88, mass: 48, cost: 58, rangeBonus: -10, tags: ["thermal"] },
  { id: "cvt", label: "CVT", description: "Rapport continu, utile pour rester au bon regime.", efficiency: 0.86, mass: 42, cost: 52, rangeBonus: 10, tags: ["thermal"] },
  { id: "awd", label: "Transmission integrale", description: "Meilleure motricite, masse et pertes en plus.", efficiency: 0.9, mass: 62, cost: 76, rangeBonus: -25, tags: ["sport"] },
  { id: "regen", label: "Reducteur + recuperation", description: "Recupere une partie de l'energie au freinage.", efficiency: 0.96, mass: 24, cost: 54, rangeBonus: 65, tags: ["electric", "city"] },
];

const vehicleMissions = [
  { id: "efficiency", label: "Rendement max", goal: "Garde le plus d'energie possible jusqu'aux roues.", hint: "Repere haut : rendement superieur a 65%." },
  { id: "clean-city", label: "Ville sobre", goal: "Cherche peu de CO2, assez d'autonomie et une masse raisonnable.", hint: "Repere haut : moins de 60 g/km et plus de 150 km." },
  { id: "long-trip", label: "Long trajet", goal: "Assemble une voiture capable de partir loin sans ignorer les pertes.", hint: "Repere haut : au moins 500 km d'autonomie." },
  { id: "heritage", label: "Garage 1905", goal: "Teste une technologie historique et regarde ce qu'elle implique.", hint: "Repere haut : technologie historique et rendement au-dessus de 15%." },
  { id: "budget", label: "Budget serre", goal: "Cherche une voiture utilisable avec une chaine technique simple.", hint: "Repere haut : cout bas et autonomie correcte." },
  { id: "power", label: "Puissance maximale", goal: "Maximise la puissance utile sans oublier la transmission.", hint: "Repere haut : plus de 90 kW et une vitesse elevee." },
  { id: "speed", label: "Vitesse maximale", goal: "Cherche la pointe avec assez de puissance et une masse contenue.", hint: "Repere haut : passer 145 km/h avec une masse contenue." },
];

const vehicleState = {
  mission: "",
  source: "",
  storage: "",
  motor: "",
  transmission: "",
  tested: false,
  garage: loadVehicleGarage(),
};
const baseVehicleMass = 950;

const badgeDefinitions = [
  {
    id: "kwh-precision",
    mission: "1 kWh",
    label: "Pile dans le repere",
    symbol: "1K",
    tone: "yellow",
    description: "Tu as utilise presque exactement 1 kWh.",
    hint: "Dans 1 kWh, finis avec moins de 0,02 kWh restant.",
  },
  {
    id: "kwh-full",
    mission: "1 kWh",
    label: "Juste 1 kWh",
    symbol: "100",
    tone: "green",
    description: "La reserve de 1 kWh est remplie au wattheure pres.",
    hint: "Dans 1 kWh, tombe exactement a 0 kWh restant.",
  },
  {
    id: "kwh-composer",
    mission: "1 kWh",
    label: "Panier d'usages",
    symbol: "4+",
    tone: "blue",
    description: "Tu as compose un kWh avec plusieurs petits usages.",
    hint: "Ajoute au moins 4 actions dans le jeu 1 kWh.",
  },
  {
    id: "kwh-heat",
    mission: "1 kWh",
    label: "Chaleur visible",
    symbol: "CH",
    tone: "red",
    description: "Tu as observe qu'un usage de chaleur remplit vite la reserve.",
    hint: "Utilise four, radiateur ou bouilloire dans le jeu 1 kWh.",
  },
  {
    id: "efficiency-saver",
    mission: "Rendement",
    label: "Chaine sobre",
    symbol: "70",
    tone: "green",
    description: "Une chaine garde au moins 70 unites utiles.",
    hint: "Dans Rendement, choisis une chaine qui conserve au moins 70 unites.",
  },
  {
    id: "efficiency-loss",
    mission: "Rendement",
    label: "Pertes reperees",
    symbol: "P",
    tone: "red",
    description: "Tu as explore une chaine ou les pertes deviennent majoritaires.",
    hint: "Dans Rendement, teste une chaine qui garde moins de 40 unites utiles.",
  },
  {
    id: "efficiency-hydrogen",
    mission: "Rendement",
    label: "Boucle hydrogene",
    symbol: "H2",
    tone: "blue",
    description: "Tu as suivi les conversions electricite-hydrogene-electricite.",
    hint: "Dans Rendement, selectionne la chaine hydrogene.",
  },
  {
    id: "storage-night",
    mission: "Stockage",
    label: "Nuit couverte",
    symbol: "N",
    tone: "green",
    description: "Le besoin du soir est couvert.",
    hint: "Dans Stockage, restitue assez d'energie pour couvrir le soir.",
  },
  {
    id: "storage-operator",
    mission: "Stockage",
    label: "Equilibre reseau",
    symbol: "OP",
    tone: "yellow",
    description: "Le soir est couvert avec pertes et cout maitrises.",
    hint: "Dans Stockage, couvre le soir avec moins de 25 MWh de pertes et un cout sous 230.",
  },
  {
    id: "storage-step",
    mission: "Stockage",
    label: "STEP en action",
    symbol: "STEP",
    tone: "blue",
    description: "Tu as utilise massivement le pompage-turbinage.",
    hint: "Dans Stockage, mets au moins 40 MWh de STEP.",
  },
  {
    id: "mix-balanced",
    mission: "Mix",
    label: "100% couvert",
    symbol: "100",
    tone: "green",
    description: "Ton mix atteint exactement toute la demande.",
    hint: "Dans Mix, arrive exactement a 100% de production.",
  },
  {
    id: "mix-planner",
    mission: "Mix",
    label: "Mix bas carbone",
    symbol: "CO2",
    tone: "blue",
    description: "Demande couverte, CO2 bas, stabilite correcte.",
    hint: "Dans Mix, atteins 100%, moins de 120 gCO2/kWh et au moins 60% de stabilite.",
  },
  {
    id: "mix-locksmith",
    mission: "Mix",
    label: "Jauges fixees",
    symbol: "LOCK",
    tone: "yellow",
    description: "Tu as fixe des jauges pour piloter ton mix plus finement.",
    hint: "Dans Mix, verrouille au moins une jauge.",
  },
  {
    id: "efficiency-master",
    mission: "Voiture",
    label: "Rendement solide",
    symbol: "R",
    tone: "green",
    description: "Une chaine qui garde au moins 65% de l'energie jusqu'aux roues.",
    hint: "Atteins 65% de rendement final.",
    test: (stats) => stats.efficiency >= 0.65,
  },
  {
    id: "tailpipe-zero",
    mission: "Voiture",
    label: "Sans emission directe",
    symbol: "CO2",
    tone: "blue",
    description: "Aucune emission directe pendant le trajet.",
    hint: "Choisis une chaine sans emission directe.",
    test: (stats) => !stats.selection.source.directEmission,
  },
  {
    id: "range-500",
    mission: "Voiture",
    label: "Cap des 500 km",
    symbol: "500",
    tone: "yellow",
    description: "Une autonomie qui permet de vrais longs trajets.",
    hint: "Atteins au moins 500 km d'autonomie.",
    test: (stats) => stats.range >= 500,
  },
  {
    id: "speed-145",
    mission: "Voiture",
    label: "Vitesse de pointe",
    symbol: "V",
    tone: "red",
    description: "Une voiture capable de passer au-dessus de 145 km/h.",
    hint: "Passe au-dessus de 145 km/h.",
    test: (stats) => stats.speed > 145,
  },
  {
    id: "light-chain",
    mission: "Voiture",
    label: "Chaine legere",
    symbol: "KG",
    tone: "blue",
    description: "Source, stockage, moteur et transmission restent sous 115 kg.",
    hint: "Garde la masse embarquee a 115 kg ou moins.",
    test: (stats) => stats.mass <= 115,
  },
  {
    id: "mission-gold",
    mission: "Voiture",
    label: "Essai de reference",
    symbol: "OR",
    tone: "yellow",
    description: "Une voiture qui atteint le meilleur niveau sur sa mission.",
    hint: "Obtiens un score de 85 / 100 ou plus sur une mission voiture.",
    test: (stats) => stats.score >= 85,
  },
  {
    id: "historic-maker",
    mission: "Voiture",
    label: "Mecanique historique",
    symbol: "1905",
    tone: "brown",
    description: "Une technologie historique integree dans une vraie voiture.",
    hint: "Utilise au moins une technologie historique.",
    test: (stats) => hasVehicleTag(stats.selection, "historic"),
  },
  {
    id: "future-tech",
    mission: "Voiture",
    label: "Technologie futuriste",
    symbol: "F",
    tone: "blue",
    description: "Une architecture qui teste une technologie de nouvelle generation.",
    hint: "Utilise au moins une technologie futuriste.",
    test: (stats) => hasVehicleTag(stats.selection, "future"),
  },
  {
    id: "steam-hero",
    mission: "Voiture",
    label: "Vapeur en route",
    symbol: "ST",
    tone: "brown",
    description: "La vapeur arrive jusqu'aux roues, malgre les pertes.",
    hint: "Assemble une voiture a moteur vapeur.",
    test: (stats) => stats.selection.motor.tags.includes("steam"),
  },
  {
    id: "hydrogen-build",
    mission: "Voiture",
    label: "Chaine hydrogene",
    symbol: "H2",
    tone: "green",
    description: "Une chaine hydrogene complete, stockage compris.",
    hint: "Utilise une chaine hydrogene.",
    test: (stats) => stats.selection.motor.tags.includes("hydrogen") || stats.selection.storage.tags.includes("hydrogen"),
  },
  {
    id: "rolling-lab",
    mission: "Voiture",
    label: "Essai atypique",
    symbol: "LAB",
    tone: "red",
    description: "Une motorisation atypique qui montre bien les compromis.",
    hint: "Teste Wankel, turbine a gaz ou air comprime.",
    test: (stats) => ["wankel", "gas-turbine", "pneumatic"].includes(stats.selection.motor.id),
  },
  {
    id: "loss-factory",
    mission: "Voiture",
    label: "Pertes assumees",
    symbol: "P%",
    tone: "red",
    description: "Une voiture utile pour voir beaucoup de pertes d'un coup.",
    hint: "Descends a 18% de rendement ou moins.",
    test: (stats) => stats.efficiency <= 0.18,
  },
  {
    id: "smart-mix",
    mission: "Voiture",
    label: "Source coherente",
    symbol: "MX",
    tone: "green",
    description: "Electricite bas carbone et batterie vont bien ensemble.",
    hint: "Associe une source bas carbone avec une batterie.",
    test: (stats) => stats.selection.source.tags.includes("lowCarbon") && stats.selection.storage.tags.includes("battery"),
  },
  {
    id: "budget-runner",
    mission: "Voiture",
    label: "Budget lisible",
    symbol: "$",
    tone: "yellow",
    description: "Une voiture utile sans empiler les solutions couteuses.",
    hint: "Reste sous 180 de cout avec au moins 250 km d'autonomie.",
    test: (stats) => stats.cost <= 180 && stats.range >= 250,
  },
];

badgeState.unlockedBadges = loadUnlockedBadges();

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
    button.addEventListener("click", () => renderEfficiency(chain.id, true));
    options.append(button);
  });

  renderEfficiency(efficiencyChains[0].id);
}

function renderEfficiency(id, shouldUnlock = false) {
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
    row.dataset.tip = `Vert = energie utile, rouge = pertes : -${Math.round(lost)}`;
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
  usefulEl.parentElement.dataset.tip = "Energie encore exploitable";
  lossEl.parentElement.dataset.tip = "Energie dissipee, souvent en chaleur";
  scoreEl.textContent = `${Math.round(useful)} / 100`;
  challengeEl.textContent =
    useful >= 70
      ? "Bonne chaine : beaucoup d'energie reste exploitable."
      : "Observe les pertes : chaque conversion compte.";
  noteEl.textContent =
    useful > 70
      ? "Cette chaine garde beaucoup d'energie utile. Les pertes existent, mais restent limitees."
      : useful > 45
        ? "Le rendement est moyen : une part visible de l'energie change de forme avant l'usage final."
        : "La chaine multiplie les conversions. Cela peut etre utile, mais le prix energetique apparait vite.";
  if (shouldUnlock) {
    unlockBadges([
      useful >= 70 ? "efficiency-saver" : "",
      useful < 40 ? "efficiency-loss" : "",
      id === "hydrogen" ? "efficiency-hydrogen" : "",
    ]);
  }
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
  track.dataset.tip = "Vert continue vers l'usage, rouge part en pertes";
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
    input.addEventListener("input", () => renderStorage(true));
  });

  renderStorage();
}

function renderStorage(shouldUnlock = false) {
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
    block.dataset.tip = `${tech.label}: energie disponible apres pertes`;
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
  document.querySelector("#storage-delivered").parentElement.dataset.tip = "Energie vraiment recuperable";
  document.querySelector("#storage-gap").parentElement.dataset.tip = "Demande du soir non couverte";
  document.querySelector("#storage-loss").parentElement.dataset.tip = "Energie perdue pendant le stockage";
  document.querySelector("#storage-cost").parentElement.dataset.tip = "Indice de cout simplifie";
  renderStorageVisuals(values, delivered, losses, gap, surplus, cost, eveningNeed);
  document.querySelector("#storage-score").textContent = `${score} / 100`;
  document.querySelector("#storage-challenge").textContent =
    gap === 0 && losses < 25 && cost < 230
      ? "Equilibre solide : le soir est couvert avec pertes et cout maitrises."
      : gap > 0
        ? "Ajuste le stockage : il manque encore de l'energie au bon moment."
        : cost >= 230
          ? "Le soir est couvert, mais le cout grimpe. Cherche une combinaison plus sobre."
          : "Le soir est couvert. Tu peux encore reduire les pertes ou la marge.";
  if (shouldUnlock) {
    unlockBadges([
      gap === 0 ? "storage-night" : "",
      gap === 0 && losses < 25 && cost < 230 ? "storage-operator" : "",
      values.step >= 40 ? "storage-step" : "",
    ]);
  }
  document.querySelector("#storage-note").textContent =
    gap > 0
      ? "Il manque de l'energie au moment utile. Un stockage se juge autant par sa disponibilite que par sa quantite."
      : surplus > 24
        ? "La nuit passe avec une grande marge. C'est robuste, mais cela demande plus de materiel et de budget."
        : "La nuit passe avec une marge raisonnable. Les pertes restent visibles, surtout sur les longues chaines.";
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
    column.dataset.tip = `${point.label}: production ${point.solar}, demande ${point.demand}`;
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
    "Part du besoin du soir couverte";
  document.querySelector("#storage-coverage-label").textContent = `${coverage}% couvert`;
  document.querySelector("#storage-surplus-label").textContent =
    surplus > 0 ? `${Math.round(surplus)} MWh marge` : `${Math.round(gap)} MWh manquants`;

  balance.parentElement.querySelector(".balance-legend")?.remove();
  balance.innerHTML = "";
  balance.parentElement.dataset.tip = "Energie utile, pertes et manque";
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
    row.dataset.tip = `${tech.label}: part du cout simplifie`;
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
      renderMix(true);
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
  renderMix(true);
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

function renderMix(shouldUnlock = false) {
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
      `${isLocked ? "Liberer" : "Fixer"} ${source.label}`,
    );
    lockButton.title = isLocked ? "Liberer cette jauge" : "Fixer cette jauge";
  });

  document.querySelector("#mix-donut").style.background =
    `conic-gradient(${gradientParts.join(", ")})`;
  document.querySelector("#mix-donut").dataset.tip = "Part de chaque source dans le mix";
  document.querySelector("#mix-total").textContent = `${Math.round(rawTotal)}%`;
  document.querySelector("#mix-remaining").textContent = `${Math.max(0, 100 - Math.round(rawTotal))}%`;
  document.querySelector("#mix-carbon").textContent = `${Math.round(carbon)} g/kWh`;
  document.querySelector("#mix-cost").textContent = Math.round(cost).toString();
  document.querySelector("#mix-stability").textContent = `${Math.round(stability)}%`;
  document.querySelector("#mix-remaining").parentElement.dataset.tip = "Part de production encore libre";
  document.querySelector("#mix-carbon").parentElement.dataset.tip = "Intensite carbone moyenne";
  document.querySelector("#mix-cost").parentElement.dataset.tip = "Indice de cout simplifie";
  document.querySelector("#mix-stability").parentElement.dataset.tip = "Part facilement pilotable";
  const score = Math.max(
    0,
    Math.min(100, Math.round(stability - carbon / 12 - Math.abs(100 - rawTotal) * 1.2)),
  );
  document.querySelector("#mix-score").textContent = `${score} / 100`;
  document.querySelector("#mix-challenge").textContent =
    rawTotal === 100 && carbon < 120 && stability >= 60
      ? "Mix coherent : demande couverte, CO2 bas, stabilite correcte."
      : rawTotal < 100
        ? "Complete le mix jusqu'a 100% pour couvrir la demande."
        : "Compare les curseurs : baisse le CO2 sans trop perdre en stabilite.";
  if (shouldUnlock) {
    unlockBadges([
      rawTotal === 100 ? "mix-balanced" : "",
      rawTotal === 100 && carbon < 120 && stability >= 60 ? "mix-planner" : "",
      Object.values(mixLocked).some(Boolean) ? "mix-locksmith" : "",
    ]);
  }
  document.querySelector("#mix-note").textContent =
    total < 90
      ? "Le mix ne couvre pas assez la demande : il faudrait importer, stocker ou reduire certains usages."
      : total > 115
        ? "La production est largement superieure a la demande. Sans flexibilite, une partie de cette energie sera difficile a valoriser."
        : stability < 60
          ? "Le mix est bas carbone, mais tres dependant de la meteo : stockage et pilotable prennent de l'importance."
          : "Le mix couvre la demande avec une stabilite correcte. Les indicateurs rappellent qu'un choix energetique a plusieurs dimensions.";
}

function initVehicleGame() {
  document.querySelector("#vehicle-name").addEventListener("input", () => {
    renderVehicle();
  });

  document.querySelector("#vehicle-test-button").addEventListener("click", () => {
    if (!calculateVehicleStats()) {
      return;
    }

    vehicleState.tested = true;
    renderVehicle();
    const chain = document.querySelector("#vehicle-chain");
    chain.classList.add("testing");
    window.setTimeout(() => chain.classList.remove("testing"), 1800);
  });

  document.querySelector("#vehicle-save-button").addEventListener("click", () => {
    saveVehicleBuild();
  });

  renderVehicle();
}

function initBadgePage() {
  document.querySelector("#badge-filter").addEventListener("change", (event) => {
    badgeState.filter = event.target.value;
    renderBadges();
  });

  renderBadges();
}

function getVehicleComponent(list, id) {
  return list.find((item) => item.id === id) || null;
}

function getVehicleSelection() {
  return {
    source: getVehicleComponent(vehicleSources, vehicleState.source),
    storage: getVehicleComponent(vehicleStorages, vehicleState.storage),
    motor: getVehicleComponent(vehicleMotors, vehicleState.motor),
    transmission: getVehicleComponent(vehicleTransmissions, vehicleState.transmission),
  };
}

function ensureVehicleCompatibility() {
  const source = getVehicleComponent(vehicleSources, vehicleState.source);
  let storage = getVehicleComponent(vehicleStorages, vehicleState.storage);

  if (!source || (storage && storage.input !== source.output)) {
    vehicleState.storage = "";
    storage = null;
  }

  let motor = getVehicleComponent(vehicleMotors, vehicleState.motor);

  if (!storage || (motor && motor.input !== storage.output)) {
    vehicleState.motor = "";
    motor = null;
  }

  if (!motor) {
    vehicleState.transmission = "";
  }
}

function getVehicleTotalEfficiency(selection) {
  return selection.source.efficiency
    * selection.storage.efficiency
    * selection.motor.efficiency
    * selection.transmission.efficiency;
}

function calculateVehicleStats() {
  const selection = getVehicleSelection();

  if (!vehicleState.mission || Object.values(selection).some((item) => !item)) {
    return null;
  }

  const efficiency = getVehicleTotalEfficiency(selection);
  const mass = selection.source.mass + selection.storage.mass + selection.motor.mass + selection.transmission.mass;
  const cost = selection.source.cost + selection.storage.cost + selection.motor.cost + selection.transmission.cost;
  const range = Math.max(
    25,
    Math.round(selection.storage.range * (0.55 + efficiency) + selection.transmission.rangeBonus - mass * 0.3),
  );
  const carbon = Math.max(0, Math.round(selection.source.carbon * 0.18 / Math.max(efficiency, 0.08)));
  const power = Math.max(
    8,
    Math.min(100, Math.round(selection.motor.power * selection.transmission.efficiency)),
  );
  const totalMass = baseVehicleMass + mass;
  const speed = Math.max(
    35,
    Math.min(260, Math.round(55 + power * 1.25 - totalMass * 0.022)),
  );
  const complexity = Math.round((cost / 22) + (mass / 55) + (selection.transmission.tags.includes("sport") ? 8 : 0));
  const score = scoreVehicleBuild({ selection, efficiency, range, carbon, mass, totalMass, cost, power, speed, complexity });
  const medal = score >= 85 ? "Or" : score >= 70 ? "Argent" : score >= 52 ? "Bronze" : "Essai";

  return {
    selection,
    efficiency,
    range,
    carbon,
    mass,
    totalMass,
    cost,
    power,
    speed,
    complexity,
    score,
    medal,
    badges: getVehicleBadges({ selection, efficiency, range, carbon, mass, totalMass, cost, power, speed, score }),
  };
}

function scoreVehicleBuild(stats) {
  const mission = vehicleState.mission;
  const hasHistoric = hasVehicleTag(stats.selection, "historic");
  let score;

  if (mission === "efficiency") {
    score = 18 + stats.efficiency * 112 - stats.carbon / 18 - stats.mass / 18 - stats.complexity * 0.8;
  } else if (mission === "clean-city") {
    score = 105 - stats.carbon * 0.82 + Math.min(stats.range, 260) / 8 - stats.mass / 10;
  } else if (mission === "long-trip") {
    score = 18 + stats.range / 6 + stats.power / 4 - stats.cost / 8 - stats.carbon / 24;
  } else if (mission === "heritage") {
    score = (hasHistoric ? 62 : 18) + stats.efficiency * 58 + Math.min(stats.range, 180) / 7 - stats.cost / 12;
  } else if (mission === "budget") {
    score = 118 - stats.cost * 0.72 + stats.range / 12 + stats.efficiency * 22 - stats.carbon / 20;
  } else if (mission === "power") {
    score = 6 + stats.power * 0.62 + stats.speed * 0.28 + stats.efficiency * 22 - stats.mass / 18 - stats.cost / 20;
  } else {
    score = 11 + stats.speed * 0.58 + stats.power * 0.18 + stats.efficiency * 16 - stats.totalMass / 48 - stats.cost / 28;
    if (stats.speed <= 145) {
      score = Math.min(score, 84);
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function hasVehicleTag(selection, tag) {
  return Object.values(selection).some((item) => item.tags?.includes(tag));
}

function getVehicleBadges(stats) {
  return badgeDefinitions.filter((badge) => badge.mission === "Voiture" && badge.test(stats));
}

function renderVehicle() {
  ensureVehicleCompatibility();
  renderVehicleMissionButtons();
  renderVehicleBuilder();

  const stats = calculateVehicleStats();
  const name = getVehicleName();

  document.querySelector("#vehicle-display-name").textContent = name;
  if (!stats) {
    renderVehicleEmptyState(name);
    renderVehicleGarage();
    return;
  }

  document.querySelector("#vehicle-score").textContent = `${stats.score} / 100`;
  document.querySelector("#vehicle-challenge").textContent = getVehicleChallengeText(stats);
  document.querySelector("#vehicle-archetype").textContent = getVehicleArchetype(stats);
  document.querySelector("#vehicle-summary-copy").textContent = getVehicleSummary(stats);
  document.querySelector("#vehicle-efficiency").textContent = `${Math.round(stats.efficiency * 100)}%`;
  document.querySelector("#vehicle-range").textContent = `${stats.range} km`;
  document.querySelector("#vehicle-carbon").textContent = `${stats.carbon} g/km`;
  document.querySelector("#vehicle-mass").textContent = `${stats.mass} kg`;
  document.querySelector("#vehicle-total-mass").textContent = `${stats.totalMass} kg`;
  document.querySelector("#vehicle-cost").textContent = stats.cost.toString();
  document.querySelector("#vehicle-power").textContent = `${stats.power} kW`;
  document.querySelector("#vehicle-speed").textContent = `${stats.speed} km/h`;
  document.querySelector("#vehicle-test-button").disabled = false;
  document.querySelector("#vehicle-save-button").disabled = false;

  const visual = document.querySelector("#vehicle-visual");
  visual.style.setProperty("--vehicle-color", stats.selection.source.color);
  visual.style.setProperty("--vehicle-accent", stats.selection.motor.tags.includes("electric") ? "#2f6f9f" : "#f4ba42");
  visual.classList.toggle("tested", vehicleState.tested);

  renderVehicleChain(stats);
  unlockBadges(stats.badges.map((badge) => badge.id));
  renderVehicleCard(stats, name);
  renderVehicleGarage();
}

function renderVehicleEmptyState(name) {
  document.querySelector("#vehicle-score").textContent = "0 / 100";
  document.querySelector("#vehicle-challenge").textContent = "Choisis un essai puis complete les 4 etapes de la chaine d'energie.";
  document.querySelector("#vehicle-archetype").textContent = "Voiture a assembler";
  document.querySelector("#vehicle-summary-copy").textContent = "La chaine n'est pas encore complete.";
  document.querySelector("#vehicle-efficiency").textContent = "0%";
  document.querySelector("#vehicle-range").textContent = "0 km";
  document.querySelector("#vehicle-carbon").textContent = "0 g/km";
  document.querySelector("#vehicle-mass").textContent = "0 kg";
  document.querySelector("#vehicle-total-mass").textContent = "0 kg";
  document.querySelector("#vehicle-cost").textContent = "0";
  document.querySelector("#vehicle-power").textContent = "0 kW";
  document.querySelector("#vehicle-speed").textContent = "0 km/h";

  const visual = document.querySelector("#vehicle-visual");
  visual.style.setProperty("--vehicle-color", "#9aa7a1");
  visual.style.setProperty("--vehicle-accent", "#d8c9ad");
  visual.classList.remove("tested");

  document.querySelector("#vehicle-chain").innerHTML = `
    <div class="vehicle-chain-empty">
      <strong>Chaine a completer</strong>
      <span>Les pertes apparaitront quand source, stockage, moteur et transmission seront choisis.</span>
    </div>
  `;
  document.querySelector("#vehicle-card").innerHTML = `
    <div>
      <p class="eyebrow">Carte technique</p>
      <h2>${escapeHtml(name)}</h2>
      <span class="vehicle-medal">A assembler</span>
    </div>
    <p>Selectionne les options pour afficher la carte technique de la voiture.</p>
  `;

  document.querySelector("#vehicle-test-button").disabled = true;
  document.querySelector("#vehicle-save-button").disabled = true;
}

function renderVehicleMissionButtons() {
  const missionEl = document.querySelector("#vehicle-missions");
  const currentMission = vehicleMissions.find((mission) => mission.id === vehicleState.mission);
  missionEl.innerHTML = "";

  const control = document.createElement("label");
  control.className = "vehicle-select-control";
  control.innerHTML = `
    <span>Essai a mener</span>
    <select id="vehicle-mission-select">
      <option value="">Choisir un essai...</option>
      ${vehicleMissions
        .map((mission) => `<option value="${mission.id}">${getVehicleMissionSelectLabel(mission)}</option>`)
        .join("")}
    </select>
    <small>${currentMission ? currentMission.goal : "Choisis un essai pour orienter les indicateurs."}</small>
  `;

  const select = control.querySelector("select");
  select.value = vehicleState.mission || "";
  select.addEventListener("change", (event) => {
    vehicleState.mission = event.target.value;
    vehicleState.tested = false;
    renderVehicle();
  });
  missionEl.append(control);
}

function renderVehicleBuilder() {
  const builder = document.querySelector("#vehicle-builder");
  const source = getVehicleComponent(vehicleSources, vehicleState.source);
  const storage = getVehicleComponent(vehicleStorages, vehicleState.storage);
  const motor = getVehicleComponent(vehicleMotors, vehicleState.motor);
  const groups = [
    { id: "source", label: "1. Source d'energie", placeholder: "Choisir une source...", options: vehicleSources },
    { id: "storage", label: "2. Stockage embarque", placeholder: "Choisir un stockage...", options: vehicleStorages },
    { id: "motor", label: "3. Motorisation", placeholder: "Choisir une motorisation...", options: vehicleMotors },
    { id: "transmission", label: "4. Transmission", placeholder: "Choisir une transmission...", options: vehicleTransmissions },
  ];

  builder.innerHTML = "";

  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "vehicle-choice-group";
    const selectedOption = getVehicleComponent(group.options, vehicleState[group.id]);
    const selectDisabled = (group.id === "storage" && !source)
      || (group.id === "motor" && !storage)
      || (group.id === "transmission" && !motor);
    const selectedMarkup = selectedOption
      ? `
        <strong>${selectedOption.label}</strong>
        <span>${selectedOption.description}</span>
        <small>${getVehicleOptionMeta(group.id, selectedOption)}</small>
      `
      : `
        <strong>Etape vide</strong>
        <span>Choisis une option pour afficher ses caracteristiques.</span>
      `;

    section.innerHTML = `
      <label class="vehicle-select-control">
        <span>${group.label}</span>
        <select data-vehicle-select="${group.id}" ${selectDisabled ? "disabled" : ""}>
          <option value="">${group.placeholder}</option>
          ${group.options
            .map((option) => {
              const disabled = (group.id === "storage" && (!source || option.input !== source.output))
                || (group.id === "motor" && (!storage || option.input !== storage.output));
              return `<option value="${option.id}" ${disabled ? "disabled" : ""}>${getVehicleSelectLabel(group.id, option)}</option>`;
            })
            .join("")}
        </select>
      </label>
      <article class="vehicle-selected-card ${selectedOption ? "" : "empty"}">
        ${selectedMarkup}
      </article>
    `;
    const select = section.querySelector("select");
    select.value = vehicleState[group.id] || "";
    select.addEventListener("change", (event) => {
      vehicleState[group.id] = event.target.value;
      if (group.id === "source") {
        vehicleState.storage = "";
        vehicleState.motor = "";
        vehicleState.transmission = "";
      } else if (group.id === "storage") {
        vehicleState.motor = "";
        vehicleState.transmission = "";
      } else if (group.id === "motor") {
        vehicleState.transmission = "";
      }
      vehicleState.tested = false;
      renderVehicle();
    });
    builder.append(section);
  });
}

function getVehicleMissionSelectLabel(mission) {
  const labels = {
    efficiency: "Rendement max - repere >65%",
    "clean-city": "Ville sobre - CO2 <60 g/km + autonomie",
    "long-trip": "Long trajet - autonomie >500 km",
    heritage: "Garage 1905 - technologie historique",
    budget: "Budget serre - cout bas + autonomie",
    power: "Puissance maximale - >90 kW utiles",
    speed: "Vitesse maximale - pointe >145 km/h",
  };

  return labels[mission.id] || mission.label;
}

function getVehicleSelectLabel(groupId, option) {
  if (groupId === "source") {
    return `${option.label} - ${option.output}, ${option.carbon} gCO2/kWh, ${Math.round(option.efficiency * 100)}%`;
  }
  if (groupId === "storage") {
    return `${option.label} - ${Math.round(option.efficiency * 100)}%, ${option.range} km, ${option.mass} kg`;
  }
  if (groupId === "motor") {
    return `${option.label} - ${Math.round(option.efficiency * 100)}%, ${option.power} kW, ${option.mass} kg`;
  }
  return `${option.label} - ${Math.round(option.efficiency * 100)}%, ${option.mass} kg, cout ${option.cost}`;
}

function getVehicleOptionMeta(groupId, option) {
  if (groupId === "source") {
    return `sortie ${option.output} - ${option.carbon} gCO2/kWh`;
  }
  if (groupId === "storage") {
    return `${Math.round(option.efficiency * 100)}% - ${option.range} km base`;
  }
  if (groupId === "motor") {
    return `${Math.round(option.efficiency * 100)}% - ${option.power} kW`;
  }
  return `${Math.round(option.efficiency * 100)}% - masse ${option.mass} kg`;
}

function renderVehicleChain(stats) {
  const chain = document.querySelector("#vehicle-chain");
  const steps = [
    { label: stats.selection.source.label, type: "Source", efficiency: stats.selection.source.efficiency },
    { label: stats.selection.storage.label, type: "Stockage", efficiency: stats.selection.storage.efficiency },
    { label: stats.selection.motor.label, type: "Moteur", efficiency: stats.selection.motor.efficiency },
    { label: stats.selection.transmission.label, type: "Transmission", efficiency: stats.selection.transmission.efficiency },
  ];
  let energy = 100;

  chain.innerHTML = "";

  steps.forEach((step) => {
    const before = energy;
    energy *= step.efficiency;
    const lost = before - energy;
    const row = document.createElement("div");
    row.className = "vehicle-step";
    row.innerHTML = `
      <div>
        <span>${step.type}</span>
        <strong>${step.label}</strong>
      </div>
      <div class="vehicle-step-track">
        <i class="vehicle-useful" style="width:${Math.max(2, energy)}%"></i>
        <i class="vehicle-loss" style="width:${Math.max(2, lost)}%"></i>
        <b class="vehicle-bead"></b>
      </div>
      <small>${Math.round(energy)} utiles · -${Math.round(lost)} pertes</small>
    `;
    chain.append(row);
  });
}

function renderBadges() {
  const rack = document.querySelector("#badge-list");
  const summary = document.querySelector("#badge-summary");
  const filter = document.querySelector("#badge-filter");
  const unlockedBadgeIds = new Set(badgeState.unlockedBadges);
  const activeBadgeIds = new Set(badgeState.activeBadges);
  let badges = badgeDefinitions.map((badge) => ({
    ...badge,
    earned: unlockedBadgeIds.has(badge.id),
    active: activeBadgeIds.has(badge.id),
  }));

  if (!rack || !summary || !filter) {
    return;
  }

  summary.textContent = `${unlockedBadgeIds.size} / ${badgeDefinitions.length} obtenus`;
  filter.value = badgeState.filter;

  if (badgeState.filter === "earned") {
    badges = badges.filter((badge) => badge.earned);
  } else if (badgeState.filter === "locked") {
    badges = badges.filter((badge) => !badge.earned);
  }

  if (badges.length === 0) {
    const message = badgeState.filter === "earned"
      ? "Aucun badge pour l'instant. Lance un mini-jeu et observe ce qui change."
      : "Tous les badges sont deja observes.";
    rack.innerHTML = `<p class="badge-empty">${message}</p>`;
    return;
  }

  rack.innerHTML = badges
    .map((badge) => `
      <article class="badge-card ${badge.tone} ${badge.earned ? "earned" : "locked"} ${badge.active ? "active" : ""}">
        <span class="badge-symbol" aria-hidden="true">${badge.symbol}</span>
        <div>
          <span class="badge-mission">${badge.mission}</span>
          <strong>${badge.label}</strong>
          <small>${getBadgeStatus(badge)}</small>
          <p>${badge.earned ? badge.description : badge.hint}</p>
        </div>
      </article>
    `)
    .join("");
}

function getBadgeStatus(badge) {
  if (badge.active) {
    return "Observe maintenant";
  }
  if (badge.earned) {
    return "Deja observe";
  }
  return "A explorer";
}

function unlockBadges(ids) {
  const nextIds = ids.filter((id) => badgeDefinitions.some((badge) => badge.id === id));

  if (nextIds.length === 0) {
    return;
  }

  const unlocked = new Set(badgeState.unlockedBadges);
  const newIds = nextIds.filter((id) => !unlocked.has(id));
  const before = unlocked.size;

  nextIds.forEach((id) => unlocked.add(id));
  badgeState.activeBadges = nextIds;

  if (unlocked.size !== before) {
    badgeState.unlockedBadges = [...unlocked];
    badgeState.newBadgeCount += newIds.length;
    renderBadgeNotification();
    saveUnlockedBadges();
  }

  renderBadges();
}

function renderVehicleCard(stats, name) {
  const card = document.querySelector("#vehicle-card");
  const mission = vehicleMissions.find((item) => item.id === vehicleState.mission);
  const strength = getVehicleStrength(stats);
  const weakness = getVehicleWeakness(stats);

  card.innerHTML = `
    <div>
      <p class="eyebrow">Carte technique</p>
      <h2>${escapeHtml(name)}</h2>
      <span class="vehicle-medal">${stats.medal}</span>
    </div>
    <dl>
      <div><dt>Essai</dt><dd>${mission.label}</dd></div>
      <div><dt>Chaine</dt><dd>${stats.selection.source.label} -> ${stats.selection.storage.label} -> ${stats.selection.motor.label}</dd></div>
      <div><dt>Masse</dt><dd>${stats.totalMass} kg au total, dont ${stats.mass} kg de chaine energetique</dd></div>
      <div><dt>Vitesse max</dt><dd>${stats.speed} km/h avec ${stats.power} kW aux roues</dd></div>
      <div><dt>Point fort</dt><dd>${strength}</dd></div>
      <div><dt>Point faible</dt><dd>${weakness}</dd></div>
    </dl>
  `;
}

function renderVehicleGarage() {
  const garage = document.querySelector("#garage-list");

  if (vehicleState.garage.length === 0) {
    garage.innerHTML = `<p>Le garage est vide. Termine un essai puis ajoute ta voiture.</p>`;
    return;
  }

  garage.innerHTML = vehicleState.garage
    .map((item) => `
      <article class="garage-item">
        <span>${item.medal}</span>
        <strong>${escapeHtml(item.name)}</strong>
        <small>${item.efficiency}% rendement · ${item.range} km · ${item.speed || "?"} km/h</small>
      </article>
    `)
    .join("");
}

function saveVehicleBuild() {
  const stats = calculateVehicleStats();

  if (!stats) {
    return;
  }

  const saved = {
    name: getVehicleName(),
    medal: stats.medal,
    efficiency: Math.round(stats.efficiency * 100),
    range: stats.range,
    carbon: stats.carbon,
    speed: stats.speed,
  };

  vehicleState.garage = [
    saved,
    ...vehicleState.garage.filter((item) => item.name !== saved.name),
  ].slice(0, 6);
  saveVehicleGarage();
  renderVehicleGarage();
}

function loadVehicleGarage() {
  try {
    return JSON.parse(localStorage.getItem("wattlab-vehicle-garage")) || [];
  } catch (error) {
    return [];
  }
}

function saveVehicleGarage() {
  try {
    localStorage.setItem("wattlab-vehicle-garage", JSON.stringify(vehicleState.garage));
  } catch (error) {
    // Le garage reste utilisable pour la session meme si le stockage local est bloque.
  }
}

function loadUnlockedBadges() {
  try {
    const knownIds = new Set(badgeDefinitions.map((badge) => badge.id));
    const sessionBadges = JSON.parse(sessionStorage.getItem("wattlab-session-badges")) || [];
    const oldFutureBadgeId = `future-${String.fromCharCode(112, 114, 111, 116, 111, 116, 121, 112, 101)}`;
    const legacyBadgeIds = {
      [oldFutureBadgeId]: "future-tech",
    };

    return [...new Set(sessionBadges)]
      .map((id) => legacyBadgeIds[id] || id)
      .filter((id) => knownIds.has(id));
  } catch (error) {
    return [];
  }
}

function saveUnlockedBadges() {
  try {
    sessionStorage.setItem("wattlab-session-badges", JSON.stringify(badgeState.unlockedBadges));
  } catch (error) {
    // Les badges restent visibles en memoire meme si le stockage de session est bloque.
  }
}

function getVehicleName() {
  return document.querySelector("#vehicle-name").value.trim() || "Voiture sans nom";
}

function getVehicleChallengeText(stats) {
  const mission = vehicleMissions.find((item) => item.id === vehicleState.mission);

  if (stats.score >= 85) {
    return `Excellent essai : ${mission.hint}`;
  }
  if (stats.score >= 70) {
    return `Tres solide. Un ajustement peut encore rapprocher du repere : ${mission.hint}`;
  }
  if (stats.score >= 52) {
    return `Base correcte. Observe la chaine et cherche le meilleur compromis : ${mission.hint}`;
  }
  return `Essai instructif. Modifie un choix et compare : ${mission.hint}`;
}

function getVehicleArchetype(stats) {
  const selection = stats.selection;

  if (selection.motor.tags.includes("steam")) {
    return "Machine historique";
  }
  if (selection.motor.tags.includes("electric") && selection.source.tags.includes("lowCarbon")) {
    return "Electrique sobre";
  }
  if (selection.motor.tags.includes("hydrogen")) {
    return "Voiture hydrogene";
  }
  if (selection.motor.tags.includes("sport")) {
    return "Configuration sportive";
  }
  if (selection.motor.tags.includes("weird")) {
    return "Configuration atypique";
  }
  return "Voiture polyvalente";
}

function getVehicleSummary(stats) {
  if (!vehicleState.tested) {
    return "Lance le banc d'essai pour figer les indicateurs.";
  }
  return `${Math.round(stats.efficiency * 100)}% de rendement final, ${stats.power} kW utiles, ${stats.speed} km/h max.`;
}

function getVehicleStrength(stats) {
  if (stats.efficiency >= 0.65) {
    return "Peu de pertes entre la source et les roues.";
  }
  if (stats.range >= 500) {
    return "Autonomie confortable pour les longs trajets.";
  }
  if (stats.carbon <= 60) {
    return "Emissions faibles sur le cycle choisi.";
  }
  if (stats.power >= 80) {
    return "Bonne puissance disponible aux roues.";
  }
  if (stats.speed >= 170) {
    return "Vitesse maximale elevee pour cette masse.";
  }
  return "Architecture interessante pour comparer les compromis.";
}

function getVehicleWeakness(stats) {
  if (stats.efficiency < 0.25) {
    return "Une grande part de l'energie part en chaleur ou en conversions.";
  }
  if (stats.carbon > 180) {
    return "Les emissions restent elevees.";
  }
  if (stats.mass > 240) {
    return "La chaine embarquee ajoute beaucoup de masse.";
  }
  if (stats.cost > 300) {
    return "Le systeme devient couteux et complexe.";
  }
  return "La voiture est coherente, mais aucun choix n'est gratuit.";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

resetButton.addEventListener("click", () => {
  state.quantities = {};
  update();
});

unlimitedButton.addEventListener("click", () => {
  state.unlimited = !state.unlimited;
  update();
});

update();
initEfficiencyGame();
initStorageGame();
initMixGame();
initVehicleGame();
initBadgePage();
initMissionNavigation();
