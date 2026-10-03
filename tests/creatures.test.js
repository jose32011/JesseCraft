import test from "node:test";
import assert from "node:assert/strict";
import { CREATURE_HABITATS, getCreatureSpecies } from "../shared/creatures.js";

test("each world habitat has 256 unique generated creature species", () => {
  assert.deepEqual(
    CREATURE_HABITATS.map(({ id }) => id),
    ["village", "coast", "ocean", "forest", "highlands"],
  );
  for (const habitat of CREATURE_HABITATS) {
    assert.equal(habitat.species.length, 256);
    assert.equal(new Set(habitat.species.map(({ id }) => id)).size, 256);
    assert.equal(new Set(habitat.species.map(({ name }) => name)).size, 256);
    assert.ok(habitat.species.every((species) => species.habitat === habitat.id));
    assert.equal(getCreatureSpecies(habitat.id, 0).id, habitat.species[0].id);
    assert.equal(getCreatureSpecies(habitat.id, 256), null);
  }
});
