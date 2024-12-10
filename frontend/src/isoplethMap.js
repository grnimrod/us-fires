import {
  geoAlbersUsa,
  geoPath,
  select,
  min,
  max,
  scaleSequentialLog,
  interpolateRdPu,
  pointer,
  scaleThreshold,
  timeFormat,
  geoTransform,
} from "d3";
import { contours } from "d3-contour";
import { legend } from "./colorLegend";
import { setUpContainer } from "./setUpContainer";
import * as topojson from "topojson-client";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";
const isoplethMapStandardWidth = 643.6;
const isoplethMapStandardHeight = 267.2;

// Define the grid resolution (number of cells in x and y directions)
let fireDataPoints;
let gridResolutionX = 500;
let gridResolutionY = 300;
let tooltipIsoband;
let tooltipFire;
let prevZoomingScale = 1;
let allContours = {};

// Marching square thresholds
const thresholds = [0.1, 0.5, 5, 20, 120, 500, 1000, 2000]; // Adjust these levels as needed
const colorScale = scaleSequentialLog()
  .domain([min(thresholds), max(thresholds)])
  .interpolator(interpolateRdPu);

export async function createIsoplethMap(container, initialData, eventEmitter, zoom, currentTransform) {
  const topoJsonData = await fetch(usAtlasUrl).then((response) =>
    response.json()
  );
  const initialMonthlyStructure = initialData[0].monthlyStructure;

  const { svg, containerWidth, containerHeight } = setUpContainer(container);
  svg.attr("preserveAspectRatio", "xMidYMid meet");

  const projection = geoAlbersUsa().fitSize(
    [containerWidth, containerHeight],
    topojson.feature(topoJsonData, topoJsonData.objects.states)
  );
//   gridResolutionY = (gridResolutionX * isoplethMapStandardHeight) / isoplethMapStandardWidth;
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

  fireDataPoints = initialMonthlyStructure.children
    .filter((d) => {
        const projected = projection([d.LONGITUDE, d.LATITUDE]);
        return projected !== null;
    })
    .map((fireEntry) => {
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
    // d3.selectAll(".highlighted-point")
    //   .transition()
    //   .duration(200)
    //   .attr("r", 1)
    //   .attr("fill", "yellow")
    //   .attr("selected", false);
  });

  // Clicking on map removes highlighted fires
  svg.on("mousedown", function () {
    d3.selectAll(".highlighted-point").remove();
  })

  svg.call(
    zoom.extent([
        [0, 0],
        [containerWidth, containerHeight],
      ])
  );

  d3.select("#zoomResetBtnIso").on("click", function () {
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);

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
    drawIsolines(contours, g, containerWidth, containerHeight);
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
    updateIsoplethMap(newData) {
      fireDataPoints = newData.monthlyStructure.children
      .filter((d) => {
        const projected = projection([d.LONGITUDE, d.LATITUDE]);
        return projected !== null;
        })
      .map((fireEntry) => {
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
        newData.month.getFullYear() + "-" + (newData.month.getMonth() + 1);

      loadAndDrawContours(
        containerWidth,
        containerHeight,
        gridResolutionX,
        gridResolutionY,
        yearMonth
      ).then((contours) => {
        drawIsolines(contours, g, containerWidth, containerHeight);
      });

      const backgroundText = svg.select(".background-title");
      if (isSliding) {
        const monthLabel = timeFormat("%Y-%m")(newData.month);
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

function drawIsolines(polygons, g, width, height) {
    const xScaleFactor = isoplethMapStandardWidth / gridResolutionX;
    const yScaleFactor = isoplethMapStandardHeight / gridResolutionY;
    const scaleFactor = Math.max(height/isoplethMapStandardHeight, width/isoplethMapStandardWidth);
    console.log("width %s height %s resoX %s resoY %s xScale %s yScale %s scaleWidth %s scaleHeight %s", width, height, gridResolutionX, gridResolutionY, xScaleFactor, yScaleFactor, width/isoplethMapStandardWidth, height/isoplethMapStandardHeight);
    const xOffset = (width - isoplethMapStandardWidth * scaleFactor) / 2;
    const yOffset = (height - isoplethMapStandardHeight * scaleFactor) / 2;
    // const pathGenerator = geoPath(geoTransform({
    //     point: function(x, y) {
    //         this.stream.point(x * xScaleFactor*scaleFactor, y * yScaleFactor*scaleFactor)
    //     }
    // }))
    const pathGenerator = geoPath(geoTransform({
        point: function(x, y) {
            this.stream.point(
                (x * xScaleFactor * scaleFactor) + xOffset,
                (y * yScaleFactor * scaleFactor) + yOffset 
            );
        }
    }));
    

  g.selectAll("path.isopleth-band")
    .data(polygons)
    .enter()
    .append("path")
    .attr("class", "isopleth-band")
    .attr("d", pathGenerator)
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
      event.stopPropagation();

      const influencingFires = highlightInfluencingDataPoints(
        event,
        polygons,
        xScaleFactor,
        yScaleFactor,
        scaleFactor,
        xOffset,
        yOffset
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
            .on("mousedown", function (event) {
              event.stopPropagation();
            })
            .on("click", function (event, d) {
              event.stopPropagation();

              d3.selectAll(".highlighted-point")
                .attr("r", 1)
                .attr("fill", "yellow")
                .attr("selected", false);

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
    .attr("d", pathGenerator)
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
function highlightInfluencingDataPoints(event, contourPolygons, xScale, yScale, scaleFactor, xOffset, yOffset) {
  let [clickX, clickY] = pointer(event);
  const clickedBand = contourPolygons
    .toReversed()
    .find((band) =>
      band.coordinates.some((c) =>
        d3.polygonContains(c[0], [(clickX-xOffset)/xScale/scaleFactor, (clickY-yOffset)/yScale/scaleFactor])
      )
    );
  const bandIndex = contourPolygons.indexOf(clickedBand);
  const bandValueLow = bandIndex > 0 ? thresholds[bandIndex] : 0;
  const bandValueHigh =
    bandIndex + 1 < thresholds.length
      ? thresholds[bandIndex + 1]
      : Number.MAX_SAFE_INTEGER;
  // console.log("Band index %s valueLow %s valueHigh %s", bandIndex, bandValueLow, bandValueHigh);
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

export function handleIsoplethSpecificZoom(event) {
    const currentZoomingScale = event.transform.k;
    if (currentZoomingScale > 2.5 && prevZoomingScale <= 2.5) {
      select("#map3 .county-borders").style("opacity", 1);
    }
    if (currentZoomingScale <= 2.5 && prevZoomingScale > 2.5) {
      select("#map3 .county-borders").style("opacity", 0);
    }
    prevZoomingScale = currentZoomingScale;
}
