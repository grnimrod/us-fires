import {
  geoAlbersUsa,
  geoPath,
  select,
  scaleSequentialLog,
  max,
  interpolateOranges,
  lab,
  zoom,
  timeFormat,
} from "d3";
import { hexbin } from "d3-hexbin";
import * as topojson from "topojson-client";
import { setUpContainer } from "./setUpContainer.js";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";

export async function createBinnedMap(container, initialData, eventEmitter) {
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

  const fireDataPoints = initialData[0].children
    .filter((d) => {
      const projected = projection([d.LONGITUDE, d.LATITUDE]);
      return projected !== null;
    })
    .map((fireEntry) => {
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

  const z = zoom();

  svg.call(
    z
      .extent([
        [0, 0],
        [containerWidth, containerHeight],
      ])
      .scaleExtent([1, 8])
      .on("zoom", function zoomed(event, d) {
        g.attr("transform", event.transform);
        hexGroup.attr("transform", event.transform);
      })
  );

  let isSliding = false;

  eventEmitter.on("slidingChange", (sliderState) => {
    isSliding = sliderState;
    if (!isSliding) {
      svg
        .select(".background-title")
        .transition()
        .duration(1000)
        .style("opacity", 0)
        .remove(); // Remove the background title when not sliding
    }
  });

  d3.select("#zoomResetBtnBin").on("click", function () {
    svg.transition().duration(750).call(z.transform, d3.zoomIdentity);
  });

  return {
    updateBinnedMap(data) {
      hexGroup.selectAll("path").remove();

      const fireDataPoints = data.children
        .filter((d) => {
          const projected = projection([d.LONGITUDE, d.LATITUDE]);
          return projected !== null;
        })
        .map((fireEntry) => {
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

      const backgroundText = svg.select(".background-title");
      if (isSliding) {
        const monthLabel = timeFormat("%Y-%m")(data.month);
        if (backgroundText.empty()) {
          svg
            .append("text")
            .attr("class", "background-title")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "3em")
            .attr("fill", "#ccc")
            .text(monthLabel);
        } else {
          backgroundText.text(monthLabel); // Update the text if it already exists
        }
      }
    },
  };
}
