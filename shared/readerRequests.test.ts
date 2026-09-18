import { describe, expect, it } from "vitest";
import {
  READER_TASK_KEYS,
  REQUEST_GEOGRAPHY_KEYS,
  REQUEST_PRIVACY_NOTICE,
  REQUEST_TOPIC_KEYS,
  REQUEST_USE_BASIS,
  publicRequestShape,
  publishedAnswerPath,
  readerTaskLabel,
  requestGeographyLabel,
  requestTopicLabel,
  tallyRequests,
  triageQueue,
  type ReaderRequest,
} from "./readerRequests";

function request(overrides: Partial<ReaderRequest> = {}): ReaderRequest {
  return {
    id: 1,
    topic: "rents",
    geography: "nsw",
    readerTask: "holding",
    status: "new",
    answerUrl: null,
    createdAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("published answer paths", () => {
  it("accepts The Desk's own published routes", () => {
    for (const path of [
      "/story/1234",
      "/editions/42",
      "/guides/housing-supply",
      "/analysis/rent-pressure",
      "/markets/sydney",
      "/projects",
    ])
      expect(publishedAnswerPath(path)).toBe(path);
    expect(publishedAnswerPath("  /story/1234  ")).toBe("/story/1234");
  });

  it("refuses anything that could put an outbound or crafted link on the site", () => {
    for (const bad of [
      "https://evil.example/story/1",
      "//evil.example",
      "/story/1234?next=https://evil.example",
      "/story/1234#x",
      "/story/../admin",
      "/admin",
      "/settings",
      "/story/0",
      "/story/abc",
      "/guides/Housing-Supply",
      "javascript:alert(1)",
      "story/1234",
      "/story\\1234",
      "",
      "   ",
      `/story/${"1".repeat(600)}`,
    ])
      expect(publishedAnswerPath(bad)).toBeNull();
    expect(publishedAnswerPath(null)).toBeNull();
    expect(publishedAnswerPath(undefined)).toBeNull();
    expect(publishedAnswerPath(12 as never)).toBeNull();
  });
});

describe("categorisation", () => {
  it("resolves labels only for keys it publishes", () => {
    expect(requestTopicLabel("rents")).toBe("Rents and renting");
    expect(requestGeographyLabel("nsw")).toBe("New South Wales");
    expect(readerTaskLabel("holding")).toBe("Holding");
    for (const unknown of ["", "made-up", null, undefined]) {
      expect(requestTopicLabel(unknown)).toBeNull();
      expect(requestGeographyLabel(unknown)).toBeNull();
      expect(readerTaskLabel(unknown)).toBeNull();
    }
  });

  it("uses the same three reader positions as the voice rules", () => {
    expect(READER_TASK_KEYS).toEqual(["buying", "holding", "watching"]);
    expect(REQUEST_TOPIC_KEYS.length).toBeGreaterThan(4);
    expect(REQUEST_GEOGRAPHY_KEYS).toContain("national");
  });
});

describe("triage", () => {
  const requests = [
    request({ id: 1, topic: "rents", createdAt: "2026-09-10T00:00:00.000Z" }),
    request({ id: 2, topic: "supply", createdAt: "2026-09-01T00:00:00.000Z" }),
    request({ id: 3, topic: "rents", status: "answered", answerUrl: "/story/7" }),
    request({ id: 4, topic: "not-a-topic", geography: null, readerTask: null }),
  ];

  it("counts every request, including ones with an unusable category", () => {
    const topics = tallyRequests(requests, "topic");
    expect(topics).toEqual([
      { key: "supply", label: "Housing supply and construction", count: 1 },
      { key: "rents", label: "Rents and renting", count: 2 },
      { key: "uncategorised", label: "Not categorised", count: 1 },
    ]);
    // The totals must reconcile, or triage is quietly losing requests.
    for (const dimension of ["topic", "geography", "readerTask"] as const)
      expect(tallyRequests(requests, dimension).reduce((sum, tally) => sum + tally.count, 0)).toBe(
        requests.length
      );
    expect(tallyRequests([], "topic")).toEqual([]);
  });

  it("queues untriaged requests oldest first so nothing sinks", () => {
    // Same-timestamp requests keep their arrival order rather than being reshuffled.
    expect(triageQueue(requests).map((item) => item.id)).toEqual([2, 1, 4]);
    expect(triageQueue(requests).every((item) => item.status === "new")).toBe(true);
  });
});

describe("what may leave the private inbox", () => {
  it("carries categories and an answer link, never the reader or their words", () => {
    const shape = publicRequestShape(request({ status: "answered", answerUrl: "/story/7" }));
    expect(shape).toEqual({
      topic: "Rents and renting",
      geography: "New South Wales",
      readerTask: "Holding",
      answered: true,
      answerUrl: "/story/7",
    });
    expect(Object.keys(shape)).not.toContain("message");
    expect(Object.keys(shape)).not.toContain("contactEmail");
    expect(Object.keys(shape)).not.toContain("pageUrl");
    expect(Object.keys(shape)).not.toContain("userAgent");
    expect(Object.keys(shape)).not.toContain("createdAt");
  });

  it("never exposes an answer link on a request that was not answered", () => {
    for (const status of ["new", "reviewed", "declined"])
      expect(publicRequestShape(request({ status, answerUrl: "/story/7" }))).toMatchObject({
        answered: false,
        answerUrl: null,
      });
    // Nor one that was answered with something that is not a Desk page.
    expect(
      publicRequestShape(request({ status: "answered", answerUrl: "https://evil.example" }))
    ).toMatchObject({ answered: false, answerUrl: null });
  });
});

describe("what readers are told", () => {
  it("says the submission is private and asks for no personal details", () => {
    expect(REQUEST_PRIVACY_NOTICE).toContain("not to a public page");
    expect(REQUEST_PRIVACY_NOTICE).toContain("Nothing you write here is published");
    expect(REQUEST_PRIVACY_NOTICE).toMatch(/personal details/);
    expect(REQUEST_PRIVACY_NOTICE).toMatch(/allegation/);
    expect(REQUEST_PRIVACY_NOTICE).toContain("optional");
  });

  it("discloses the basis for use and keeps Ask on its own footing", () => {
    expect(REQUEST_USE_BASIS).toContain("never from your words");
    expect(REQUEST_USE_BASIS).toContain("never attributed to you");
    expect(REQUEST_USE_BASIS).toContain("Ask");
    expect(REQUEST_USE_BASIS).toContain("not treated as coverage requests");
  });
});
