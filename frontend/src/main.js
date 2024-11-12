import { timeFormat, select } from "d3";
import { sliderBottom } from "d3-simple-slider";
import { createBinnedMap } from "./binnedMap.js";
import { createChoroplethMap } from "./choroplethMap.js";
import { createSunburstChart } from "./sunburstChart.js";
import { createHistogram } from "./histTimeline.js";
import { createSpiralHeatmap } from "./spiralHeatmap.js";
import {
  fetchFiresData,
  cleanFiresData,
  structureByMonth,
  countMonthlyFiresPerState,
  createMonthlyHierarchy,
  countFiresPerMonth,
} from "./prepareFiresData.js";

async function init() {
  const firesData = await fetchFiresData();
  const cleanData = cleanFiresData(firesData);
  const monthStructure = structureByMonth(cleanData);
  const monthlyFiresPerState = countMonthlyFiresPerState(cleanData);
  const monthlyFiresCount = countFiresPerMonth(cleanData);
  const monthlyFireCategoriesData = createMonthlyHierarchy(cleanData);

  let currentChart = "binnedMap";
  const binnedMap = await createBinnedMap("#fig1", monthStructure);
  const choroplethMap = await createChoroplethMap("#fig2",monthlyFiresPerState );

  // Initially hide choroplethMap container since binnedMap is selected by default
  document.querySelector("#fig2").style.display = "none";

  const sunburstChart = createSunburstChart("#fig3", monthlyFireCategoriesData);
  //const spiralHeatmap = createSpiralHeatmap("#fig4", monthlyFiresCount);

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

  // Set up dropdown menu functionality
  const chartSelector = document.getElementById("chartSelector");

  chartSelector.addEventListener("change", async (event) => {
    const selectedChart = event.target.value;

     // Toggle visibility instead of creating a new map
     if (selectedChart === "binnedMap") {
      document.querySelector("#fig1").style.display = "block";
      document.querySelector("#fig2").style.display = "none";
      currentChart = "binnedMap";
    } else {
      document.querySelector("#fig1").style.display = "none";
      document.querySelector("#fig2").style.display = "block";
      currentChart = "choroplethMap";
    }

    // document.querySelector("#fig1").innerHTML = "";

    // currentChart = selectedChart;

    // currentChart == "binnedMap"
    //   ? await createBinnedMap("#fig1", monthStructure)
    //   : (choroplethMap = await createChoroplethMap(
    //       "#fig1",
    //       monthlyFiresPerState
    //     ));
  });


 sliderRange.on("onchange", (val) => {
      binnedMap.updateBinnedMap(monthStructure[val]);
      choroplethMap.updateMap(monthlyFiresPerState[val]);

    sunburstChart.updateSunburst(monthlyFireCategoriesData[val]);
  });

  // sliderRange.on("onchange", (val) => {
  //   currentChart == "binnedMap"
  //     ? binnedMap.updateBinnedMap(monthStructure[val])
  //     : choroplethMap?.updateMap(monthlyFiresPerState[val]);

  //   const selectedMonthDataSunburst = monthlyFireCategoriesData[val];
  //   sunburstChart.updateSunburst(selectedMonthDataSunburst);
  // });

  const gRange = select(sliderContainer)
    .append("svg")
    .attr("width", 700)
    .attr("height", sliderHeight)
    .append("g")
    .attr("transform", "translate(95, 10)");

  gRange.call(sliderRange);
}

init();
