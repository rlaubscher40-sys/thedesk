/** Historical exact-export reviews. The new cinematic Triguboff cut still needs review.
 * Changed render inputs invalidate these records; the four-film launch gate stays closed.
 * A changed hash withholds publication.
 * See docs/documentary-reel-programme.md for the review workflow and source notes. */
export const DOCUMENTARY_REVIEWS: Readonly<
  Record<
    string,
    {
      hash: string;
      seconds: number;
      videoSha256: string;
      reviewedAt: string;
    }
  >
> = {
  "grollo-ownership": {
    hash: "a0e4f62673f339f2e8d001edc2266255cfb9ea6d148325d56ae54fd0258bb159",
    seconds: 63.86666666666667,
    videoSha256: "d15da73958f618771169603268755e2ebbfbf5320376982bd1a7c6886af98b74",
    reviewedAt: "2026-09-14",
  },
  "grollo-family": {
    hash: "6d5efdd0c020c95a831bf9684dd1b2a255a9e35311442872a7303a01323eeb08",
    seconds: 91.9,
    videoSha256: "68bf82175748be8c6e503278fdf455edd9270d350901859b4671c05071035a13",
    reviewedAt: "2026-09-14",
  },
  "meriton-accommodation": {
    hash: "8621d831b83b11aa20c37a4c2f647e0fa7d34517a3e6a9567bb4d0a9daf03030",
    seconds: 69.6,
    videoSha256: "e04e49d2d74e2d3717b41bd282b37a4e737370b40e25c6de1eb2823f6d363068",
    reviewedAt: "2026-09-14",
  },
  "triguboff-apartments": {
    hash: "3549288aaf799538eeb8a6b6ed31c27453c4c782748c8912fb51dd13ff2588ff",
    seconds: 163.3,
    videoSha256: "6c6455d25f18d74df230cc5e886bb69fab4a13bc45105aae4883f89adb86e8b3",
    reviewedAt: "2026-09-14",
  },
};
