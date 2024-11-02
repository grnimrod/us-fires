import {
  scaleSequential,
  interpolateOranges,
  geoAlbersUsa,
  geoPath,
  select,
  max,
} from "d3";
import * as topojson from "topojson-client";
import { setUpContainer } from "./setUpContainer";
import { countFiresPerState } from "./prepareFiresData";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";

export async function createChoroplethMap(container, cleanData) {
  const topoJsonData = await fetch(usAtlasUrl).then((response) =>
    response.json()
  );

  const firesPerState = countFiresPerState(cleanData);
  const { svg, containerWidth, containerHeight } = setUpContainer(container);
  svg.attr("preserveAspectRatio", "xMidYMid meet");

  const color = scaleSequential()
    .domain([0, max(firesPerState, (d) => d.count)])
    .interpolator(interpolateOranges);

  // Map state names to FIPS numeric identifiers
  const namemap = new Map(
    topoJsonData.objects.states.geometries.map((d) => [d.properties.name, d.id])
  );

  const valuemap = new Map(
    firesPerState.map((d) => [namemap.get(d.state), d.count])
  );

  const g = svg.append("g");

  const states = g
    .selectAll("path")
    .data(topojson.feature(topoJsonData, topoJsonData.objects.states).features)
    .join("path")
    .attr(
      "d",
      geoPath().projection(
        geoAlbersUsa().fitSize(
          [containerWidth, containerHeight],
          topojson.feature(topoJsonData, topoJsonData.objects.states)
        )
      )
    )
    .attr("fill", (d) => color(valuemap.get(d.id)));

  select(container).append(() => svg.node());

  return {
    updateMap(filteredData) {
      const firesPerState = countFiresPerState(filteredData);

      const color = scaleSequential()
        .domain([0, max(firesPerState, (d) => d.count)])
        .interpolator(interpolateOranges);

      states
        .transition()
        .duration(100)
        .attr("fill", (d) =>
          color(
            firesPerState.find((fire) => namemap.get(fire.state) === d.id)
              ?.count || 0
          )
        );
    },
  };
}
