import {
  geoAlbersUsa,
  geoPath,
  select,
  min,
  max,
  geoIdentity,
  scaleSequentialLog,
  interpolateRdPu,
  zoom,
  pointer,
  scaleThreshold,
  timeFormat,
} from "d3";
import { contours } from "d3-contour";
import { legend } from "./colorLegend";
import { setUpContainer } from "./setUpContainer";
import * as topojson from "topojson-client";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";

// Define the grid resolution (number of cells in x and y directions)
let fireDataPoints;
let gridResolutionX = 500;
let gridResolutionY;
let tooltipIsoband;
let tooltipFire;
let prevZoomingScale = 1;
let allContours = {};

// Lookup table for Marching Squares - 16 configurations (0 to 15)
const lookupTable = [
  [], // 0: 0000, no line
  [[0, 0.5, 0.5, 1]], // 1: 0001
  [[0.5, 1, 1, 0.5]], // 2: 0010
  [[0, 0.5, 1, 0.5]], // 3: 0011
  [[0.5, 0, 1, 0.5]], // 4: 0100
  [
    [0, 0.5, 0.5, 0],
    [0.5, 1, 1, 0.5],
  ], // 5: 0101
  [
    [0.5, 0, 1, 0.5],
    [0.5, 1, 1, 0.5],
  ], // 6: 0110
  [[0, 0.5, 0.5, 0]], // 7: 0111
  [[0.5, 0, 0, 0.5]], // 8: 1000
  [
    [0.5, 0, 0, 0.5],
    [0.5, 1, 1, 0.5],
  ], // 9: 1001
  [
    [0.5, 0, 0, 0.5],
    [0, 0.5, 1, 0.5],
  ], // 10: 1010
  [
    [0.5, 1, 1, 0.5],
    [0.5, 0, 0, 0.5],
  ], // 11: 1011
  [
    [0.5, 0, 1, 0.5],
    [0, 0.5, 1, 0.5],
  ], // 12: 1100
  [[0, 0.5, 1, 0.5]], // 13: 1101
  [[0, 0.5, 0.5, 1]], // 14: 1110
  [], // 15: 1111, no line
];
// Marching square thresholds
const thresholds = [0.1, 0.5, 5, 20, 120, 500, 1000, 2000]; // Adjust these levels as needed
const colorScale = scaleSequentialLog()
  .domain([min(thresholds), max(thresholds)])
  .interpolator(interpolateRdPu);

