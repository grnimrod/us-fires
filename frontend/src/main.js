import {
  create,
  geoAlbersUsa,
  geoPath,
  geoBounds,
  select,
  selectAll,
  timeParse,
} from "d3";
import * as topojson from "topojson-client";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";
const firesJson = "../fires.json";

Promise.all([
  fetch(usAtlasUrl).then((response) => response.json()),
  fetch(firesJson).then((response) => response.json()),
]).then(([topoJsonData, firesData]) => {
  const containerWidth = select("#fig1").node().getBoundingClientRect().width;
  const containerHeight = select("#fig1").node().getBoundingClientRect().height;

  const svg = create("svg");
  // .attr("width", containerWidth)
  // .attr("height", containerHeight)
  // .attr("style", "max-width: 100%; height: auto;");

  const projection = geoAlbersUsa()
    .translate([containerWidth / 2, containerHeight / 2])
    .scale(600);

  const path = geoPath().projection(projection);

  // Calculate bounding box of the map data
  // const bounds = geoBounds(
  //   topojson.feature(topoJsonData, topoJsonData.objects.states)
  // );
  // const [[west, south], [east, north]] = bounds;

  // Calculate aspect ratio of the map
  // const mapWidth = east - west;
  // const mapHeight = north - south;

  // Set viewBox of SVG element based on bounding box to fit map correctly
  svg
    // .attr("viewBox", `${west} ${south} ${mapWidth} ${mapHeight}`)
    .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%");

  const g = svg.append("g");

  g.append("g")
    .attr("fill", "#ddd")
    .selectAll("path")
    .data(topojson.feature(topoJsonData, topoJsonData.objects.states).features)
    .join("path")
    .attr("d", path);

  g.append("path")
    .attr("fill", "none")
    .attr("stroke", "white")
    .attr("stroke-linejoin", "round")
    .attr(
      "d",
      path(
        topojson.mesh(
          topoJsonData,
          topoJsonData.objects.states,
          (a, b) => a !== b
        )
      )
    );

  // Filter data points where return of projection is null
  const validProjectedFires = firesData.filter((d) => {
    const projected = projection([d.LONGITUDE, d.LATITUDE]);
    return projected !== null;
  });

  // Parse date fields of fires data
  const parseDate = timeParse("%Y-%m-%d %H:%M:%S");

  validProjectedFires.forEach((d) => {
    d.DISCOVERY_DATE = parseDate(d.DISCOVERY_DATE);
    d.CONT_DATE = parseDate(d.CONT_DATE);
  });

  // Filter data of specific year, e.g. 2005
  const yearData = validProjectedFires.filter(
    (d) => d.DISCOVERY_DATE.getFullYear() === 2005
  );

  // Append fire data points as circles to SVG
  svg
    .selectAll("circle")
    .data(yearData)
    .join("circle")
    .attr("cx", (d) => projection([d.LONGITUDE, d.LATITUDE])[0])
    .attr("cy", (d) => projection([d.LONGITUDE, d.LATITUDE])[1])
    .attr("r", 2)
    .attr("fill", "blue")
    .attr("opacity", 0.5);

  // Append SVG element to the specific grid item
  // document.body.append(svg.node());
  select("#fig1").append(() => svg.node());
});
