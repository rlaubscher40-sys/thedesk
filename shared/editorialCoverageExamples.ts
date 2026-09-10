import type { CoverageEntry } from "./editorialCoverage";
/** Source pages checked on 10 September. These are provisional operational
 * examples, not a representative sample or a human-approved recall benchmark. */
export function coverageExamples(day: string): CoverageEntry[] {
  if (day !== "2026-09-10") return [];
  return [
    {
      id: "58f2feea-f865-4771-bad6-9f2287ab7001",
      title: "RBA discusses inflation risks and the interest-rate outlook",
      urls: ["https://www.rba.gov.au/speeches/2026/sp-dg-2026-09-08.html"],
      rationale:
        "The September 8 interview explains the RBA's policy risks, relevant to borrowers and the Australian economy.",
      reviewed: false,
    },
    {
      id: "58f2feea-f865-4771-bad6-9f2287ab7002",
      title: "ABS releases quarterly dwelling-value estimates",
      urls: ["https://www.abs.gov.au/media-centre/media-releases/value-dwellings-falls-03"],
      rationale:
        "The September 8 release separates changes in total dwelling stock value from mean dwelling prices, an important distinction for housing coverage.",
      reviewed: false,
    },
    {
      id: "58f2feea-f865-4771-bad6-9f2287ab7003",
      title: "NSW announces additional social homes in Western Sydney",
      urls: [
        "https://www.nsw.gov.au/ministerial-releases/226-new-social-homes-for-western-sydney-families",
      ],
      rationale:
        "The September 10 release describes additional social housing supply in Western Sydney. Government claims need clear attribution.",
      reviewed: false,
    },
  ];
}
