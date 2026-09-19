/** Exact saved exports authorised for release by Ruben on 17 September 2026.
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
    seconds: 169.7,
    videoSha256: "724fbffc77d3ee4fd5892134b053bbdc7146a90d048a9c66333ea0754bff72b9",
    voice: { engine: "local-kokoro", voice: "bm_fable", speed: 1 },
    reviewedAt: "2026-09-17",
  },
  "grollo-family": {
    hash: "1de2f11e99392eb43a6dc1b434b527a48d42829ab67e004bccf149b6f714669d",
    seconds: 106.4,
    videoSha256: "003cc168582fe3bdaf48c5e22f25f5e3daf4b9c88f4688a0026145185dbb4ed1",
    voice: { engine: "local-kokoro", voice: "bm_fable", speed: 1 },
    reviewedAt: "2026-09-17",
  },
  "lowy-westfield": {
    hash: "defe97189f5a2b2427ff2d15e50d3cc76f5df301a63103fda3675918eb0fbfbc",
    seconds: 83.96666666666665,
    videoSha256: "bafc86750ae066e73c01c82a7714dce36a1ced3f6a12ca95c386aaa976264d31",
    voice: { engine: "local-kokoro", voice: "bm_fable", speed: 1 },
    reviewedAt: "2026-09-17",
  },
  "walker-rebuild": {
    hash: "0e43fade259cb0af9d0202e141456fc0c7dff4961f5c559ffd636ee0fb3265ee",
    seconds: 84.6,
    videoSha256: "bc59d326425d83101aa5a15dd7dae76beea579a6864ea118e10a606d18709f19",
    voice: { engine: "local-kokoro", voice: "bm_fable", speed: 1 },
    reviewedAt: "2026-09-17",
  },
};
