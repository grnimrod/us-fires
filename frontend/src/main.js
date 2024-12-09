import { timeFormat, select, zoom } from "d3";
import { sliderBottom } from "d3-simple-slider";
import { createBinnedMap } from "./binnedMap.js";
import { createChoroplethMap } from "./choroplethMap.js";
import { createIsoplethMap, handleIsoplethSpecificZoom } from "./isoplethMap";
import { createSunburstChart } from "./sunburstChart.js";
import { createHistogram } from "./histTimeline.js";
import { createSpiralHeatmap } from "./spiralHeatmap.js";
import {
  fetchFiresData,
  cleanFiresData,
  prepareUnifiedMonthlyData,
} from "./prepareFiresData.js";

class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach((listener) => listener(data));
    }
  }
}

const menuOptions = [
  { value: "binnedMap", text: "Binned Map" },
  { value: "choroplethMap", text: "Choropleth Map" },
  { value: "isoplethMap", text: "Isopleth Map" },
];

let currentTransform = d3.zoomIdentity;  // Global zoom state shared across maps

async function init() {
  const rawData = await fetchFiresData();
  const cleanData = cleanFiresData(rawData);
  const firesData = prepareUnifiedMonthlyData(cleanData);

  const dashboardState = {
    sliderIndex: 0,
    filterCategory: null,
    data: {
      fullData: [],
      filteredData: null,
    },
    applyFilter(selectedCategory) {
      if (!selectedCategory) {
        this.data.filteredData = null; // Clear filter
        return;
      }

      // Apply filtering logic to fullData
      this.data.filteredData = this.data.fullData.map((monthData) => {
        // Filter children based on the selectedCategory
        const filteredChildren = monthData.monthlyStructure.children.filter(
          (fire) =>
            fire.CAUSE_CATEGORY === selectedCategory ||
            fire.STAT_CAUSE_DESCR === selectedCategory
        );

        // Recalculate state counts based on filtered children
        const filteredStateCounts = monthData.stateCounts.map((state) => {
          const filteredStateCount = filteredChildren.filter(
            (fire) => fire.STATE_NAME === state.state
          ).length;

          return {
            state: state.state,
            count: filteredStateCount,
          };
        });

        // Return a new monthData object with updated attributes
        return {
          ...monthData,
          monthlyStructure: {
            ...monthData.monthlyStructure,
            children: filteredChildren, // Replace children with filtered children
          },
          stateCounts: filteredStateCounts, // Update state counts
          totalFireCount: filteredChildren.length, // Update total fire count
        };
      });
    },
    getActiveFullData() {
      if (this.filterCategory) {
        return this.data.filteredData;
      }
      return this.data.fullData;
    },
    getActiveMonthData() {
      if (this.filterCategory) {
        return this.data.filteredData[this.sliderIndex];
      }
      return this.data.fullData[this.sliderIndex];
    },
  };

  dashboardState.data.fullData = firesData;
  const activeData = dashboardState.getActiveFullData();

  let currentChart = "binnedMap";

  document.querySelector("#map2").style.visibility = "hidden";
  document.querySelector("#map3").style.visibility = "hidden";

  const eventEmitter = new EventEmitter();
  let isSliding = false;

  const dropdownSelection = select("#dropdown-container");

  const menu = dropdownSelection
    .selectAll("select")
    .data([null])
    .join("select")
    .attr("class", "form-select")
    .on("change", (event) => {
      eventEmitter.emit("menuChange", event.target.value);
    });

  const z = zoom()
    .scaleExtent([1, 12])
    .on("zoom", function zoomed(event) {
        currentTransform = event.transform;  // Update the shared zoom state
        // Apply the transform to all maps
        d3.select('#map1 g').attr("transform", currentTransform);
        d3.select('#map1 .hexbin').attr("transform", currentTransform);
        d3.select('#map2 g').attr("transform", currentTransform);
        d3.select('#map3 g').attr("transform", currentTransform);

        const currentZoomMap = select(this).node().parentNode.id
        if (currentZoomMap === "map3") {
          handleIsoplethSpecificZoom(event);
        }
    });

  menu
    .selectAll("option")
    .data(menuOptions)
    .join("option")
    .attr("value", (option) => option.value)
    .text((option) => option.text);

  eventEmitter.on("menuChange", (selectedMap) => {
    currentChart = selectedMap;

    document.querySelector("#map1").style.visibility = "hidden";
    document.querySelector("#map2").style.visibility = "hidden";
    document.querySelector("#map3").style.visibility = "hidden";

    // Show the selected map
    switch (selectedMap) {
      case "binnedMap":
        document.querySelector("#map1").style.visibility = "visible";
        select("#map1 svg").transition().duration(750).call(z.transform, currentTransform);
        break;
      case "choroplethMap":
        document.querySelector("#map2").style.visibility = "visible";
        select("#map2 svg").transition().duration(750).call(z.transform, currentTransform);
        break;
      case "isoplethMap":
        document.querySelector("#map3").style.visibility = "visible";
        select("#map3 svg").transition().duration(750).call(z.transform, currentTransform);
        break;
    }
  });

  eventEmitter.emit("menuChange", menuOptions[0].value);

  const binnedMap = await createBinnedMap("#map1", firesData, eventEmitter, z);
  const choroplethMap = await createChoroplethMap(
    "#map2",
    firesData,
    eventEmitter,
    z
  );
  const isoplethMap = await createIsoplethMap("#map3", firesData, eventEmitter, z, currentTransform);

  const sunburstChart = createSunburstChart("#fig4", firesData, eventEmitter);

  eventEmitter.on("categorySelected", (selectedCategory) => {
    dashboardState.filterCategory = selectedCategory;
    dashboardState.applyFilter(selectedCategory);
    updateCharts();
  });

  eventEmitter.on("resetData", () => {
    dashboardState.filterCategory = null;
    updateCharts();
  });

  function updateCharts() {
    const activeFullData = dashboardState.getActiveFullData();
    const activeMonthData = dashboardState.getActiveMonthData();

    histTimeline.updateHistFilteredData(activeFullData);
    binnedMap.updateBinnedMap(activeMonthData);
    choroplethMap.updateMap(activeMonthData);
    sunburstChart.updateSunburst(activeMonthData);
    // TODO: Download the contours file at https://drive.google.com/file/d/19pf5xAQeCj7YhtUh9SNzhPWUhu77sB71/view
    //  And uncomment the below line
    // isoplethMap.updateIsoplethMap(activeMonthData);
    spiralHeatmap.updateHeatmap(activeFullData);
  }

  const histTimeline = createHistogram("#histogram-timeline", firesData);

  // Create slider and set up interactions
  const sliderDiv = select("#slider");
  const sliderDivWidth = sliderDiv.node().getBoundingClientRect().width;

  const numTicks = 6;
  const tickInterval = Math.floor((firesData.length - 1) / (numTicks - 1));

  const tickValues = Array.from(
    { length: numTicks },
    (_, i) => i * tickInterval
  );

  const sliderRange = sliderBottom()
    .min(0)
    .max(firesData.length - 1)
    .step(1)
    .width(sliderDivWidth - 96.028)
    .tickValues(tickValues)
    .tickFormat((i) => timeFormat("%Y-%m")(firesData[i].month))
    .ticks(numTicks);

  const spiralHeatmap = createSpiralHeatmap("#fig3", firesData, sliderRange);
  //spiralHeatmap.updateHeatmapSelection();

  // Set up play/pause button functionality
  let timer;

  const playButton = select("#play-button");

  playButton.on("click", function () {
    if (playButton.text() == "Pause") {
      resetTimer();
    } else if (playButton.text() == "Restart") {
      isSliding = true;
      sliderRange.value(0);
      timer = setInterval(update, 150);
      playButton.text("Pause");
      eventEmitter.emit("slidingChange", isSliding);
    } else {
      isSliding = true;
      timer = setInterval(update, 150);
      playButton.text("Pause");
      eventEmitter.emit("slidingChange", isSliding);
    }
  });

  function update() {
    const offset = sliderRange.value() + 1;

    if (offset >= firesData.length) {
      resetTimer();
      playButton.text("Restart");
    } else {
      sliderRange.value(offset);
    }
  }

  function resetTimer() {
    isSliding = false;
    clearInterval(timer);
    playButton.text("Play");
    eventEmitter.emit("slidingChange", isSliding);
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
    dashboardState.sliderIndex = val;

    updateCharts();
  });

  const gRange = sliderDiv
    .append("svg")
    .attr("class", "slider")
    .attr("width", sliderDivWidth)
    .attr("height", 100)
    .append("g")
    .attr("transform", "translate(40, 10)");

  gRange.call(sliderRange);
}

init();
