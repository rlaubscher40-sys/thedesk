/** Curated at build time. These illustrations are never evidence of a measured
 * place, household, transaction or project. No runtime search or random choice. */
export const REEL_PHOTO_CATALOGUE = {
  neighbourhood: {
    asset: "neighbourhood-conacher.jpg",
    credit: "Neighbourhood illustration / Maximillian Conacher / Unsplash",
    focus: 0.5,
    source: "https://unsplash.com/photos/sPpe2D7VbpM",
    licence: "https://unsplash.com/license",
    reviewed: "2026-09-12",
    sha256: "3a6ea9d56faa6fab9c53899822021c55a9eacb6adf3fb18d9a88e3d960eddbb3",
    purpose: "Housing at neighbourhood scale, not a map or evidence of local shortage.",
  },
  residential: {
    asset: "residential-chapman.jpg",
    credit: "Home illustration / Brad Chapman / Unsplash",
    focus: 0.48,
    source: "https://unsplash.com/s/photos/australian-houses",
    licence: "https://unsplash.com/license",
    reviewed: "2026-09-12",
    sha256: "396468056d1d69d70b257078df79d0525b6c7b2c53d487560382543aa17d7f0d",
    purpose: "A lived-in residential setting, not a listing or a named household.",
  },
  building: {
    asset: "house-building-goug.jpg",
    credit: "Building illustration / D Goug / Pexels",
    focus: 0.54,
    source: "https://www.pexels.com/search/house%20construction/",
    licence: "https://www.pexels.com/license/",
    reviewed: "2026-09-12",
    sha256: "e97a89e1f94bcca862c7130f280aa205ee8c61012e657dec4548831748b594a7",
    purpose:
      "Visible framing and scaffolding, not counted starts, completions or a delayed project.",
  },
} as const;
