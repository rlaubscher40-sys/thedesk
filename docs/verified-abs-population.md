# Verified ABS population and migration evidence

This change is stacked on PR #149 because that PR establishes the strict ABS
series contract and adds the comparison surface this evidence extends. It does
not alter the old national `net_migration` release-page metric.

The pinned flow is `ABS:ERP_COMP_Q(1.0.0)`, “Population and components of
change - national, states and territories”. The request is bounded to:

- Queensland (`REGION=3`) and Western Australia (`REGION=5`);
- net internal/interstate migration (`MEASURE=6`, people), net overseas
  migration (`MEASURE=9`, thousands) and ERP (`MEASURE=10`, thousands);
- quarterly frequency (`FREQ=Q`) with only the recent window needed for an
  annual read.

The parser proves the flow, measure, region, frequency, unit and multiplier on
every row. It rejects unknown identities, duplicates and periods. Suppressed or
uncertain statuses remain explicit gaps. Preliminary/revised flags are carried
into the read. Values published in thousands are normalized to people only
after their exact multiplier has been verified.

An annual read needs the latest ERP, the same quarter one year earlier and four
consecutive quarters for both migration components. It never shifts to a
different year to fill a missing observation. The latest quarter may trail the
site date by one to three quarters because this official release has a long
publication lag; older or future data is withheld.

The visible comparison labels this as Queensland context for Brisbane and
Western Australia context for Perth. It never describes state observations as
city observations. Population and migration are demand context, not proof of
housing demand, price pressure or causation, and do not account for household
size, vacancy, demolitions, completions or where new residents settled.

The ABS Data API is free and keyless. This adds no credentials, paid service or
model work, and it uses the existing cache and fail-closed “unavailable” path.
Nothing is published, deployed or merged by this branch.
