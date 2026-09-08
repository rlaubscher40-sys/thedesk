# Verified RBA housing lending rates

The daily metrics ingest reads two series from RBA statistical table F6,
“Housing Lending Rates”:

- `FLRHOFTA`: new owner-occupier housing loans funded in the month, all loans,
  all institutions;
- `FLRHIFTA`: new investment housing loans funded in the month, all loans, all
  institutions.

Both are monthly original series in per cent per annum, sourced by the RBA from
APRA and RBA data. They are averages of loans funded in the observation month.
They are not advertised rates, a quote available to a particular borrower, the
cash rate, repayments, lending volumes or evidence that a rate caused a market
outcome.

The parser verifies the table title, series ID, full series title, description,
frequency, adjustment type, units, source and publication date. It reads only
the latest table row. If either current observation is absent, malformed,
implausible, stale or future-dated, the F6 read fails closed rather than using
an older value. The publication date, observation month, original-series status
and the RBA's revision caveat remain visible in metric context.

The source is the RBA's free, keyless CSV. This adds no credentials or paid
service. The official source URL is retained through the scheduled ingest so a
reader can audit the metric from the product.
