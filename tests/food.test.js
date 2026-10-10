import test from "node:test";
import assert from "node:assert/strict";
import { RESTAURANT_MENU, RESTAURANT_MENU_BY_ID } from "../shared/food.js";
import { MODEL_ITEM_BY_ID } from "../shared/models.js";

test("restaurant meals have unique priced healing items and bundled model previews", () => {
  assert.equal(RESTAURANT_MENU.length, 5);
  assert.equal(RESTAURANT_MENU_BY_ID.size, RESTAURANT_MENU.length);
  assert.equal(new Set(RESTAURANT_MENU.map(({ id }) => id)).size, RESTAURANT_MENU.length);
  for (const meal of RESTAURANT_MENU) {
    assert.ok(meal.price > 0);
    assert.ok(meal.healing > 0);
    assert.ok(meal.name && meal.description && meal.icon);
    assert.ok(MODEL_ITEM_BY_ID.has(`dining_${meal.assetKey.split("/").at(-1).replace(/\.glb$/, "")}`));
  }
});
