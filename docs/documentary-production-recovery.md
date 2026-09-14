# Production system checkpoint

14 September 2026. Draft only; do not merge this partial checkpoint as a finished production release.

The workspace disconnected with an environment_offline error during final export verification. The reusable skill and playbook are preserved here. The executable changes remain in the current conversation's The Desk checkout on feat/documentary-production-system and must be recovered, verified and added before merge.

Implemented locally: documentaryProduction.ts (dossier, research brief and ten editorial criteria), documentaryShotPlan.ts (all measured visuals), scripts/new-documentary.ts, scripts/lib/documentaryReviewPackage.ts, automatic review packaging in scripts/review-documentary.ts, package commands, tests and the matching knip entry cleanup. Harry's renderer has stronger masthead contrast, a closer portrait and larger money figures; the audio graph pads the sidechain so the score fades through the final picture. Direction and sound version 2, renderer version 8. Narration unchanged.

Type checking and 73 focused tests passed. The unused-code check passed after removing the entry now discovered through package.json. Frontend build passed. The skill validator passed. Full CI for the executable changes has not run.

Harry's polished export reached checking-encoded-film in the conversation's documentary-production-master directory. A second episode was rendering in documentary-workflow-proof. Their review completion, final images and hashes are not yet confirmed. A research-only Lang Walker starter is in documentary-lang-walker-brief, with zero claims, zero sources and no release date.

Still required: recover the local changes without overwriting them; complete both export reviews; inspect Harry's new frame sheets and ending; save the master, review package and playbook; add executable code to this branch; run required CI; merge and verify deployment. The new film must not be automatically approved for publication.

The existing saved MP4 remains the accepted cinematic preview. Its input hash is 101e731ba1207265635c280825d8e5b82121377558a04e147a9f5bdeca03dd88 and its video SHA-256 is 15a53cce4a4bc1343e21e190b576df686abf382d740238fc798edec6b5c3c266. Do not relabel that file as the new polished master. Production remains PR #281, commit e746385d07eaf10cdc3cf9cd87964e8803a798f8, with publication withheld.
