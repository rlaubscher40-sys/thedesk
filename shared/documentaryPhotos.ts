/** Individually checked Commons records. Reading an article is not an image licence. */
export const DOCUMENTARY_PHOTOS = {
  goldCoastArchive: {
    asset: "documentary-gold-coast-2008.jpg",
    credit: "Gold Coast / GrieSeb / 2008 / public domain / adapted",
    sha256: "4e83b7984493431663b51c0d813991511d75a72bc499a5c93bc6f00beb7e9837",
    focus: 0.58,
    verticalFocus: 0.5,
    source: "https://commons.wikimedia.org/wiki/File:Surfers_Paradise_(158).JPG",
    licence: "https://commons.wikimedia.org/wiki/File:Surfers_Paradise_(158).JPG#Licensing",
    purpose:
      "Gold Coast context photographed in 2008, not the named Meriton projects or 1980s footage.",
    changes: "Cropped, camera movement and text overlays.",
    reviewed: "2026-09-14",
  },
  tianjinMap: {
    asset: "documentary-tianjin-1930.jpg",
    credit: "Tianjin map / Nikkodo / 1930 / Geographicus / public domain / adapted",
    sha256: "9563ed6cfa1dd865983c668b9b3cf64c6d7b4ec8f733468b07f62bb93e072181",
    focus: 0.52,
    verticalFocus: 0.4,
    source:
      "https://commons.wikimedia.org/wiki/File:1930_Nikkodo_Map_of_Tienjien_(_Tientsin,_Tianjin),_China_-_Geographicus_-_Tienjien-nikkodo-1930.jpg",
    licence:
      "https://commons.wikimedia.org/wiki/File:1930_Nikkodo_Map_of_Tienjien_(_Tientsin,_Tianjin),_China_-_Geographicus_-_Tienjien-nikkodo-1930.jpg#Licensing",
    purpose:
      "Period map of Tianjin. The adjacent journey is a chronology, not a geographic route plotted on this map.",
    changes: "Cropped, camera movement and text overlays.",
    reviewed: "2026-09-14",
  },
  worldTowerArchive: {
    asset: "documentary-world-tower-2008.jpg",
    credit: "World Tower / Adam.J.W.C. / 2008 / CC BY 3.0 / adapted",
    sha256: "e4ee0be860bab3529ac90b7efea84a7622e6aa16fb615aa0e77a1992decc838b",
    focus: 0.45,
    verticalFocus: 0.05,
    source:
      "https://commons.wikimedia.org/wiki/File:World_square_residential_and_commercial_building_in_sydney.jpg",
    licence: "https://creativecommons.org/licenses/by/3.0/",
    purpose: "World Tower in 2008. A later photograph, not footage of the 2004 opening.",
    changes: "Cropped, resized, camera movement and text overlay.",
    reviewed: "2026-09-14",
  },
  rialtoArchive: {
    asset: "documentary-rialto-2009.jpg",
    credit: "Rialto archive, 2009 / Papphase / CC BY 3.0 / adapted",
    sha256: "717b826c889636918df9bef75668ff1f8e55b11a3546c11cd829b99279c57d85",
    focus: 0.5,
    verticalFocus: 0,
    source: "https://commons.wikimedia.org/wiki/File:Rialto_Towers_in_November_2009.jpg",
    licence: "https://creativecommons.org/licenses/by/3.0/",
    purpose:
      "Rialto in 2009. Later building photograph, not footage of the development or early Grollo business.",
    changes:
      "Cropped, resized, camera movement and text overlay; Commons version was already cropped and colour edited.",
    reviewed: "2026-09-14",
  },
  meritonArchive: {
    asset: "documentary-meriton-george-2024.jpg",
    credit: "Meriton archive, 2024 / Sardaka / CC0 / adapted",
    sha256: "3c164928189f31592975eef8c631253e86d27973af7828efd6e018c652dd331b",
    focus: 0.5,
    verticalFocus: 0,
    source: "https://commons.wikimedia.org/wiki/File:Meriton_building_George_Street_001.jpg",
    licence: "https://creativecommons.org/publicdomain/zero/1.0/",
    purpose:
      "Meriton building in George Street, Sydney, photographed in 2024. Context, not a picture of the 2003 launch.",
    changes: "Cropped, resized, camera movement and text overlay.",
    reviewed: "2026-09-14",
  },
  triguboffArchive: {
    asset: "documentary-triguboff-2008.jpg",
    credit: "Triguboff archive, 2008 / Meriton / public domain",
    sha256: "3e0aedd356f240b5b447dcd7b472a88e86d24aefb5a063adb6856db7f7207dba",
    focus: 0.53,
    zoom: 1.4,
    verticalFocus: 1,
    source: "https://commons.wikimedia.org/wiki/File:HarryTriguboff.jpg",
    licence: "https://commons.wikimedia.org/wiki/File:HarryTriguboff.jpg#Licensing",
    purpose:
      "Harry Triguboff photographed in 2008, not a current portrait or evidence of present wealth.",
    changes: "Cropped, resized, camera movement and text overlay.",
    reviewed: "2026-09-14",
  },
} as const;
