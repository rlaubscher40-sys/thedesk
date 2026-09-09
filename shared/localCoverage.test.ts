import { expect, it } from "vitest";
import type { LocalDataset } from "./localData";
import { localCoverageState, localObservationCoverage } from "./localCoverage";

const data = {
  areas: [
    {
      observations: [
        { status: "published", value: 700 },
        { status: "suppressed", value: null },
        { status: "insufficient-sample", value: null },
        { status: "published", value: null },
      ],
    },
  ],
} as LocalDataset;
it("does not confuse a missing dataset, denied access and failed collection", () => {
  expect(localCoverageState(undefined, null)).toBe("Not collected");
  expect(localCoverageState(data, "Publisher HTTP 403")).toBe("Access blocked");
  expect(localCoverageState(data, "Schema changed")).toBe("Collection failed");
  expect(localCoverageState(data, null)).toBe("Stored release available");
});
it("labels only explicit source suppression as not published", () => {
  expect(localObservationCoverage(data)).toEqual({
    published: 1,
    notPublished: 1,
    insufficientSample: 1,
  });
  expect(localObservationCoverage(undefined)).toEqual({
    published: 0,
    notPublished: 0,
    insufficientSample: 0,
  });
});
