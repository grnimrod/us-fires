import { min, max, timeFormat, select } from "d3";
import { sliderBottom } from "d3-simple-slider";
import { createChoroplethMap } from "./choroplethMap";
import { createAreaChart } from "./areaTimeline";
import {
  fetchFiresData,
  cleanFiresData,
  countMonthlyFiresPerState,
} from "./prepareFiresData";

async function init() {
  const firesData = await fetchFiresData();
  const cleanData = cleanFiresData(firesData);
  const monthlyFiresPerState = countMonthlyFiresPerState(cleanData);

  const choroplethMap = await createChoroplethMap(
    "#fig1",
    monthlyFiresPerState
  );
  const areaChart = createAreaChart("#fig2", cleanData);

  // We use these to set up slider with custom steps
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
    .width(300)
    .tickValues(tickValues)
    .tickFormat((i) => timeFormat("%Y-%m")(monthIndex[i].date))
    .ticks(numTicks);

  sliderRange.on("onchange", (val) => {
    const selectedMonthData = monthlyFiresPerState[val];
    choroplethMap.updateMap(selectedMonthData);

    // Other charts with other ways of accessing their relevant pre-made data can come here below
  });

  const gRange = select("#slider-range")
    .append("svg")
    .attr("width", 500)
    .attr("height", 100)
    .append("g")
    .attr("transform", "translate(90, 30)");

  gRange.call(sliderRange);
}

init();
