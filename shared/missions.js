export const MISSION_BOARD_SIZE = 3;
export const MISSION_TIME_LIMIT_MS = 10 * 60 * 1000;

export const MISSION_TEMPLATES = [
  { id: "defeat-small", type: "defeat", target: 3, reward: 60, penalty: 40, label: "Defeat 3 creatures" },
  { id: "defeat-large", type: "defeat", target: 8, reward: 180, penalty: 120, label: "Defeat 8 creatures" },
  { id: "sell-fish-small", type: "sell_fish", target: 3, reward: 50, penalty: 35, label: "Sell 3 fish" },
  { id: "sell-fish-large", type: "sell_fish", target: 10, reward: 160, penalty: 110, label: "Sell 10 fish" },
  { id: "mine-small", type: "mine", target: 10, reward: 40, penalty: 25, xp: 30, label: "Mine 10 blocks" },
  { id: "mine-large", type: "mine", target: 40, reward: 150, penalty: 100, xp: 120, label: "Mine 40 blocks" },
  { id: "cook-small", type: "cook", target: 3, reward: 45, penalty: 30, xp: 30, label: "Cook 3 meals" },
  { id: "cook-large", type: "cook", target: 10, reward: 140, penalty: 90, xp: 110, label: "Cook 10 meals" },
  { id: "repair-small", type: "repair", target: 2, reward: 55, penalty: 35, xp: 35, label: "Repair 2 vehicles" },
  { id: "repair-large", type: "repair", target: 5, reward: 150, penalty: 100, xp: 100, label: "Repair 5 vehicles" },
  { id: "catch-fish-small", type: "catch", target: 3, reward: 45, penalty: 30, xp: 25, label: "Catch 3 fish" },
  { id: "catch-fish-large", type: "catch", target: 10, reward: 140, penalty: 95, xp: 90, label: "Catch 10 fish" },
  { id: "smelt-small", type: "smelt", target: 2, reward: 50, penalty: 35, xp: 30, label: "Smelt 2 ingots" },
  { id: "smelt-large", type: "smelt", target: 6, reward: 150, penalty: 100, xp: 100, label: "Smelt 6 ingots" },
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
    xp: template.xp ?? 0,
  };
}

export function createEmptyMissions() {
  return { offers: [], active: null, day: null };
}

// The UTC calendar day used for the daily mission board reset.
export function missionDayKey(now) {
  return new Date(now).toISOString().slice(0, 10);
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

// Gives the board new offers once per UTC day. An active mission is kept across the reset.
export function refreshDailyMissions(missions, now, random = Math.random) {
  const day = missionDayKey(now);
  if (missions.day === day) return missions;
  return { ...refreshMissionOffers(missions, random), day };
}

// Adds one specific template to the board. Returns { missions, error }.
export function addMissionToBoard(missions, templateId, index) {
  const template = MISSION_TEMPLATE_BY_ID.get(templateId);
  if (!template) return { missions, error: "I don't have that job right now." };
  if (missions.offers.some((entry) => entry.templateId === templateId)) {
    return { missions, error: "That job is already on your mission board." };
  }
  if (missions.offers.length >= MISSION_BOARD_SIZE) return { missions, error: "Your mission board is full." };
  return { missions: { ...missions, offers: [...missions.offers, offerFromTemplate(template, index)] }, error: null };
}

// Accepts one offer. Returns { missions, error }.
export function acceptMission(missions, offerId, now) {
  if (missions.active) return { missions, error: "Finish or abandon your current mission first." };
  const offer = missions.offers.find((entry) => entry.offerId === offerId);
  if (!offer) return { missions, error: "That mission is no longer on the board." };
  return {
    missions: {
      ...missions,
      offers: missions.offers.filter((entry) => entry.offerId !== offerId),
      active: { ...offer, progress: 0, expiresAt: now + MISSION_TIME_LIMIT_MS },
    },
    error: null,
  };
}

// Adds progress to the active mission when the event type matches.
// Returns { missions, completed: reward coins or 0, xp: experience earned on completion }.
export function progressMission(missions, type, amount) {
  const active = missions.active;
  if (!active || active.type !== type || !(amount > 0)) return { missions, completed: 0, xp: 0 };
  const progress = Math.min(active.target, active.progress + Math.floor(amount));
  if (progress < active.target) {
    return { missions: { ...missions, active: { ...active, progress } }, completed: 0, xp: 0 };
  }
  return { missions: { ...missions, active: null }, completed: active.reward, xp: active.xp ?? 0 };
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
  const day = typeof input.day === "string" ? input.day : null;
  return { offers, active, day };
}
