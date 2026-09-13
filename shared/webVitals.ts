import { z } from "zod";
export const webVitalSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9-]{8,100}$/),
    name: z.enum(["LCP", "INP", "CLS"]),
    value: z.number().finite().min(0).max(300_000),
    path: z.string().min(1).max(256),
    device: z.enum(["mobile", "desktop"]),
  })
  .strict();
const VITAL_TARGETS = { LCP: 2500, INP: 200, CLS: 0.1 } as const;
export function summariseVitals(rows: Array<{ name: string; value: number; device: string }>) {
  return ["mobile", "desktop"].flatMap((device) =>
    Object.entries(VITAL_TARGETS).map(([name, target]) => {
      const values = rows
        .filter((row) => row.name === name && row.device === device && Number.isFinite(row.value))
        .map((row) => row.value)
        .sort((a, b) => a - b);
      return {
        name,
        device,
        target,
        count: values.length,
        p75: values.length ? values[Math.ceil(values.length * 0.75) - 1]! : null,
      };
    })
  );
}
