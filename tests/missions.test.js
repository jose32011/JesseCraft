import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MISSION_BOARD_SIZE,
  MISSION_TIME_LIMIT_MS,
  acceptMission,
  addMissionToBoard,
  createEmptyMissions,
  failMission,
  isMissionExpired,
  normalizeMissions,
  progressMission,
  refreshDailyMissions,
  refreshMissionOffers,
} from "../shared/missions.js";

const DAY_ONE = Date.UTC(2026, 9, 19, 9);
const DAY_TWO = Date.UTC(2026, 9, 20, 0, 5);

test("the mission board refreshes once per UTC day and keeps the active mission", () => {
  const first = refreshDailyMissions(createEmptyMissions(), DAY_ONE, () => 0);
  assert.equal(first.day, "2026-10-19");
  assert.equal(first.offers.length, MISSION_BOARD_SIZE);

  const sameDay = refreshDailyMissions(first, DAY_ONE + 60_000, () => 0.99);
  assert.equal(sameDay, first);

  const accepted = acceptMission(first, first.offers[0].offerId, DAY_ONE).missions;
  const nextDay = refreshDailyMissions(accepted, DAY_TWO, () => 0.99);
  assert.equal(nextDay.day, "2026-10-20");
  assert.notDeepEqual(nextDay.offers.map((offer) => offer.templateId), accepted.offers.map((offer) => offer.templateId));
  assert.deepEqual(nextDay.active, accepted.active);
});

test("catch and smelt jobs count their own events and pay XP", () => {
  const board = addMissionToBoard(createEmptyMissions(), "catch-fish-small", 1).missions;
  const catchJob = acceptMission(board, board.offers[0].offerId, 0).missions;
  const caught = progressMission(catchJob, "catch", 3);
  assert.equal(caught.completed, 45);
  assert.equal(caught.xp, 25);
  assert.equal(progressMission(catchJob, "smelt", 3).completed, 0);

  const smeltBoard = addMissionToBoard(createEmptyMissions(), "smelt-small", 1).missions;
  const smeltJob = acceptMission(smeltBoard, smeltBoard.offers[0].offerId, 0).missions;
  assert.equal(progressMission(smeltJob, "smelt", 2).completed, 50);
});

test("normalizeMissions keeps the board day", () => {
  assert.equal(normalizeMissions({ offers: [], active: null, day: "2026-10-19" }).day, "2026-10-19");
  assert.equal(normalizeMissions(null).day, null);
});

test("addMissionToBoard adds one specific mission and rejects duplicates and a full board", () => {
  const first = addMissionToBoard(createEmptyMissions(), "sell-fish-small", 1);
  assert.equal(first.error, null);
  assert.equal(first.missions.offers.length, 1);
  assert.equal(first.missions.offers[0].templateId, "sell-fish-small");

  const duplicate = addMissionToBoard(first.missions, "sell-fish-small", 2);
  assert.match(duplicate.error, /already/);
  assert.equal(duplicate.missions.offers.length, 1);

  const unknown = addMissionToBoard(first.missions, "nope", 3);
  assert.ok(unknown.error);

  let board = first.missions;
  board = addMissionToBoard(board, "defeat-small", 4).missions;
  board = addMissionToBoard(board, "defeat-large", 5).missions;
  assert.equal(board.offers.length, MISSION_BOARD_SIZE);
  const full = addMissionToBoard(board, "sell-fish-large", 6);
  assert.match(full.error, /full/);
});

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

test("job missions for mining, cooking and repairs pay coins and XP on completion", () => {
  for (const [templateId, type] of [["mine-small", "mine"], ["cook-small", "cook"], ["repair-small", "repair"]]) {
    const board = addMissionToBoard(createEmptyMissions(), templateId, 1).missions;
    const accepted = acceptMission(board, board.offers[0].offerId, 0).missions;
    assert.equal(accepted.active.type, type);
    const partial = progressMission(accepted, type, accepted.active.target - 1);
    assert.equal(partial.completed, 0);
    const done = progressMission(partial.missions, type, 1);
    assert.equal(done.missions.active, null);
    assert.ok(done.completed > 0);
    assert.ok(done.xp > 0);
  }
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
