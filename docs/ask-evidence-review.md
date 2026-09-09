# Ask evidence review

Live checks after #207/#209 found two failures: the model returned more than
eight citations and failed response validation; a later answer inferred
lengthening construction times from approvals and commentary without a
completion-duration series. It also ignored a request for three sources.

The answer prompt now receives at most eight relevant records, or a smaller
explicit limit requested as digits or words one through eight. Local facts keep
their separate period references. If those facts exceed the requested limit,
Ask declines instead of dropping part of a comparison. An explicitly named
metric is prioritised, then remaining reporting is ranked. Citations are numbered
consecutively after selection, with each number joined to its original source
metadata. Records omitted from this evidence set cannot be cited.

The JSON format and prompt carry the same source limit. Repeated references are
deduplicated before schema validation. Unknown references, excessive distinct
references and undeclared inline references remain failures; they are never
silently removed to make an answer pass.

AI-written answers then receive one separate model review against only their
cited records. The review checks every answer field for unsupported figures,
geography/date/category changes, causal explanations and overconfident
interpretation. In particular, approvals and cost commentary cannot prove
completion times, available housing or vacancy. Drafts that fail review are
withheld, cannot get a share token and do not consume a completed-answer
allowance. An unavailable or malformed review also prevents sharing. Existing
saved answers are not retroactively reviewed.

This review is an additional model judgement, not independent verification of
publisher accuracy or a proof that every claim is true. False acceptances and
false rejections remain possible and require live evaluation. Deterministic
local rent answers use their existing structured checks and need no model
review. Demo mode explicitly uses canned answers and reviews.

There are at most two model invocations for a generated answer: drafting and
review. Both share the existing 55-second server deadline and cancellation
signal. The prompt asks for at most 350 words; generation is capped at 1,800
output tokens and review at 650. Each invocation counts against the existing
anonymous model-attempt limits, including the shared daily ceiling. The
completed-answer allowance is charged once only after a supported answer.
There is no retry or automatic rewrite loop. This adds review latency and token
cost per generated answer while reducing evidence sent to the drafting model.

Regression checks cover the source cap and original IDs, local comparison
preservation, repeated versus invalid citations, excluded references, reviewer
rejection/unavailability/malformed responses, quota accounting and cancellation
during a stalled review. Live checks must assess actual review behaviour and
latency separately; mocked reviewer tests establish control flow only.

Post-deployment checks of #210 exposed a false acceptance: the reviewer allowed
claims about conversion pressure based on editorial commentary. A three-source
request also failed without enough logging to distinguish a reference failure
from a malformed review. The follow-up keeps interpretations of explicitly named,
dated or numbered observations on structured metric records only. General
editorial questions can still retrieve editions. Generated feed angles, sales
lines, counterpoints and personal notes are no longer factual prompt material.
It also numbers selected evidence consecutively and returns a sourced
insufficient result for reference/review failures, with privacy-preserving logs
identifying the failure stage. No rejected draft is shown or shared. The broader
semantic limits of model review still apply.


Live checks after #211 confirmed the three-source limit and consecutive source
links, but a Signals answer still labelled the July observation current and
asserted a material approvals/completions gap without supporting records. The
reviewer accepted it despite the removal of editorial evidence. The specific
generated building-approvals Signals question now receives a structured answer
with the matched value, date and source, a recomputed reporting status, and
explicit limits on trends and completion claims. It makes no model calls.
Changed or missing observations decline rather than substituting another period.
Additional user questions and other metric topics retain the model path and its
stated limitations. Existing saved model answers are not retroactively corrected.
