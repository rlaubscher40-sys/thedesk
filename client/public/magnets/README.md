# Lead-magnet assets

Drop the downloadable files for each lead magnet here. The filename must match
the `deliveryUrl` in `shared/leadMagnets.ts`.

For example, the seed "hotspots" magnet has `deliveryUrl: "/magnets/hotspots.pdf"`,
so its asset lives at `client/public/magnets/hotspots.pdf`.

Until the real file is added, a confirmed subscriber's download link 302s to a
missing file. Add the PDF (or change `deliveryUrl` to an external link) before
pointing traffic at `/free/<slug>`.
