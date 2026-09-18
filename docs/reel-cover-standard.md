# Reel covers

The cover is a dedicated still exported by `renderReelCover`, which is already
connected to the publisher's `cover_url`. It does not change the opening film,
narration, captions, schedule or documentary approval records.

## Treatments

- Portrait: Harry's actual, credited archive portrait, enlarged to identify him
  in the grid. His cover hook is separate from his narrated opening.
- Photograph: a clear picture of the subject with a restrained lower gradient,
  one headline or contextualised figure, and a compact category label.
- Split: an image above an ivory panel for architecture, migration and selected
  rent comparisons. Keep the shared typography without repeating every layout.

Production derives figures and directional wording from the validated candidate.
Migration retains positive, negative and zero outcomes; net interstate movement
is not described as total population growth. Housing retains the approximate
new gap, rather than asserting a precise accumulated shortage. Approval counts
remain permission to build. The borrowing cover concerns the existing repayment
example, not a newly recommended rate or product.

## Rendering and review

Full covers are 1080 × 1920 JPEGs. Essential copy is inside x=84–924 and
y=420–1500, retained by centred square and 3:4 crops. Supporting detail starts
below the square crop so it cannot be half-visible. The 3:4 profile crop retains
the period; full export and caption retain source and image attribution.
Actual text bounds are checked by the existing editorial renderer. Oversized
headlines shrink only to a readable floor, then fail for review. Every cover's
photo is checked against its recorded rights metadata and SHA-256 bytes.

To review one to twelve saved verified candidates, use:

```sh
pnpm preview:covers /absolute/candidates.json /absolute/new-output-directory
```

Input is a `ProductionReelCandidate[]`, captured from existing evidence adapters
or authored documentary candidates. The command validates it, creates a fresh
directory, renders full covers, a three-column 3:4 grid, square-crop grid and
JSON manifest with exact cover hashes and input candidates. It never publishes,
approves or creates replacement evidence. Archived inputs are a review snapshot,
not a fresh eligibility decision.

## 15 September 2026 preview

The first six-cover set uses Harry, national housing, Grollo, interstate
migration, Sydney approvals and borrowing. Housing uses the checked NHSAC
snapshot. The other data candidates were obtained from the live ABS/RBA
adapters; migration and approvals reproduced the screenshot's 16,528 and 35,724.
No test fixtures were used as factual preview data. Full-size outputs, phone
grids and the candidate/credit manifest accompany the review package.

The design awaits user review. This branch does not change existing Instagram
posts or grant documentary publication approval. Future subjects require their
own truthful hook and correct photo selection; do not reuse Harry's portrait for
a different person. Evaluate the rendered grid visually before accepting a new
treatment. A passed geometry test is not an engagement result.

## 18 September 2026 implementation

Supply-checklist covers use the existing hash-checked D Goug/Pexels building photograph and ivory split layout. The headline poses the completion question, and the full-size cover retains the approval count, reference year and rights credit. The photograph illustrates construction; it is not a photograph of the measured city or proof of the stage of a particular development. A twelve-cover review used candidates retrieved through the live ABS/RBA/NHSAC adapters, with full, 3:4 and square renders. Existing published covers and documentary exports are not replaced.

The supply opening now asks the reader to check three things, leading into the existing stage/place/timing takeaway. Narration still determines scene timing; fixed teaser cuts and documentary timing are unchanged.

`reelVariety.ts` identifies narrative angles independently of city and release. Automatic data selection holds the same angle for seven days using permanent confirmed publication history. All city approval checklists and the two-city approvals comparison share one angle. Other established rent, financing, housing-balance and movement angles remain distinct. If only a repeated angle is available, no post is forced. The existing one-per-day limit, uncertain-publication locks, two documentary slots and documentary review/export gates still apply. This is a future production rule, not evidence of engagement or a change visible in old posts.
