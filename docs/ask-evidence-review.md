# Ask evidence review

Live checks after #207/#209 found two failures: the model returned more than
eight citations and failed response validation; a later answer inferred
lengthening construction times from approvals and commentary without a
completion-duration series. It also ignored a request for three sources.

The answer prompt now receives at most eight relevant records, or a smaller
explicit limit requested as digits or words one through eight. Local facts keep
their separate period references. If those facts exceed the requested limit,
Ask declines instead of dropping part of a comparison. An explicitly named
metric is prioritised, then remaining reporting is ranked. IDs stay stable;
records retrieved but omitted from this evidence set cannot be cited.

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
