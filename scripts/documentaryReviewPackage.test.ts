import { expect, it } from "vitest";
import { parseDocumentaryAudioAudit } from "./lib/documentaryReviewPackage";

it("reads actual input loudness rather than the hypothetical normalised output", () => {
  expect(
    parseDocumentaryAudioAudit(
      'log prefix\n{"input_i":"-17.54","input_tp":"-4.07","input_lra":"3.3","output_i":"-16"}\n'
    )
  ).toEqual({
    integratedLufs: -17.54,
    truePeakDbtp: -4.07,
    loudnessRange: 3.3,
  });
  expect(() => parseDocumentaryAudioAudit("No measurements")).toThrow();
  expect(() =>
    parseDocumentaryAudioAudit('{"input_i":"-inf","input_tp":"-inf","input_lra":"0"}')
  ).toThrow("silent");
});
