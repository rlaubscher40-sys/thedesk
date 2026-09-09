import { RENT_CITIES, RENT_DATA_URL, latestRent, rentPeriod, type CityRents } from "./cityRents";

/** Keep the observation month and city scope through persistence and citations. */
export function cityRentMetrics(data: CityRents) {
  return RENT_CITIES.flatMap((city, index) => {
    const row = latestRent(data, city);
    if (!row) return [];
    return [
      {
        metricKey: `${city.toLowerCase()}_rent_growth_annual`,
        label: `${city} annual rent change`,
        value: row.annualPercent.toFixed(1),
        unit: "%",
        source: "ABS CPI · capital-city rents · original",
        sourceUrl: data.sourceUrl ?? RENT_DATA_URL,
        groupKey: "PROPERTY",
        context: `${city} CPI capital-city geography only. Annual change in rents actually paid, year to ${rentPeriod(row.period)}. Not monthly growth, a statewide or suburb estimate, median weekly rent, advertised rent, vacancy or yield.${row.status === "p" ? " Preliminary." : row.status === "r" ? " Revised." : ""}${data.delivery === "workbook" ? " Published ABS Table 11; revisions may be incorporated without cell-level flags." : ""}`,
        asOf: `${row.period}-01T00:00:00.000Z`,
        displayOrder: 70 + index,
      },
    ];
  });
}
