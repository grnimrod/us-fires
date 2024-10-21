import {
  create,
  geoAlbersUsa,
  geoPath,
  geoBounds,
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
  const width = window.innerWidth;
  const height = window.innerHeight;

  const svg = create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto;");

  const projection = geoAlbersUsa()
    .translate([width / 2, height / 2])
    .scale(800);

  const path = geoPath().projection(projection);

  // Calculate bounding box of the map data
  const bounds = geoBounds(
    topojson.feature(topoJsonData, topoJsonData.objects.states)
  );
  const [[west, south], [east, north]] = bounds;

  // Calculate aspect ratio of the map
  const mapWidth = east - west;
  const mapHeight = north - south;

  // Set viewBox of SVG element based on bounding box to fit map correctly
  svg
    .attr("viewBox", `${west} ${south} ${mapWidth} ${mapHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

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

  console.log(yearData);

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

  // Append SVG element to the body
  document.body.append(svg.node());
});
