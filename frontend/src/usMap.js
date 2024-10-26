import { geoAlbersUsa, geoPath, select, selectAll } from "d3";
import * as topojson from "topojson-client";
import {
  fetchFiresData,
  cleanFiresData,
  filterPerYear,
} from "./prepareFiresData";
import { setUpContainer } from "./setUpContainer";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";

export function createMapFigure(container) {
  Promise.all([
    fetch(usAtlasUrl).then((response) => response.json()),
    fetchFiresData(),
  ]).then(([topoJsonData, firesData]) => {
    // Obtain data in necessary shape
    const cleanData = cleanFiresData(firesData);
    const yearData = filterPerYear(cleanData, 2005);

    const { svg, containerWidth, containerHeight } = setUpContainer(container);

    svg.attr("preserveAspectRatio", "xMidYMid meet");

    // Set up map, draw out states
    const projection = geoAlbersUsa()
      .translate([containerWidth / 2, containerHeight / 2])
      .scale(600);
    const path = geoPath().projection(projection);

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

    // Append fire data points as circles to SVG on top of the map
    svg
      .selectAll("circle")
      .data(yearData)
      .join("circle")
      .attr("cx", (d) => projection([d.LONGITUDE, d.LATITUDE])[0])
      .attr("cy", (d) => projection([d.LONGITUDE, d.LATITUDE])[1])
      .attr("r", 2)
      .attr("fill", "#943126")
      .attr("opacity", 0.5);

    // Append SVG element to the specific grid item
    select(container).append(() => svg.node());
  });
}
