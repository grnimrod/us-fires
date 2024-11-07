import { timeFormat, select } from "d3";
import { sliderBottom } from "d3-simple-slider";
import { createChoroplethMap } from "./choroplethMap";
import { createSunburstChart } from "./fireTypesSunburst";
import { createHistogram } from "./histTimeline";
import {
  fetchFiresData,
  cleanFiresData,
  countMonthlyFiresPerState,
  createMonthlyHierarchy,
} from "./prepareFiresData";

async function init() {
  const firesData = await fetchFiresData();
  const cleanData = cleanFiresData(firesData);
  const monthlyFiresPerState = countMonthlyFiresPerState(cleanData);
  const monthlyFireCategoriesData = createMonthlyHierarchy(cleanData);

  const choroplethMap = await createChoroplethMap(
    "#fig1",
    monthlyFiresPerState
  );
  const sunburstChart = createSunburstChart("#fig2", monthlyFireCategoriesData);

  const sliderContainer = "#slider-container";
  const sliderHeight = 100;
  const histTimeline = createHistogram(sliderContainer, cleanData);

  // We use these to set up slider with custom steps
  // They are based on the data of the choropleth map, but all data will follow the same structure of
  // being grouped by year-month, as it's necessary for the custom steps of the slider (index-based)
  const months = monthlyFiresPerState.map((d) => d.month);
  const monthIndex = months.map((date, index) => ({
    index,
    date,
  }));

  // Create slider and set up interactions
  const numTicks = 6;
  const tickInterval = Math.floor((monthIndex.length - 1) / (numTicks - 1));

  const tickValues = Array.from(
    { length: numTicks },
    (_, i) => i * tickInterval
  );

  const sliderRange = sliderBottom()
    .min(0)
    .max(monthIndex.length - 1)
    .step(1)
    .width(500)
    .tickValues(tickValues)
    .tickFormat((i) => timeFormat("%Y-%m")(monthIndex[i].date))
    .ticks(numTicks);

  sliderRange.on("onchange", (val) => {
    const selectedMonthDataChoropleth = monthlyFiresPerState[val];
    choroplethMap.updateMap(selectedMonthDataChoropleth);

    // Other charts with other ways of accessing their relevant pre-made data can come here below
    const selectedMonthDataSunburst = monthlyFireCategoriesData[val];
    sunburstChart.updateSunburst(selectedMonthDataSunburst);
  });

  const gRange = select(sliderContainer)
    .append("svg")
    .attr("width", 700)
    .attr("height", sliderHeight)
    .append("g")
    .attr("transform", "translate(95, 10)");

  gRange.call(sliderRange);
}

init();
