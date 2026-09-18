# Hurstville correction found during live acceptance

The guide-context check after PR #324 exposed an older generated reader-angle block on story 3960085. It inferred that the proposal could not affect a buyer's purchase timeline and that comparable sale values were unlikely to move materially. Neither conclusion is established by the announcement.

The full [NSW Government release of 18 September 2026](https://www.nsw.gov.au/ministerial-releases/new-social-homes-hurstville) was reviewed in the live browser. The [Homes NSW project page](https://www.nsw.gov.au/about-nsw/housing-and-infrastructure-projects/social-building-projects/new-quality-social-housing-for-hurstville) and [Georges River Council notice](https://www.georgesriver.nsw.gov.au/Council/Public-Notices/Proposed-Social-Housing-Development-at-311A-Forest-Road-Hurstville) corroborate the proposal and consultation stage.

The correction withdraws the reader-angle block, restores the more-than qualification to the reported demand figures, and makes the proposal and absence of a construction date explicit. The original title, summary and publisher link remain. The public correction notice records the change. Existing copies already distributed are not rewritten.

The established correction runner matches the exact story ID, original source URL and each prior field value. It is idempotent and preserves later editorial changes and reader notes. Its existing isolated MySQL regression iterates every correction, including this entry, to check application, repeat execution and preservation of unrelated records.
