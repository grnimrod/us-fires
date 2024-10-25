import { timeParse } from "d3";

const firesJson = "../fires.json";

export async function fetchFiresData() {
  return fetch(firesJson).then((response) => response.json());
}

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

export function filterPerYear(data, year) {
  // Filter data for specific year, e.g. 2005
  const yearData = data.filter((d) => d.DISCOVERY_DATE.getFullYear() === year);

  return yearData;
}
