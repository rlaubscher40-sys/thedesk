# Reel archive photography

## Shared Reel standard: moving home, 12 September 2026

- Photographer: cottonbro studio (identified by the Pexels public download).
- Discovery: https://www.pexels.com/search/moving%20boxes/
- Photo ID: 4554242. The gallery's free download links to
  https://images.pexels.com/photos/4554242/pexels-photo-4554242.jpeg?cs=srgb&dl=pexels-cottonbro-4554242.jpg&fm=jpg
- Downloaded rendition: https://images.pexels.com/photos/4554242/pexels-photo-4554242.jpeg?auto=compress&cs=tinysrgb&w=1400
- Licence: https://www.pexels.com/license/ checked 12 September 2026. Free use
  and modification; no endorsement is implied. The individual photo metadata
  page was unavailable, so no capture date or location is asserted.
- Asset: `server/og/fonts/moving-home-cottonbro.jpg`, unchanged downloaded bytes.
- SHA-256: `11bcc8a3663a1b4727affd220fcd5ececcb84f3133f321c636d7e7ab9413dc5e`.

The inspected photograph shows labelled moving boxes. It illustrates relocation,
not an identified household, an Australian address or a measured interstate route.
It fills the migration opening and net-movement explanation, with a restrained
camera move and visible credit. Other formats reuse the relevant reviewed home,
money, bank and construction images below. Explicit scene assignments live in
`server/video/reelVisualStandard.ts`, shared by production checks and renderers.

## Borrowing film sequence, 11 September 2026

The new-loan story cuts from a bank facade to Australian money, then a home
entrance. These are full-canvas illustrative photographs with restrained camera
movement. The opening and closing leave the upper image clear; evidence graphics
sit lower in the frame. The photographs do not establish financial facts.

Bank opening:

- Photographer: Etienne Martin.
- Source: https://unsplash.com/photos/grey-concrete-building-2_K82gx9Uk8
- Source describes columns on a building in Montréal, Canada, published 27 July 2017. The visible credit identifies Montréal; this is not presented as an
  Australian lender, the RBA building, or an endorsement.
- Download: https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?fm=jpg&q=85&w=1400
- Free Unsplash licence verified on the photo page and https://unsplash.com/license
  on 11 September 2026.
- Asset: `server/og/fonts/bank-etienne-martin.jpg` (download bytes unchanged).
- SHA-256: `c5c3813b3ea7e3ece390a0a03e40ef669f7b4e2236af2ea1de6efb33b3b9c01e`.

Australian money:

- Creator: Pixabay, published through Pexels.
- Source: https://www.pexels.com/video/australian-money-855198/
- The source identifies Australian banknotes and explicitly labels this item
  “Free to use (CC0)”, checked 11 September 2026.
- Download: https://videos.pexels.com/video-files/855198/855198-uhd_3840_2160_30fps.mp4
- Asset: `server/og/fonts/australian-money-pixabay.jpg` is a still extracted at
  4 seconds using FFmpeg, scaled to 1400 pixels wide, JPEG quality 2. It is used
  with a camera move, not represented as moving banknote footage.
- SHA-256: `f3d46ebc5355cb5e49569d56dbcf7bec1197e5212df209e8eb852402a5b2ec62`.

Home context uses the existing Phillip Flores architecture photograph credited
below. No particular property's price, location or loan is asserted. Every shot
has a visible credit below the financial source. Images are bundled at build
time; publication does not download media or call another service. Missing
reviewed images stop the render. Camera progress continues across adjacent
scenes retaining the same photograph, including the two repayment terms.

## Housing construction photograph

- Photographer: Damon Hall.
- Source: https://unsplash.com/photos/a-very-tall-building-with-a-crane-on-top-of-it-jzEkzVq3Yp0
- Source description: tower in construction in Sydney Harbour.
- Published: 12 December 2019. This is not asserted to be the capture date.
- Retrieved and licence checked: 10 September 2026.
- Download: https://images.unsplash.com/photo-1576109129167-4518674c5a2a?fm=jpg&q=85&w=1400
- Licence: https://unsplash.com/license (free commercial and non-commercial use;
  credit appreciated). Photo credited on the Reel and source destination.
- Asset: `server/og/fonts/sydney-construction-damon-hall.jpg`.
- SHA-256: `3242c737991f5100629fcfad7f6e74fbd2abc357547ea6d7737e8eefdd483691`.

The downloaded bytes remain unchanged. The renderer positions the photograph
inside a cropped viewport with a light navy overlay and a restrained pan.
It is illustrative archive imagery, not current construction footage, evidence
of delay at this specific building, or an image of a household priced out.

## Opening architectural photograph

- Photographer: Phillip Flores.
- Source photo: https://unsplash.com/photos/mikcmWSjlMw
- Discovery and photographer association: https://unsplash.com/s/photos/surry-hills
- Public download linked by that source: https://unsplash.com/photos/mikcmWSjlMw/download?force=true
- Downloaded image: https://images.unsplash.com/photo-1674990670827-96cf52e30a8a?fm=jpg&q=85&w=1400
- Licence checked 10 September 2026: https://unsplash.com/license
- Asset: `server/og/fonts/architecture-phillip-flores.jpg`.
- SHA-256: `86d3c4c6aefdc95ee191151f09eabbfe1f6901586302c5d47c96ea87ff2ddfc0`.

The source search lists this free photograph under Phillip Flores. The public
CDN image was downloaded and visually inspected. It is already monochrome;
no greyscale conversion or generated replacement is used. The individual photo
metadata page was unavailable, so no capture date or exact property location
is asserted. The image is labelled architectural illustration, not a home for
sale, a named resident, or evidence of someone being priced out. The code crops
and pans the original bytes inside a viewport to focus on the entrance. The
construction image is now reserved for the construction scene.
