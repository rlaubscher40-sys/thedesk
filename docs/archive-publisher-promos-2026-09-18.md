# Historical archive excerpt cleanup · 18 September 2026

Live acceptance of PR #321 traversed all 374 Australian Property stories across ten pages with no gaps or duplicates. It also exposed 34 displayed rows containing recognisable publisher newsletter, live-blog, podcast or continue-reading promotions.

The shared reporting-excerpt cleaner now removes only the observed multi-word promotion phrases and terminal continue-reading link text. Surrounding source wording, numbers and qualifications remain. New RSS descriptions are cleaned before truncation. Existing records are cleaned in public read responses across daily/recent/weekly feeds, story pages, saved items, archives, category browsing and keyword search. Search snippets are regenerated from the cleaned excerpt, avoiding cropped promotional fragments. The archived source records, source links and titles are preserved.

Regression coverage checks the observed spacing variants, a promotion embedded between factual sentences, genuine reporting about newsletters/apps/podcasts, every public feed route, clean search snippets and unchanged stored input. Full CI and post-deploy checks on affected historical stories are required before release completion.
