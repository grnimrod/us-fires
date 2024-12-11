import { timeParse, rollups, hierarchy } from "d3";

const firesJson = "../fires.json";
// const firesJson = "../fires_reduced.json";

export async function fetchFiresData() {
  return fetch(firesJson).then((response) => response.json());
}

export function cleanFiresData(data) {
  const parseDate = timeParse("%Y-%m-%d %H:%M:%S");

  const validProjectedFires = data.filter(
    (d) => 
      d.LONGITUDE !== undefined && 
      d.LATITUDE !== undefined &&
      d.STATE_NAME
  );

  validProjectedFires.forEach((d) => {
    d.DISCOVERY_DATE = parseDate(d.DISCOVERY_DATE);
    d.CONT_DATE = parseDate(d.CONT_DATE);
  });

  return validProjectedFires;
}

export function prepareUnifiedMonthlyData(data) {
  // Get all distinct states for consistent state-based counts
  const allStates = Array.from(new Set(data.map((d) => d.STATE_NAME)));

  // Group data by year-month
  const monthMap = data.reduce((acc, observation) => {
    const monthKey = new Date(
      observation.DISCOVERY_DATE.getFullYear(),
      observation.DISCOVERY_DATE.getMonth()
    ).toISOString();

    if (!acc[monthKey]) {
      acc[monthKey] = {
        month: new Date(monthKey),
        totalFireCount: 0,
        stateCounts: allStates.map((state) => ({ state, count: 0 })),
        categories: { name: "root", children: [] },
        monthlyStructure: { month: new Date(monthKey), children: [] },
      };
    }

    const monthData = acc[monthKey];
    monthData.totalFireCount++;
    monthData.monthlyStructure.children.push(observation);

    // Update state-based counts
    const stateEntry = monthData.stateCounts.find(
      (entry) => entry.state === observation.STATE_NAME
    );
    if (stateEntry) {
      stateEntry.count++;
    } else {
      console.error("State not found in stateCounts:", observation.STATE_NAME);
    }

    // Build sunburst hierarchy
    let causeCategory = monthData.categories.children.find(
      (child) => child.name === observation.CAUSE_CATEGORY
    );
    if (!causeCategory) {
      causeCategory = { name: observation.CAUSE_CATEGORY, children: [] };
      monthData.categories.children.push(causeCategory);
    }

    let causeDescription = causeCategory.children.find(
      (child) => child.name === observation.STAT_CAUSE_DESCR
    );
    if (!causeDescription) {
      causeDescription = { name: observation.STAT_CAUSE_DESCR, count: 0 };
      causeCategory.children.push(causeDescription);
    }

    causeDescription.count++;

    return acc;
  }, {});

  // Convert monthMap to sorted array
  return Object.values(monthMap).sort((a, b) => a.month - b.month);
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

export function structureByMonth(data) {
  const groupedData = data.reduce((acc, observation) => {
    const monthYear = new Date(
      observation.DISCOVERY_DATE.getFullYear(),
      observation.DISCOVERY_DATE.getMonth()
    );

    if (!acc[monthYear]) {
      acc[monthYear] = { month: monthYear, children: [] };
    }

    acc[monthYear].children.push(observation);

    return acc;
  }, {});

  return Object.values(groupedData).sort((a, b) => a.month - b.month);
}

export function countMonthlyFiresPerState(data) {
  const allStates = Array.from(new Set(data.map((d) => d.STATE_NAME))).filter(Boolean);

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

export function countFiresPerMonth(data) {
  const monthlyFiresCount = Array.from(
    rollups(
      data,
      (v) => v.length,
      (d) =>
        new Date(d.DISCOVERY_DATE.getFullYear(), d.DISCOVERY_DATE.getMonth())
    ),
    ([key, values]) => ({
      month: key,
      count: values,
    })
  );
  monthlyFiresCount.sort((a, b) => a.month - b.month);
  return monthlyFiresCount;
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
