import { timeParse, rollups, hierarchy } from "d3";

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

export function countMonthlyFiresPerState(data) {
  const allStates = Array.from(new Set(data.map((d) => d.STATE_NAME)));

  const monthlyFiresPerState = Array.from(
    rollups(
      data,
      (v) => v.length,
      (d) =>
        new Date(d.DISCOVERY_DATE.getFullYear(), d.DISCOVERY_DATE.getMonth()),
      (d) => d.STATE_NAME
    ),
    ([key, values]) => {
      const stateCounts = allStates.map((state) => {
        const entry = values.find(([subKey]) => subKey === state);
        return {
          state: state,
          count: entry ? entry[1] : 0, // Use 0 if the state is missing
        };
      });

      return {
        month: key,
        states: stateCounts,
      };
    }
  );

  monthlyFiresPerState.sort((a, b) => a.month - b.month);
  return monthlyFiresPerState;
}

// Function for creating hierarchical structure of monthly entries for fire categories (for sunburst chart)
function createHierarchy(entries) {
  return {
    name: "root",
    children: Array.from(
      rollups(
        entries,
        (v) => v.length,
        (d) => d.CAUSE_CATEGORY,
        (d) => d.STAT_CAUSE_DESCR
      ),
      ([key, values]) => ({
        name: key,
        children: values.map(([subKey, value]) => ({
          name: subKey,
          count: value,
        })),
      })
    ),
  };
}

export function createMonthlyHierarchy(data) {
  const groupedData = Array.from(
    rollups(
      data,
      (entries) => createHierarchy(entries),
      (d) =>
        new Date(d.DISCOVERY_DATE.getFullYear(), d.DISCOVERY_DATE.getMonth())
    ),
    ([month, hierarchy]) => ({
      month,
      categories: hierarchy,
    })
  );

  groupedData.sort((a, b) => a.month - b.month);
  return groupedData;
}
