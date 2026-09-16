import { describe, expect, it } from "vitest";
import { dependencyRights } from "./dependencyRights";

describe("runtime dependency rights inventory", () => {
  const inventory = dependencyRights();
  it("walks transitive packages including export-restricted packages without executing them", () => {
    expect(inventory.packages.find((p) => p.name === "phonemizer")?.reviewFlags).toContain(
      "bundled-native-or-wasm-components-review"
    );
    expect(inventory.packages.find((p) => p.name === "onnxruntime-node")).toBeDefined();
    expect(inventory.packages.find((p) => p.name === "ffmpeg-static")?.reviewFlags).toContain(
      "reciprocal-licence-review"
    );
    expect(inventory.packages.find((p) => p.name === "vitest")).toBeUndefined();
    expect(inventory.missing.filter((m) => !m.optional)).toEqual([]);
  });
  it("retains notice fingerprints, versions and no local paths or credentials", () => {
    const voice = inventory.packages.find((p) => p.name === "kokoro-js")!;
    expect(voice.version).toBe("1.2.1");
    expect(voice.notices.some((n) => n.file === "LICENSE" && /^[a-f0-9]{64}$/.test(n.sha256))).toBe(
      true
    );
    expect(JSON.stringify(inventory)).not.toMatch(/\/workspace\/|\/home\/|DATABASE_URL/);
    expect(new Set(inventory.packages.map((p) => `${p.name}@${p.version}`)).size).toBe(
      inventory.packages.length
    );
  });
});
