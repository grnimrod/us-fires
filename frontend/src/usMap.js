import { create, geoAlbersUsa, geoPath, select, selectAll } from "d3";
import * as topojson from "topojson-client";
import {
  fetchFiresData,
  cleanFiresData,
  filterPerYear,
} from "./prepareFiresData";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";

export function createMapFigure(container) {
  Promise.all([
    fetch(usAtlasUrl).then((response) => response.json()),
    fetchFiresData(),
  ]).then(([topoJsonData, firesData]) => {
    const containerWidth = select(container)
      .node()
      .getBoundingClientRect().width;
    const containerHeight = select(container)
      .node()
      .getBoundingClientRect().height;

    const projection = geoAlbersUsa()
      .translate([containerWidth / 2, containerHeight / 2])
      .scale(600);
    const path = geoPath().projection(projection);

    const svg = create("svg");

    svg
      .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "100%");

    const g = svg.append("g");

    g.append("g")
      .attr("fill", "#ddd")
      .selectAll("path")
      .data(
        topojson.feature(topoJsonData, topoJsonData.objects.states).features
      )
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

    const cleanData = cleanFiresData(firesData);
    const yearData = filterPerYear(cleanData, 2005);

    // Append fire data points as circles to SVG
    svg
      .selectAll("circle")
      .data(yearData)
      .join("circle")
      .attr("cx", (d) => projection([d.LONGITUDE, d.LATITUDE])[0])
      .attr("cy", (d) => projection([d.LONGITUDE, d.LATITUDE])[1])
      .attr("r", 2)
      .attr("fill", "orange")
      .attr("opacity", 0.5);

    // Append SVG element to the specific grid item
    select(container).append(() => svg.node());
  });
}
