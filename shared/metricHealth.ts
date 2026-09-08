import { PROPERTY_REGIONS } from "./propertyCoverage";
import { APPROVAL_REGIONS } from "./cityApprovals";

type Expectation = {
  key: string;
  label: string;
  period: string;
  maxAgeDays: number | null;
  extracted?: boolean;
};
/** Conservative operational review thresholds, not forecasts of publication dates. */
export const METRIC_EXPECTATIONS: Expectation[] = [
  { key: "cash_rate", label: "RBA cash rate", period: "Decision based", maxAgeDays: null },
  ...["asx200", "audusd", "audgbp", "audeur", "us10y"].map((key) => ({
    key,
    label: key.toUpperCase(),
    period: "Trading days",
    maxAgeDays: 5,
  })),
  ...["cpi_trimmed", "unemployment", "wage_growth", "building_approvals", "net_migration"].map(
    (key) => ({
      key,
      label: key.replaceAll("_", " "),
      period: key === "unemployment" || key === "building_approvals" ? "Monthly" : "Release based",
      maxAgeDays:
        key === "net_migration" ? 300 : key === "wage_growth" || key === "cpi_trimmed" ? 180 : 100,
    })
  ),
  ...["owner_occupier_new_lending_rate", "investor_new_lending_rate"].map((key) => ({
    key,
    label: key.replaceAll("_", " "),
    period: "Monthly",
    maxAgeDays: 100,
  })),
  ...Object.values(APPROVAL_REGIONS).map((city) => ({
    key: `${city.toLowerCase()}_approvals_12m`,
    label: `${city} approvals`,
    period: "Monthly · rolling year",
    maxAgeDays: 120,
  })),
  ...PROPERTY_REGIONS.flatMap((region) =>
    [
      "population",
      "population_growth_annual",
      "net_internal_migration_12m",
      "net_overseas_migration_12m",
    ].map((suffix) => ({
      key: `${region.code.toLowerCase()}_${suffix}`,
      label: `${region.code} ${suffix.replaceAll("_", " ")}`,
      period: "Quarterly · official publication lag",
      maxAgeDays: 300,
    }))
  ),
  ...["auction_clearance", "dwelling_value", "consumer_confidence", "mortgage_arrears"].map(
    (key) => ({
      key,
      label: key.replaceAll("_", " "),
      period: "News extracted · verify scope",
      maxAgeDays: key === "auction_clearance" ? 14 : key === "mortgage_arrears" ? 180 : 75,
      extracted: true,
    })
  ),
];

type StoredMetric = {
  metricKey: string;
  label: string;
  asOf: Date;
  updatedAt: Date;
  source: string | null;
};
export function metricHealth(rows: StoredMetric[], now = new Date()) {
  const specs = [...METRIC_EXPECTATIONS];
  for (const row of rows)
    if (!specs.some((spec) => spec.key === row.metricKey))
      specs.push({
        key: row.metricKey,
        label: row.label,
        period: "Cadence unconfigured",
        maxAgeDays: null,
      });
  return specs.map((spec) => {
    const row = rows.find((row) => row.metricKey === spec.key);
    const observationAge = row ? (now.getTime() - row.asOf.getTime()) / 86_400_000 : null;
    const storedAge = row ? (now.getTime() - row.updatedAt.getTime()) / 86_400_000 : null;
    let state = "within review window";
    if (!row) state = "missing";
    else if (
      !Number.isFinite(observationAge) ||
      !Number.isFinite(storedAge) ||
      observationAge! < 0 ||
      storedAge! < 0
    )
      state = "invalid dates";
    else if (spec.maxAgeDays !== null && observationAge! > spec.maxAgeDays)
      state = "old reporting period";
    else if (storedAge! > (spec.extracted ? 8 : 2)) state = "collection overdue";
    else if (spec.extracted) state = "check extracted evidence";
    else if (spec.period === "Cadence unconfigured") state = "cadence unconfigured";
    return {
      ...spec,
      label: row?.label ?? spec.label,
      state,
      asOf: row?.asOf ?? null,
      storedAt: row?.updatedAt ?? null,
      source: row?.source ?? null,
    };
  });
}
