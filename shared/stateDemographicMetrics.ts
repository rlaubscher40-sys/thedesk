import { PROPERTY_REGIONS } from "./propertyCoverage";
import {
  annualStateDemographics,
  DEMOGRAPHIC_SOURCE,
  type StateDemographics,
} from "./stateDemographics";

/** Preserve state boundaries and the official observation period in Ask/Signals storage. */
export function stateDemographicMetrics(data: StateDemographics, asOf: string) {
  return PROPERTY_REGIONS.flatMap((region, index) => {
    const read = annualStateDemographics(data, region.name, asOf);
    if (!read) return [];
    const [year, quarter] = read.period.split("-Q");
    const periodEnd = new Date(Date.UTC(Number(year), Number(quarter) * 3, 0)).toISOString();
    const flags = `${read.preliminary ? " Preliminary observations included." : ""}${read.revised ? " Revised observations included." : ""}`;
    const series = [
      {
        suffix: "population",
        label: "population",
        value: read.population,
        unit: "people",
        context: `Population at end of ${read.period}.`,
      },
      {
        suffix: "population_growth_annual",
        label: "population growth",
        value: read.annualPercent,
        unit: "%",
        context: `Annual population change to ${read.period}.`,
      },
      {
        suffix: "net_internal_migration_12m",
        label: "net interstate migration",
        value: read.netInternalMigration,
        unit: "people",
        context: `Net interstate migration over four quarters to ${read.period}.`,
      },
      {
        suffix: "net_overseas_migration_12m",
        label: "net overseas migration",
        value: read.netOverseasMigration,
        unit: "people",
        context: `Net overseas migration over four quarters to ${read.period}.`,
      },
    ];
    return series.flatMap((series, offset) =>
      series.value === null
        ? []
        : [
            {
              metricKey: `${region.code.toLowerCase()}_${series.suffix}`,
              label: `${region.code} ${series.label}`,
              value: String(series.unit === "%" ? Number(series.value.toFixed(3)) : series.value),
              unit: series.unit,
              source: "ABS ERP_COMP_Q · state/territory",
              sourceUrl: DEMOGRAPHIC_SOURCE,
              groupKey: "DEMOGRAPHICS",
              context: `${region.name}. ${series.context} State/territory data, not a city or suburb estimate.${flags}`,
              asOf: periodEnd,
              displayOrder: 150 + index * 4 + offset,
            },
          ]
    );
  });
}
