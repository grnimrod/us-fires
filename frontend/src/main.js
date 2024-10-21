import { create, geoPath, geoBounds, selectAll } from "d3";
import * as topojson from "topojson-client";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-albers-10m.json"; // data is already Albers projected, no need to create separate projection
const firesJson = "../fires.json";

Promise.all([
  fetch(usAtlasUrl).then((response) => response.json()),
  fetch(firesJson).then((response) => response.json()),
]).then(([topoJsonData, firesData]) => {
  console.log(firesData);
  const width = window.innerWidth;
  const height = window.innerHeight;

  const svg = create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto;");

  const path = geoPath();

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

  // Append SVG element to the body
  document.body.append(svg.node());
});
