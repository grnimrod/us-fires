import { timeFormat, select } from "d3";
import { sliderBottom } from "d3-simple-slider";
import { createBinnedMap } from "./binnedMap.js";
import { createChoroplethMap } from "./choroplethMap.js";
import { createIsoplethMap } from "./isoplethMap";
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

  document.querySelector("#map2").style.visibility = "hidden";
  document.querySelector("#map3").style.visibility = "hidden";

  const binnedMap = await createBinnedMap("#map1", monthStructure);
  const choroplethMap = await createChoroplethMap(
    "#map2",
    monthlyFiresPerState
  );
  const isoplethMap = await createIsoplethMap("#map3", monthStructure);

  // const binnedMap = await createBinnedMap("#fig1", monthStructure);
  // const choroplethMap = await createChoroplethMap(
  //   "#fig2",
  //   monthlyFiresPerState
  // );
  // const isoplethMap = await createIsoplethMap("#fig5", monthStructure);
  // // Initially hide choroplethMap container since binnedMap is selected by default
  // document.querySelector("#fig2").style.display = "none";
  // document.querySelector("#fig5").style.display = "none";

  const sunburstChart = createSunburstChart("#fig3", monthlyFireCategoriesData);
  const spiralHeatmap = createSpiralHeatmap("#fig4", monthlyFiresCount);
  spiralHeatmap.updateHeatmap();

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
      document.querySelector("#map1").style.visibility = "visible";
      document.querySelector("#map2").style.visibility = "hidden";
      document.querySelector("#map3").style.visibility = "hidden";
      currentChart = "binnedMap";
    } else if (selectedChart === "choroplethMap") {
      document.querySelector("#map1").style.visibility = "hidden";
      document.querySelector("#map2").style.visibility = "visible";
      document.querySelector("#map3").style.visibility = "hidden";
      currentChart = "choroplethMap";
    } else if (selectedChart === "isoplethMap") {
      document.querySelector("#map1").style.visibility = "hidden";
      document.querySelector("#map2").style.visibility = "hidden";
      document.querySelector("#map3").style.visibility = "visible";
      currentChart = "isoplethMap";
    }

    // if (selectedChart === "binnedMap") {
    //   document.querySelector("#fig1").style.display = "block";
    //   document.querySelector("#fig2").style.display = "none";
    //   document.querySelector("#fig5").style.display = "none";
    //   currentChart = "binnedMap";
    // } else if (selectedChart === "choroplethMap") {
    //   document.querySelector("#fig1").style.display = "none";
    //   document.querySelector("#fig2").style.display = "block";
    //   document.querySelector("#fig5").style.display = "none";
    //   currentChart = "choroplethMap";
    // } else if (selectedChart === "isoplethMap") {
    //   document.querySelector("#fig1").style.display = "none";
    //   document.querySelector("#fig2").style.display = "none";
    //   document.querySelector("#fig5").style.display = "block";
    //   currentChart = "isoplethMap";
    // }
  });

  // Set up play button functionality
  let isSliding = false;
  let timer;

  const playButton = select("#play-button");

  playButton.on("click", function () {
    if (playButton.text() == "Pause") {
      resetTimer();
    } else if (playButton.text() == "Restart") {
      isSliding = true;
      sliderRange.value(0);
      timer = setInterval(update, 50);
      playButton.text("Pause");
    } else {
      isSliding = true;
      timer = setInterval(update, 50);
      playButton.text("Pause");
    }
  });

  function update() {
    const offset = sliderRange.value() + 1;

    if (offset >= months.length) {
      resetTimer();
      playButton.text("Restart");
    } else {
      sliderRange.value(offset);
      // sliderRange.on("onchange")(offset);
    }
  }

  function resetTimer() {
    isSliding = false;
    clearInterval(timer);
    playButton.text("Play");
  }

  sliderRange.on("end", function () {
    if (sliderRange.value() == sliderRange.max()) {
      playButton.text("Restart");
      sliderRange.value(sliderRange.max());
    } else if (playButton.text() == "Pause") {
      resetTimer();
    }
  });

  sliderRange.on("onchange", (val) => {
    spiralHeatmap.updateHeatmap(monthlyFiresCount[val]);
    binnedMap.updateBinnedMap(monthStructure[val]);
    choroplethMap.updateMap(monthlyFiresPerState[val]);
    sunburstChart.updateSunburst(monthlyFireCategoriesData[val]);
    // This is for performance concern. Simultaneouly updating the invisible isopleth map will block the main thread
    // TODO: Remove this if condition when performance optmization is done
    if (document.querySelector("#map3").style.visibility != "hidden") {
      isoplethMap.updateIsoplethMap(monthStructure[val]);
    }
  });

  const gRange = select(sliderContainer)
    .append("svg")
    .attr("class", "slider")
    .attr("width", 700)
    .attr("height", sliderHeight)
    .append("g")
    .attr("transform", "translate(95, 10)");

  gRange.call(sliderRange);
}

init();
