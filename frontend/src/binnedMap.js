import {
  geoAlbersUsa,
  geoPath,
  select,
  scaleSequentialLog,
  max,
  interpolateOranges,
  lab,
} from "d3";
import { hexbin } from "d3-hexbin";
import * as topojson from "topojson-client";
import { setUpContainer } from "./setUpContainer";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";

export async function createBinnedMap(container, initialData) {
  const topoJsonData = await fetch(usAtlasUrl).then((response) =>
    response.json()
  );

  const { svg, containerWidth, containerHeight } = setUpContainer(container);
  svg.attr("preserveAspectRatio", "xMidYMid meet");

  const projection = geoAlbersUsa().fitSize(
    [containerWidth, containerHeight],
    topojson.feature(topoJsonData, topoJsonData.objects.states)
  );
  const path = geoPath().projection(projection);

  const g = svg.append("g");

  //   const states = g
  //     .selectAll("path")
  //     .data(topojson.feature(topoJsonData, topoJsonData.objects.states).features)
  //     .join("path")
  //     .attr("d", path)
  //     .attr("fill", "#e5e8e8");

  g.append("path")
    .attr("fill", "none")
    .attr("stroke", "#777")
    .attr("stroke-width", 0.5)
    .attr("stroke-linejoin", "round")
    .attr("class", "state-borders")
    .attr("d", path(topojson.mesh(topoJsonData, topoJsonData.objects.states)));

  const color = scaleSequentialLog()
    .domain([1, max(initialData, (d) => d.children.length)])
    .interpolator(interpolateOranges);

  const hexbinGenerator = hexbin()
    .extent([0, 0], [containerWidth, containerHeight])
    .radius(10)
    .x((d) => d[0])
    .y((d) => d[1]);

  const fireDataPoints = initialData[0].children.map((fireEntry) => {
    const [x, y] = projection([fireEntry.LONGITUDE, fireEntry.LATITUDE]);
    return [x, y]; // Return the coordinates
  });

  const bins = hexbinGenerator(fireDataPoints);

  // Append hexagons
  const hexGroup = svg.append("g");

  hexGroup
    .selectAll("path")
    .data(bins)
    .join("path")
    .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
    .attr("d", (d) => hexbinGenerator.hexagon())
    .attr("fill", (d) => color(d.length))
    .attr("stroke", (d) => lab(color(d.length)).darker());

  select(container).append(() => svg.node());

  return {
    updateBinnedMap(data) {
      hexGroup.selectAll("path").remove();

      const fireDataPoints = data.children.map((fireEntry) => {
        const [x, y] = projection([fireEntry.LONGITUDE, fireEntry.LATITUDE]);
        return [x, y];
      });

      const bins = hexbinGenerator(fireDataPoints);

      hexGroup
        .selectAll("path")
        .data(bins)
        .join("path")
        .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
        .attr("d", (d) => hexbinGenerator.hexagon())
        .attr("fill", (d) => color(d.length))
        .attr("stroke", (d) => lab(color(d.length)).darker());
    },
  };
}
