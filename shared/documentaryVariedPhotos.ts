const commons = "https://commons.wikimedia.org/wiki/File:";
const by = "https://creativecommons.org/licenses/by/2.0/";
const sa4 = "https://creativecommons.org/licenses/by-sa/4.0/";
const photo = (
  asset: string,
  sha256: string,
  credit: string,
  filename: string,
  licence: string,
  purpose: string,
  focus = 0.5,
  verticalFocus = 0.5
) => ({
  asset,
  sha256,
  credit,
  source: commons + filename,
  licence,
  purpose,
  focus,
  verticalFocus,
  changes:
    "Resized for production; cropped, reframed, animated and captioned in the film. Adapted photographic sequences retain the source's Creative Commons licence where required.",
  reviewed: "2026-09-15",
});

/** Each image was opened and its individual author, date and licence checked. */
export const VARIED_DOCUMENTARY_PHOTOS = {
  lowyPortrait: photo(
    "documentary-lowy-archive.jpg",
    "fc77e0ed6eac07be094f1e5b9b4b36804f44738e2a3c94d720b840fe11159a8c",
    "Frank Lowy / Union20 / public domain / adapted",
    "Frank_Lowy_presented_with_Woodrow_Wilson_Award.jpg",
    commons + "Frank_Lowy_presented_with_Woodrow_Wilson_Award.jpg#Licensing",
    "Frank Lowy at an award event. Uploaded in 2008; the precise exposure date is not established. Never label as his 1960 portrait.",
    0.3,
    0.7
  ),
  lowyLaunch: photo(
    "documentary-lowyLaunch.jpg",
    "167c0784455109bb03b10c0cb9d5cd71b21139f5bd544752712875cb2fc7a17f",
    "Stratford, 2011 / PlanningResource / CC BY 2.0 / adapted",
    "London_mayor_Boris_Johnson_and_Westfield_group_chairman_Frank_Lowy_launch_Westfield_Stratford_(6146924573).jpg",
    by,
    "Actual Stratford opening ceremony, 13 September 2011, with Lowy and Boris Johnson. Used only for that later chapter.",
    0.58,
    0.6
  ),
  hornsby: photo(
    "documentary-hornsby.jpg",
    "bce990407e79c219d1f77d2d8a388c1491656fa6e21478b56aac9d45b575415e",
    "Hornsby, 2018 / Sardaka / CC BY-SA 4.0 / adapted",
    "(1)Hornsby_Westfield-1.jpg",
    sa4,
    "Westfield Hornsby photographed 1 July 2018. The centre was redeveloped; this is later place context, not the 1961 centre."
  ),
  tracy: photo(
    "documentary-tracy.jpg",
    "f24dc1d67cfc446cb88f69926a9d4c0a4edaebb5e169abd7671d512d9d2d05d4",
    "Darwin after Tracy / Billbeee / CC BY-SA 3.0 / adapted",
    "Houses-after-tracy.jpg",
    "https://creativecommons.org/licenses/by-sa/3.0/",
    "Cyclone Tracy aftermath in Darwin, Christmas 1974. Metadata dates the later digitisation in 2007. Does not identify Grollo houses or workers."
  ),
  rialtoPark: photo(
    "documentary-rialtoPark.jpg",
    "ece6cfe38944b251cbe471e16b7d8233e3178c48572cf559a7e774348a7b591d",
    "Rialto, 2008 / Nick carson / public domain / adapted",
    "Rialto_Towers_From_Batman_Park.JPG",
    commons + "Rialto_Towers_From_Batman_Park.JPG#Licensing",
    "Rialto from Batman Park, December 2008. Later architecture, not construction-period archive.",
    0.5,
    0.15
  ),
  collinsStreet: photo(
    "documentary-collinsStreet.jpg",
    "a9905e63a048ff37378b185664b6f476682fbcb6b097e089c0e41f3fe0b8713d",
    "Collins St, 2010 / Rexness / CC BY-SA 2.0 / adapted",
    "Collins_Street_architecture.jpg",
    "https://creativecommons.org/licenses/by-sa/2.0/",
    "Collins Street architecture in May 2010. Later Melbourne context. Not the Reserve Bank, Collins Square, or 1928 Melbourne."
  ),
  wharf: photo(
    "documentary-wharf.jpg",
    "4f69407ec2e9d90edeb78f16b416436c81c466d18c34aa4bec14c8c690953157",
    "Finger Wharf, 2023 / DXR / CC BY-SA 4.0 / adapted",
    "Finger_Wharf,_Sydney,_southeast_view_20230206_1.jpg",
    sa4,
    "Finger Wharf exterior, 6 February 2023. Later project photograph, not construction or evidence of current Walker ownership."
  ),
  wharfInterior: photo(
    "documentary-wharfInterior.jpg",
    "62c3a9ff652f2d8990ee72b97fde9b94f588b5c8ee0fe2bb397f031eddc473c8",
    "Finger Wharf, 2018 / Nick-D / CC BY-SA 4.0 / adapted",
    "Interior_of_the_Finger_Wharf_in_Woolloomooloo_April_2018.jpg",
    sa4,
    "Finger Wharf interior, 26 April 2018. Later architectural context, not a claimed transaction asset."
  ),
  parramattaBuild: photo(
    "documentary-parramattaBuild.jpg",
    "c351de53b1b2c4057f0934f233ced100cec63eb08a91e0da1cba18c030044123",
    "Parramatta, 2020 / Xing Lin / CC BY 2.0 / adapted",
    "Parramatta_Square_from_Valentine_Square_(cropped).jpg",
    by,
    "Parramatta Square in March 2020 during the precinct's development. Not evidence that Mirvac sale proceeds funded this project."
  ),
  parramatta: photo(
    "documentary-parramatta.jpg",
    "d96debf8bdbb52814d819c5cb7574af5f568692be8dcc3e5ac5077e9bd481059",
    "6 & 8 PSQ, 2023 / Kgbo / CC BY-SA 4.0 / adapted",
    "6_&_8_Parramatta_Square,_Parramatta,_2023.jpg",
    sa4,
    "6 and 8 Parramatta Square, 15 October 2023. One part of the precinct; the A$3.5bn figure describes the project, not this tower alone.",
    0.5,
    0.2
  ),
} as const;
