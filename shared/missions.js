export const MISSION_BOARD_SIZE = 3;
export const MISSION_TIME_LIMIT_MS = 10 * 60 * 1000;

export const MISSION_TEMPLATES = [
  { id: "defeat-small", type: "defeat", target: 3, reward: 60, penalty: 40, label: "Defeat 3 creatures" },
  { id: "defeat-large", type: "defeat", target: 8, reward: 180, penalty: 120, label: "Defeat 8 creatures" },
  { id: "sell-fish-small", type: "sell_fish", target: 3, reward: 50, penalty: 35, label: "Sell 3 fish" },
  { id: "sell-fish-large", type: "sell_fish", target: 10, reward: 160, penalty: 110, label: "Sell 10 fish" },
];

export const MISSION_TEMPLATE_BY_ID = new Map(MISSION_TEMPLATES.map((template) => [template.id, template]));

function offerFromTemplate(template, index) {
  return {
    offerId: `${template.id}-${index}`,
    templateId: template.id,
    type: template.type,
    label: template.label,
    target: template.target,
    reward: template.reward,
    penalty: template.penalty,
  };
}

export function createEmptyMissions() {
  return { offers: [], active: null };
}

// Fills the board with distinct random templates. `random` returns a number in [0, 1).
export function refreshMissionOffers(missions, random = Math.random) {
  const pool = [...MISSION_TEMPLATES];
  const offers = [];
  while (offers.length < MISSION_BOARD_SIZE && pool.length > 0) {
    const [template] = pool.splice(Math.floor(random() * pool.length), 1);
    offers.push(offerFromTemplate(template, offers.length));
  }
  return { ...missions, offers };
}

// Accepts one offer. Returns { missions, error }.
export function acceptMission(missions, offerId, now) {
  if (missions.active) return { missions, error: "Finish or abandon your current mission first." };
  const offer = missions.offers.find((entry) => entry.offerId === offerId);
  if (!offer) return { missions, error: "That mission is no longer on the board." };
  return {
    missions: {
      offers: missions.offers.filter((entry) => entry.offerId !== offerId),
      active: { ...offer, progress: 0, expiresAt: now + MISSION_TIME_LIMIT_MS },
    },
    error: null,
  };
}

// Adds progress to the active mission when the event type matches.
// Returns { missions, completed: reward coins or 0 }.
export function progressMission(missions, type, amount) {
  const active = missions.active;
  if (!active || active.type !== type || !(amount > 0)) return { missions, completed: 0 };
  const progress = Math.min(active.target, active.progress + Math.floor(amount));
  if (progress < active.target) {
    return { missions: { ...missions, active: { ...active, progress } }, completed: 0 };
  }
  return { missions: { ...missions, active: null }, completed: active.reward };
}

// Ends the active mission as failed (deadline passed or abandoned).
// Returns { missions, penalty: coins to deduct }.
export function failMission(missions) {
  if (!missions.active) return { missions, penalty: 0 };
  return { missions: { ...missions, active: null }, penalty: missions.active.penalty };
}

// Returns true when the active mission's deadline has passed.
export function isMissionExpired(missions, now) {
  return Boolean(missions.active) && now >= missions.active.expiresAt;
}

// Rebuilds saved mission state, dropping anything that no longer matches a template.
export function normalizeMissions(input) {
  if (!input || typeof input !== "object") return createEmptyMissions();
  const offers = Array.isArray(input.offers)
    ? input.offers.filter((offer) => offer && MISSION_TEMPLATE_BY_ID.has(offer.templateId) && typeof offer.offerId === "string")
    : [];
  const active = input.active && MISSION_TEMPLATE_BY_ID.has(input.active.templateId)
    && Number.isFinite(input.active.expiresAt) && Number.isFinite(input.active.progress)
    ? input.active
    : null;
  return { offers, active };
}
