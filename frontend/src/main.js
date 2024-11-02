import { min, max, timeFormat, select } from "d3";
import { sliderBottom } from "d3-simple-slider";
import { createChoroplethMap } from "./choroplethMap";
import { createAreaChart } from "./areaTimeline";
import { fetchFiresData, cleanFiresData } from "./prepareFiresData";

async function init() {
  const firesData = await fetchFiresData();
  const cleanData = cleanFiresData(firesData);

  const areaChart = createAreaChart("#fig2", cleanData);
  const choroplethMap = await createChoroplethMap("#fig1", cleanData);

  // Create slider and set up interactions
  const sliderRange = sliderBottom()
    .min(min(cleanData, (d) => d.DISCOVERY_DATE))
    .max(max(cleanData, (d) => d.DISCOVERY_DATE))
    .width(300)
    .tickFormat(timeFormat("%Y-%m-%d"))
    .ticks(5)
    .default([
      min(cleanData, (d) => d.DISCOVERY_DATE),
      max(cleanData, (d) => d.DISCOVERY_DATE),
    ])
    .fill("#943126");

  sliderRange.on("onchange", (val) => {
    const filteredData = cleanData.filter(
      (d) => d.DISCOVERY_DATE >= val[0] && d.DISCOVERY_DATE <= val[1]
    );

    areaChart.updateChart(filteredData);
    choroplethMap.updateMap(filteredData);
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
