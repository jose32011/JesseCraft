import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MISSION_BOARD_SIZE,
  MISSION_TIME_LIMIT_MS,
  acceptMission,
  createEmptyMissions,
  failMission,
  isMissionExpired,
  normalizeMissions,
  progressMission,
  refreshMissionOffers,
} from "../shared/missions.js";

test("refreshMissionOffers fills the board with distinct missions", () => {
  const missions = refreshMissionOffers(createEmptyMissions(), () => 0);
  assert.equal(missions.offers.length, MISSION_BOARD_SIZE);
  const ids = new Set(missions.offers.map((offer) => offer.templateId));
  assert.equal(ids.size, MISSION_BOARD_SIZE);
});

test("accepting a mission removes its offer and starts a timed mission", () => {
  const board = refreshMissionOffers(createEmptyMissions(), () => 0);
  const offerId = board.offers[0].offerId;
  const result = acceptMission(board, offerId, 1000);
  assert.equal(result.error, null);
  assert.equal(result.missions.offers.some((offer) => offer.offerId === offerId), false);
  assert.equal(result.missions.active.progress, 0);
  assert.equal(result.missions.active.expiresAt, 1000 + MISSION_TIME_LIMIT_MS);
});

test("only one mission can be active at a time", () => {
  const board = refreshMissionOffers(createEmptyMissions(), () => 0);
  const first = acceptMission(board, board.offers[0].offerId, 0);
  const second = acceptMission(first.missions, first.missions.offers[0].offerId, 0);
  assert.ok(second.error);
});

test("completing a mission pays its reward and clears it", () => {
  const board = refreshMissionOffers(createEmptyMissions(), () => 0);
  const defeat = board.offers.find((offer) => offer.type === "defeat");
  const accepted = acceptMission(board, defeat.offerId, 0).missions;
  const partial = progressMission(accepted, "defeat", defeat.target - 1);
  assert.equal(partial.completed, 0);
  assert.equal(partial.missions.active.progress, defeat.target - 1);
  const done = progressMission(partial.missions, "defeat", 1);
  assert.equal(done.completed, defeat.reward);
  assert.equal(done.missions.active, null);
});

test("progress from the wrong event type is ignored", () => {
  const board = refreshMissionOffers(createEmptyMissions(), () => 0);
  const defeat = board.offers.find((offer) => offer.type === "defeat");
  const accepted = acceptMission(board, defeat.offerId, 0).missions;
  const result = progressMission(accepted, "sell_fish", 100);
  assert.equal(result.completed, 0);
  assert.equal(result.missions.active.progress, 0);
});

test("an expired mission fails with its penalty", () => {
  const board = refreshMissionOffers(createEmptyMissions(), () => 0);
  const accepted = acceptMission(board, board.offers[0].offerId, 0).missions;
  assert.equal(isMissionExpired(accepted, MISSION_TIME_LIMIT_MS - 1), false);
  assert.equal(isMissionExpired(accepted, MISSION_TIME_LIMIT_MS), true);
  const failed = failMission(accepted);
  assert.equal(failed.penalty, accepted.active.penalty);
  assert.equal(failed.missions.active, null);
});

test("failing with no active mission costs nothing", () => {
  assert.deepEqual(failMission(createEmptyMissions()).penalty, 0);
});

test("normalizeMissions drops unknown templates and bad saved data", () => {
  assert.deepEqual(normalizeMissions(null), createEmptyMissions());
  const normalized = normalizeMissions({
    offers: [{ offerId: "x", templateId: "nope" }, { offerId: "y", templateId: "defeat-small" }],
    active: { templateId: "nope", expiresAt: 1, progress: 0 },
  });
  assert.equal(normalized.offers.length, 1);
  assert.equal(normalized.active, null);
});
