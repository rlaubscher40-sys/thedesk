# Signals observation dates

The production Signals page previously called every stored metric live and
offered an Ask link describing its value as relevant "right now", without
showing the observation date. Ask likewise introduced retrieved metric rows as
"Current value" regardless of their reporting date.

Signals now displays the observation date on its leading number, metric board
and watchlist entries. The existing Admin metric-health rules provide separate
notices for old reporting periods, overdue collection, invalid/future dates,
extracted evidence and unknown publication cadence. A recent database update
cannot make an old observation current. Review thresholds allow publication
lags; they do not prove that a publisher has no newer data.

Ask links carry the date and freshness explanation. The server independently
adds the same explanation when retrieving a metric, including questions entered
directly on Ask. Evidence is labelled "Stored observation" and the prompt must
respect its reporting status throughout the answer. These instructions are not
a guarantee of compliant model prose or verification of the underlying number.

No collection, history, share-card rendering, data schema or schedule changes.
The existing ranking still uses movement across recorded history; it is not a
ranking of the freshest observations. Share cards already carry an as-of date;
their public links still open the latest stored record. Historical link
retention and the broader source-coverage work remain separate.

Verification covers a freshly saved old observation, a current-period overdue
refresh, invalid/future dates, unknown cadence, the dated Ask link, the rendered
Signals hero/board and the actual evidence supplied by the Ask router. Production
checks should confirm the date labels on the board and a retained older metric,
then follow its Ask link and inspect the generated response separately.
