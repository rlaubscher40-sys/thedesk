import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

type Package = {
  name: string;
  version: string;
  license?: unknown;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

/** Resolve package metadata without requiring it or running package code. */
function locate(from: string, name: string): string | null {
  let dir = from;
  while (true) {
    const candidate = join(dir, "node_modules", name, "package.json");
    if (existsSync(candidate)) return realpathSync(candidate);
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function dependencyRights(root = process.cwd()) {
  const packages = new Map<
    string,
    {
      name: string;
      version: string;
      declaredLicence: unknown;
      notices: Array<{ file: string; sha256: string }>;
      reviewFlags: string[];
    }
  >();
  const missing: Array<{ parent: string; name: string; optional: boolean }> = [];
  const visited = new Set<string>();
  function visit(file: string, application = false) {
    if (visited.has(file)) return;
    visited.add(file);
    const pkg = JSON.parse(readFileSync(file, "utf8")) as Package;
    const dir = dirname(file);
    if (!application) {
      const notices = readdirSync(dir, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isFile() && /(^|[._-])(licen[cs]e|copying|notice)([._-]|$)/i.test(entry.name)
        )
        .map((entry) => ({
          file: entry.name,
          sha256: createHash("sha256")
            .update(readFileSync(join(dir, entry.name)))
            .digest("hex"),
        }))
        .sort((a, b) => a.file.localeCompare(b.file));
      const flags: string[] = [];
      if (!pkg.license) flags.push("missing-declared-licence");
      if (/GPL|MPL|EPL|CDDL/i.test(JSON.stringify(pkg.license)))
        flags.push("reciprocal-licence-review");
      if (!notices.length) flags.push("no-top-level-notice-file");
      if (/^(phonemizer|ffmpeg-static|onnxruntime-.+|@img\/sharp-libvips-.+)$/.test(pkg.name))
        flags.push("bundled-native-or-wasm-components-review");
      packages.set(`${pkg.name}@${pkg.version}`, {
        name: pkg.name,
        version: pkg.version,
        declaredLicence: pkg.license ?? null,
        notices,
        reviewFlags: flags,
      });
    }
    const deps = { ...pkg.dependencies, ...pkg.optionalDependencies };
    for (const name of Object.keys(deps).sort()) {
      const found = locate(dir, name);
      if (found) visit(found);
      else
        missing.push({
          parent: `${pkg.name}@${pkg.version}`,
          name,
          optional: Object.hasOwn(pkg.optionalDependencies ?? {}, name),
        });
    }
  }
  visit(resolve(root, "package.json"), true);
  return {
    scope:
      "Installed runtime dependency graph, not just direct dependencies. No package code executed. Top-level licence/notice hashes; bundled binaries, WASM and nested third-party notices need separate assessment. Missing platform-optional packages are recorded, not treated as installed. Metadata is evidence, not legal clearance.",
    packages: [...packages.values()].sort((a, b) =>
      `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`)
    ),
    missing,
  };
}