export async function createIsoplethMap(container, initialData, eventEmitter) {
  const topoJsonData = await fetch(usAtlasUrl).then((response) =>
    response.json()
  );
  const { svg, containerWidth, containerHeight } = setUpContainer(container);
  svg.attr("preserveAspectRatio", "xMidYMid meet");
  const projection = geoAlbersUsa().fitSize(
    [containerWidth, containerHeight],
    topojson.feature(topoJsonData, topoJsonData.objects.states)
  );
  gridResolutionY = (gridResolutionX * containerHeight) / containerWidth;
  const path = geoPath().projection(projection);

  const g = svg.append("g");
  g.append("path")
    .attr("fill", "none")
    .attr("stroke", "#777")
    .attr("stroke-width", 0.5)
    .attr("stroke-linejoin", "round")
    .attr("class", "state-borders")
    .attr("d", path(topojson.mesh(topoJsonData, topoJsonData.objects.states)));

  g.append("path")
    .attr("fill", "none")
    .attr("stroke", "#777")
    .attr("stroke-width", 0.3)
    .attr("stroke-linejoin", "round")
    .attr("class", "county-borders")
    .attr("d", path(topojson.mesh(topoJsonData, topoJsonData.objects.counties)))
    .style("opacity", 0);

  fireDataPoints = initialData[0].children.map((fireEntry) => {
    const [x, y] = projection([fireEntry.LONGITUDE, fireEntry.LATITUDE]);
    return [
      x,
      y,
      fireEntry.FIRE_SIZE,
      fireEntry.FIRE_NAME,
      fireEntry.STATE,
      fireEntry.COUNTY,
      fireEntry.DISCOVERY_DATE?.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      fireEntry.CONT_DATE?.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    ];
  });

  // Define a tooltip div
  tooltipIsoband = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("padding", "6px")
    .style("background", "rgba(0,0,0,0.7)")
    .style("color", "#fff")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("opacity", 0);

  tooltipFire = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("padding", "6px")
    .style("background", "rgba(0,0,0,0.7)")
    .style("color", "#fff")
    .style("border-radius", "4px")
    .style("opacity", 0); // Hide it initially

  // Hide fire tooltip when clicking elsewhere
  d3.select("body").on("click", function () {
    tooltipFire.style("opacity", 0);
    d3.selectAll(".highlighted-point")
      .transition()
      .duration(200)
      .attr("r", 1)
      .attr("fill", "yellow")
      .attr("selected", false);
  });

  const z = zoom();

  svg.call(
    z
      .extent([
        [0, 0],
        [containerWidth, containerHeight],
      ])
      .scaleExtent([1, 12])
      .on("zoom", function zoomed(event, d) {
        g.attr("transform", event.transform);
        select("#map1 g").attr("transform", event.transform);
        select("#map2 g").attr("transform", event.transform);
        tooltipFire.style("opacity", 0);

        const currentZoomingScale = event.transform.k;
        if (currentZoomingScale > 2.5 && prevZoomingScale <= 2.5) {
          g.select(".county-borders").style("opacity", 1);
        }
        if (currentZoomingScale <= 2.5 && prevZoomingScale > 2.5) {
          g.select(".county-borders").style("opacity", 0);
        }
        prevZoomingScale = currentZoomingScale;
      })
  );

  d3.select("#zoomResetBtnIso").on("click", function () {
    svg.transition().duration(750).call(z.transform, d3.zoomIdentity);

    g.select(".county-borders").style("opacity", 0);
  });

  // This method computes and generates all contours, and store them locally
  //     It only needs to be called once
  const yearMonth =
    initialData[0].month.getFullYear() +
    "-" +
    (initialData[0].month.getMonth() + 1);

  loadAndDrawContours(
    containerWidth,
    containerHeight,
    gridResolutionX,
    gridResolutionY,
    yearMonth
  ).then((contours) => {
    drawIsolines(contours, g, containerWidth);
  });

  legend(
    scaleThreshold(
      thresholds,
      thresholds.map((v) => colorScale(v))
    ),
    svg,
    {
      title: "Fire Influence Index",
      tickSize: 0,
    }
  );

  select(container).append(() => svg.node());

  let isSliding = false;

  eventEmitter.on("slidingChange", (sliderState) => {
    isSliding = sliderState;
    if (!isSliding) {
      svg
        .select(".background-title")
        .transition()
        .duration(1000)
        .style("opacity", 0)
        .remove(); // Remove the background title when not sliding
    }
  });

  return {
    updateIsoplethMap(data) {
      fireDataPoints = data.children.map((fireEntry) => {
        const [x, y] = projection([fireEntry.LONGITUDE, fireEntry.LATITUDE]);
        return [
          x,
          y,
          fireEntry.FIRE_SIZE,
          fireEntry.FIRE_NAME,
          fireEntry.STATE,
          fireEntry.COUNTY,
          fireEntry.DISCOVERY_DATE?.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          fireEntry.CONT_DATE?.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
        ];
      });

      // Clear previous isopleths before redrawing
      g.selectAll(".isopleth").remove();
      g.selectAll(".isopleth-band").remove();
      g.selectAll(".isopleth-path").remove();
      g.selectAll(".highlighted-point").remove();

      const yearMonth =
        data.month.getFullYear() + "-" + (data.month.getMonth() + 1);

      loadAndDrawContours(
        containerWidth,
        containerHeight,
        gridResolutionX,
        gridResolutionY,
        yearMonth
      ).then((contours) => {
        drawIsolines(contours, g, containerWidth);
      });

      const backgroundText = svg.select(".background-title");
      if (isSliding) {
        const monthLabel = timeFormat("%Y-%m")(data.month);
        if (backgroundText.empty()) {
          svg
            .append("text")
            .attr("class", "background-title")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "3em")
            .attr("fill", "#ccc")
            .text(monthLabel);
        } else {
          backgroundText.text(monthLabel); // Update the text if it already exists
        }
      }
    },
  };
}

