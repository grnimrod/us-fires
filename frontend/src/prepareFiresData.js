import { timeParse, rollup, rollups, timeDay } from "d3";

const firesJson = "../fires.json";

// Function for fetching the JSON file
export async function fetchFiresData() {
  return fetch(firesJson).then((response) => response.json());
}

// Function for preparing data into the state that we use with every figure
export function cleanFiresData(data) {
  // Filter data points where either longitude or latitude is undefined
  const validProjectedFires = data.filter((d) => {
    return d.LONGITUDE !== undefined && d.LATITUDE !== undefined;
  });

  const parseDate = timeParse("%Y-%m-%d %H:%M:%S");

  // Parse date fields
  validProjectedFires.forEach((d) => {
    d.DISCOVERY_DATE = parseDate(d.DISCOVERY_DATE);
    d.CONT_DATE = parseDate(d.CONT_DATE);
  });

  return validProjectedFires;
}

// Function for filtering down to specific year
export function filterPerYear(data, year) {
  // Filter data for specific year, e.g. 2005
  const yearData = data.filter((d) => d.DISCOVERY_DATE.getFullYear() === year);

  return yearData;
}

// Function for grouping by each date and obtaining count of fires on the specific date (for area chart)
export function countFiresPerDay(data) {
  const firesPerDay = rollups(
    data,
    (v) => v.length,
    (d) => timeDay(d.DISCOVERY_DATE)
  );

  firesPerDay.sort((a, b) => a[0] - b[0]);

  return firesPerDay;
}

// Function for grouping by state and obtaining count of fires
export function countFiresPerState(data) {
  const firesPerState = Array.from(
    rollups(
      data,
      (v) => v.length,
      (d) => d.STATE_NAME
    ),
    ([key, values]) => ({
      state: key,
      count: values,
    })
  );

  return firesPerState;
}

// Function for creating hierarchical data of fire categories (for sunburst chart)
export function createHierarchy(data) {
  const hierData = {
    name: "root",
    children: Array.from(
      rollups(
        data,
        (v) => v.length,
        (d) => d.CAUSE_CATEGORY,
        (d) => d.STAT_CAUSE_DESCR
      ),
      ([key, values]) => ({
        name: key,
        children: values.map(([subKey, count]) => ({
          name: subKey,
          value: count,
        })),
      })
    ),
  };

  return hierData;
}
