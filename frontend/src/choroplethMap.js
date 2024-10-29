import {
  scaleQuantize,
  schemeOranges,
  geoAlbersUsa,
  geoPath,
  select,
} from "d3";
import * as topojson from "topojson-client";
import {
  fetchFiresData,
  cleanFiresData,
  countFiresPerState,
} from "./prepareFiresData";
import { setUpContainer } from "./setUpContainer";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";

export function createChoroplethMap(container) {
  Promise.all([
    fetch(usAtlasUrl).then((response) => response.json()),
    fetchFiresData(),
  ]).then(([topoJsonData, firesData]) => {
    const cleanData = cleanFiresData(firesData);
    const firesPerState = countFiresPerState(cleanData);

    const { svg, containerWidth, containerHeight } = setUpContainer(container);
    svg.attr("preserveAspectRatio", "xMidYMid meet");

    const minCount = Math.min(...firesPerState.map((d) => d.count));
    const maxCount = Math.max(...firesPerState.map((d) => d.count));
    const color = scaleQuantize([minCount, maxCount], schemeOranges[9]);

    // Map state names to FIPS numeric identifiers
    const namemap = new Map(
      topoJsonData.objects.states.geometries.map((d) => [
        d.properties.name,
        d.id,
      ])
    );

    const valuemap = new Map(
      firesPerState.map((d) => [namemap.get(d.state), d.count])
    );

    // Set up map, draw out states
    const projection = geoAlbersUsa().fitSize(
      [containerWidth, containerHeight],
      topojson.feature(topoJsonData, topoJsonData.objects.states)
    );
    const path = geoPath().projection(projection);

    const g = svg.append("g");

    g.append("g")
      .selectAll("path")
      .data(
        topojson.feature(topoJsonData, topoJsonData.objects.states).features
      )
      .join("path")
      .attr("fill", (d) => color(valuemap.get(d.id)))
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

    select(container).append(() => svg.node());
  });
}
