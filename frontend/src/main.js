import { create, geoPath, selectAll } from "d3";
import * as topojson from "topojson-client";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-albers-10m.json"; // data is already Albers projected, no need to create separate projection

// Fetch the map data
fetch(usAtlasUrl)
  .then((response) => response.json())
  .then((topoJsonData) => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    const path = geoPath();

    const g = svg.append("g");

    g.append("g")
      .attr("fill", "#444")
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

    // Append SVG element to the body
    document.body.append(svg.node());
  });
