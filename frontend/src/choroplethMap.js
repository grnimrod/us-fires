import {
  scaleSequentialLog,
  interpolateOranges,
  geoAlbersUsa,
  geoPath,
  select,
  max,
} from "d3";
import * as topojson from "topojson-client";
import { setUpContainer } from "./setUpContainer";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";

export async function createChoroplethMap(container, initialData) {
  const topoJsonData = await fetch(usAtlasUrl).then((response) =>
    response.json()
  );

  const { svg, containerWidth, containerHeight } = setUpContainer(container);
  svg.attr("preserveAspectRatio", "xMidYMid meet");

  // Domain of color scale starts at 1 instead of 0 to avoid log(0) = inf
  const color = scaleSequentialLog()
    .domain([
      1,
      max(initialData, (monthEntry) => {
        return max(monthEntry.states, (stateEntry) => stateEntry.count);
      }),
    ])
    .interpolator(interpolateOranges);

  // Map state names to FIPS numeric identifiers
  // If you give namemap a state name, it returns the state id
  // We have state names in our data, we have state ids in the topojson data
  const namemap = new Map(
    topoJsonData.objects.states.geometries.map((d) => [d.properties.name, d.id])
  );

  // Create a map linking each state ID to its fire count by flattening `initialData` to extract state entries with counts
  const valuemapForFirstEntry = new Map(
    initialData[0].states.map((stateEntry) => [
      namemap.get(stateEntry.state),
      stateEntry.count,
    ])
  );

  const projection = geoAlbersUsa().fitSize(
    [containerWidth, containerHeight],
    topojson.feature(topoJsonData, topoJsonData.objects.states)
  );
  const path = geoPath().projection(projection);

  const g = svg.append("g");

  const states = g
    .selectAll("path")
    .data(topojson.feature(topoJsonData, topoJsonData.objects.states).features)
    .join("path")
    .attr("d", path)
    .attr("fill", (d) => color(valuemapForFirstEntry.get(d.id)));

  g.append("path")
    .attr("fill", "none")
    .attr("stroke", "white")
    .attr("stroke-linejoin", "round")
    .attr("class", "state-borders")
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

  return {
    updateMap(data) {
      // Create map along similar principle as above, only for a single object of the data array (corresponding to data of a single month)
      const valuemapForEntry = new Map(
        data.states.map((stateEntry) => [
          namemap.get(stateEntry.state),
          stateEntry.count,
        ])
      );

      states
        .transition()
        .duration(100)
        .attr("fill", (d) => color(valuemapForEntry.get(d.id)));
    },
  };
}
