import { timeParse, timeFormat, rollups } from "d3";

const firesJson = "../fires.json";

export async function fetchFiresData() {
  return fetch(firesJson).then((response) => response.json());
}

export function cleanFiresData(data) {
  const parseDate = timeParse("%Y-%m-%d %H:%M:%S");
  const validProjectedFires = data.filter(
    (d) => d.LONGITUDE !== undefined && d.LATITUDE !== undefined
  );

  validProjectedFires.forEach((d) => {
    d.DISCOVERY_DATE = parseDate(d.DISCOVERY_DATE);
    d.CONT_DATE = parseDate(d.CONT_DATE);
  });

  return validProjectedFires;
}

export function countFiresPerDay(data) {
  return Array.from(
    rollups(
      data,
      (v) => v.length,
      (d) => d.DISCOVERY_DATE
    ),
    ([key, values]) => ({
      date: new Date(key),
      count: values,
    })
  ).sort((a, b) => a.date - b.date);
}

export function countFiresPerState(data) {
  return Array.from(
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
