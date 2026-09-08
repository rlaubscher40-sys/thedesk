import React from "react";
import { PROPERTY_REGIONS } from "./propertyCoverage";
import {
  annualStateDemographics,
  DEMOGRAPHIC_SOURCE,
  type StateDemographics,
} from "./stateDemographics";

export function StateDemographicsRead({
  data,
  stateCode,
  asOf,
}: {
  data: StateDemographics | undefined;
  stateCode: string;
  asOf: string;
}) {
  const state = PROPERTY_REGIONS.find((region) => region.code === stateCode)?.name;
  if (!state) return null;
  const read = annualStateDemographics(data, state, asOf);
  return (
    <section className="rule-hair mt-6 py-6" aria-label="State population and migration">
      <p className="bs-label-accent">Demand · State context</p>
      <h2 className="font-serif text-3xl mt-3">Population and migration in {state}.</h2>
      <p className="text-sm mt-3">
        These figures cover the whole state or territory. They do not measure this city's or
        suburb's growth.
      </p>
      {read ? (
        <>
          <div className="grid sm:grid-cols-3 gap-5 mt-5">
            {[
              ["Population", read.population.toLocaleString("en-AU")],
              [
                "Net interstate migration · year",
                read.netInternalMigration.toLocaleString("en-AU"),
              ],
              ["Net overseas migration · year", read.netOverseasMigration.toLocaleString("en-AU")],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="bs-label">{label}</p>
                <p className="font-mono text-3xl mt-2">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm mt-4">
            Population at {read.period}; migration totals cover the four quarters ending then.
            {read.annualPercent !== null &&
              ` Annual population growth: ${read.annualPercent.toFixed(2)}%.`}
            {read.preliminary && " Includes preliminary data."}
            {read.revised && " Includes revised data."}
          </p>
        </>
      ) : (
        <p className="text-sm mt-4" role="status">
          A complete, current population and migration series is unavailable for {state}. Missing
          observations are not treated as zero.
        </p>
      )}
      <a
        className="bs-link text-sm inline-block mt-4"
        href={DEMOGRAPHIC_SOURCE}
        target="_blank"
        rel="noopener noreferrer"
      >
        ABS source and reporting periods
      </a>
    </section>
  );
}
