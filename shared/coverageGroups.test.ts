import { expect, it } from "vitest";
import { coverageGroups, diverseCoverage } from "./coverageGroups";
const one = {
  id: 1,
  title: "Sydney housing delivery announced",
  channel: "PROPERTY",
  priority: 85,
  threadParentId: null,
};
it("groups saved relations with the strongest lead while retaining every report", () => {
  const two = { ...one, id: 2, priority: 92, threadParentId: 1 };
  const three = { ...one, id: 3, threadParentId: 2 };
  expect(coverageGroups([one, two, three])).toEqual([{ lead: two, related: [one, three] }]);
  expect(one.threadParentId).toBeNull();
});
it("does not group a similar title without a saved relationship, or cross lanes", () => {
  expect(coverageGroups([one, { ...one, id: 2 }])).toHaveLength(2);
  expect(
    coverageGroups([one, { ...one, id: 2, channel: "GLOBAL", threadParentId: 1 }])
  ).toHaveLength(2);
});
it("handles missing parents and cycles without losing rows", () => {
  const cyclic = [
    { ...one, threadParentId: 2 },
    { ...one, id: 2, threadParentId: 1 },
  ];
  expect(coverageGroups(cyclic)).toHaveLength(2);
  expect(coverageGroups([{ ...one, threadParentId: 999 }])[0]?.lead.id).toBe(1);
});
it("groups siblings linked to an earlier day and preserves additional editor pins", () => {
  const two = { ...one, id: 2, threadParentId: 999 };
  expect(coverageGroups([{ ...one, threadParentId: 999 }, two])).toHaveLength(1);
  expect(
    coverageGroups([
      { ...one, priority: 100 },
      { ...two, priority: 101, threadParentId: 1 },
    ])
  ).toHaveLength(2);
});
it("keeps a short substantive update in the source summary eligible for socials", () => {
  const two = { ...one, id: 2, threadParentId: 1, summary: "The regulator withdrew its notice." };
  expect(diverseCoverage([one, two])).toHaveLength(2);
});
it("diversifies a social batch but preserves changed figures and regional updates", () => {
  const two = { ...one, id: 2, threadParentId: 1 };
  const update = { ...two, id: 3, title: "Melbourne housing delivery announced" };
  expect(diverseCoverage([one, two, update]).map((s) => s.id)).toEqual([1, 3]);
});