function drawIsolines(polygons, g, width) {
  g.selectAll("path.isopleth-band")
    .data(polygons)
    .enter()
    .append("path")
    .attr("class", "isopleth-band")
    .attr("d", geoPath(geoIdentity().scale(width / gridResolutionX)))
    .attr("fill", (d) => colorScale(d.value))
    .attr("stroke", "none")
    .on("mouseover", function (event, d) {
      // Show tooltip
      tooltipIsoband.transition().duration(200).style("opacity", 1);
      tooltipIsoband
        .html(`<strong>Fire Influence Threshold:</strong> ${d.value}`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 10 + "px");
    })
    .on("mousemove", function (event) {
      // Update tooltip position
      tooltipIsoband
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 10 + "px");
    })
    .on("mouseout", function () {
      tooltipIsoband.transition().duration(200).style("opacity", 0);
    })
    .on("mousedown", function (event) {
      const influencingFires = highlightInfluencingDataPoints(
        event,
        polygons,
        width / gridResolutionX
      );
      // console.log("High influencing fires %s", influencingFires);
      // Clear previous highlighted points
      g.selectAll(".highlighted-point").remove();
      // Plot the influencing points
      influencingFires.forEach(
        ([x, y, fireSize, fireName, state, county, startDate, contDate]) => {
          g.append("circle")
            .attr("class", "highlighted-point")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 1)
            .attr("fill", "yellow")
            .attr("stroke", "black")
            .attr("stroke-width", 0.25)
            .attr("cursor", "pointer")
            .on("mouseover", function (event, d) {
              d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 1.5)
                .attr("fill", "red");
            })
            .on("mouseout", function (event, d) {
              const fire = d3.select(this);
              if (fire.attr("selected") != "true") {
                fire
                  .transition()
                  .duration(200)
                  .attr("r", 1)
                  .attr("fill", "yellow");
              }
            })
            .on("click", function (event, d) {
              event.stopPropagation();

              d3.select(this)
                .attr("r", 1.5)
                .attr("fill", "red")
                .attr("selected", true);

              tooltipFire
                .style("left", event.pageX + 10 + "px")
                .style("top", event.pageY - 10 + "px")
                .style("opacity", 1).html(`
                                <strong>Fire Name:</strong> ${fireName}<br>
                                <strong>Fire Size:</strong> ${fireSize} acres<br>
                                <strong>State:</strong> ${state}<br>
                                <strong>County:</strong> ${county}<br>
                                <strong>Start Date:</strong> ${startDate}<br>
                                <strong>Contain Date:</strong> ${contDate}
                            `);
            });
        }
      );
    });

  g.selectAll("path.isopleth-path")
    .data(polygons)
    .enter()
    .append("path")
    .attr("class", "isopleth-path")
    .attr("d", geoPath(geoIdentity().scale(width / gridResolutionX)))
    .attr("fill", "none")
    .attr("stroke", "black") // Outline color
    .attr("stroke-width", 0.2);
}

async function loadAndDrawContours(
  width,
  height,
  gridResolutionX,
  gridResolutionY,
  yearMonth
) {
  if (Object.keys(allContours).length == 0) {
    try {
      const response = await fetch("../contours_by_months.json");
      allContours = await response.json();
    } catch (error) {
      console.error("Error loading JSON:", error);
      allContours = {};
    }
  }

  if (allContours[yearMonth]) {
    return allContours[yearMonth];
  }

  const polygons = await computeContours(
    width,
    height,
    gridResolutionX,
    gridResolutionY
  );
  allContours[yearMonth] = polygons;

  console.log("%s contours calculation finish", yearMonth);

  // Save the computed polygons at the end
  // if (yearMonth == "1995-1") {
  //     saveContoursToFile();
  // }
  // if (yearMonth == "2015-12") {
  //     saveContoursToFile();
  // }

  return polygons;
}

async function computeContours(
  width,
  height,
  gridResolutionX,
  gridResolutionY
) {
  // Create a 2D array for the grid
  const grid = [];
  // Initialize the grid with values influenced by fireSize and proximity
  for (let i = 0; i < gridResolutionY; i++) {
    // const row = [];
    for (let j = 0; j < gridResolutionX; j++) {
      const x = width * (j / gridResolutionX);
      const y = height * (i / gridResolutionY);
      // Initialize the cell value
      let value = 0;
      // Add contribution from each fire point, scaled by fire size and proximity
      fireDataPoints.forEach(([fx, fy, fireSize]) => {
        const dist = Math.hypot(fx - x, fy - y);
        const influence = Math.exp(-2 * dist); // Fire size influence diminishes with distance
        value += fireSize * influence; // Higher fire size has more influence
      });
      grid.push(value);
    }
  }

  const countoursGenerator = contours()
    .size([gridResolutionX, gridResolutionY])
    .thresholds(thresholds);
  const polygons = countoursGenerator(grid);

  return polygons;
}

function saveContoursToFile() {
  const jsonString = JSON.stringify(allContours, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "contours_by_months.json";
  link.click();
}

// Function to highlight influencing data points
function highlightInfluencingDataPoints(event, contourPolygons, scaleFactor) {
  let [clickX, clickY] = pointer(event);
  const clickedBand = contourPolygons
    .toReversed()
    .find((band) =>
      band.coordinates.some((c) =>
        d3.polygonContains(c[0], [clickX / scaleFactor, clickY / scaleFactor])
      )
    );
  const bandIndex = contourPolygons.indexOf(clickedBand);
  const bandValueLow = bandIndex > 0 ? thresholds[bandIndex] : 0;
  const bandValueHigh =
    bandIndex + 1 < thresholds.length
      ? thresholds[bandIndex + 1]
      : Number.MAX_SAFE_INTEGER;
  const influencingDataPoints = fireDataPoints.filter(([x, y, fireSize]) => {
    // Calculate the distance from the clicked point to the fire data point
    const dist = Math.sqrt(Math.pow(clickX - x, 2) + Math.pow(clickY - y, 2));
    // Calculate the contribution of this point based on distance and fire size
    const contribution = fireSize * Math.exp(-dist);
    // Set a threshold for significant contribution and filter accordingly
    // Adjust the threshold as needed for your dataset
    return (
      contribution >= bandValueLow / fireDataPoints.length &&
      contribution < bandValueHigh / fireDataPoints.length
    );
  });
  return influencingDataPoints;
}
