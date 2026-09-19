/** Exact saved exports authorised for release by Ruben on 17 September 2026,
 * with the four active films revoiced under his 19 September instruction.
 * His instruction accepts the disclosed review limitations. This does not claim
 * a full listening/motion pass or that Ruben watched these files. Input drift
 * invalidates authorisation; the saved MP4 digest also gates delivery. */
import type { ReelVoiceIdentity } from "../video/reelVoice";

export const DOCUMENTARY_RELEASE_AUTHORISATION = {
  kind: "user-release-authorisation",
  author: "Ruben Laubscher",
  date: "2026-09-17",
  instruction: "I trust them to be good lets start posting etx",
  fullListening: "not-performed",
  continuousMotion: "not-reviewed",
  revoice: {
    date: "2026-09-19",
    instruction:
      "Check and make aure all is good and implenented across all reels documentary style and the briefing ones moving forward.",
    scope:
      "Replace the four active documentary exports with Ruben's clone; retain release dates and receipts.",
    fullListening: "not-performed",
    continuousMotion: "not-reviewed",
  },
} as const;

export const DOCUMENTARY_REVIEWS: Readonly<
  Record<
    string,
    {
      hash: string;
      seconds: number;
      videoSha256: string;
      reviewedAt: string;
      voice: ReelVoiceIdentity;
    }
  >
> = {
  "grollo-ownership": {
    hash: "a0e4f62673f339f2e8d001edc2266255cfb9ea6d148325d56ae54fd0258bb159",
    seconds: 63.86666666666667,
    videoSha256: "d15da73958f618771169603268755e2ebbfbf5320376982bd1a7c6886af98b74",
    voice: { engine: "local-kokoro", voice: "bm_fable", speed: 1 },
    reviewedAt: "2026-09-14",
  },
  "meriton-accommodation": {
    hash: "8621d831b83b11aa20c37a4c2f647e0fa7d34517a3e6a9567bb4d0a9daf03030",
    seconds: 69.6,
    videoSha256: "e04e49d2d74e2d3717b41bd282b37a4e737370b40e25c6de1eb2823f6d363068",
    voice: { engine: "local-kokoro", voice: "bm_fable", speed: 1 },
    reviewedAt: "2026-09-14",
  },
  "triguboff-apartments": {
    hash: "ee8cf73ded8469d8925262eb5917cd4fdc77cc853aca14bf0c9e6c51152d9aef",
    seconds: 148.29999999999998,
    videoSha256: "5c19a4089a7f6dbfa255a3e75313dbd68ef70c5b10d0191b83d2aba8234ff782",
    voice: { engine: "elevenlabs", voice: "xeSYpoWjkR3imzxB6qDk", speed: 1 },
    reviewedAt: "2026-09-19",
  },
  "grollo-family": {
    hash: "1de2f11e99392eb43a6dc1b434b527a48d42829ab67e004bccf149b6f714669d",
    seconds: 90.9,
    videoSha256: "f2c65593b6ab05f44769c78af349782ccccc97291804ea56c3818297bfd1c262",
    voice: { engine: "elevenlabs", voice: "xeSYpoWjkR3imzxB6qDk", speed: 1 },
    reviewedAt: "2026-09-19",
  },
  "lowy-westfield": {
    hash: "defe97189f5a2b2427ff2d15e50d3cc76f5df301a63103fda3675918eb0fbfbc",
    seconds: 66.43333333333334,
    videoSha256: "005bb8b67db415b316310129dbab118586aebe4d3cadce54301b770381159038",
    voice: { engine: "elevenlabs", voice: "xeSYpoWjkR3imzxB6qDk", speed: 1 },
    reviewedAt: "2026-09-19",
  },
  "walker-rebuild": {
    hash: "0e43fade259cb0af9d0202e141456fc0c7dff4961f5c559ffd636ee0fb3265ee",
    seconds: 65.56666666666666,
    videoSha256: "2b6120734d906d9a4e32d5efe7eca8e54bae17c3f9be92e2d194e0890a7936bf",
    voice: { engine: "elevenlabs", voice: "xeSYpoWjkR3imzxB6qDk", speed: 1 },
    reviewedAt: "2026-09-19",
  },
};
