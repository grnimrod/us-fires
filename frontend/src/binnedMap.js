import {
  geoAlbersUsa,
  geoPath,
  select,
  scaleSequentialLog,
  max,
  interpolateOranges,
  lab,
  timeFormat,
} from "d3";
import { hexbin } from "d3-hexbin";
import * as topojson from "topojson-client";
import { setUpContainer } from "./setUpContainer.js";
import { legend, legendVertical } from "./colorLegend";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";

export async function createBinnedMap(container, initialData, eventEmitter, zoom) {
  const topoJsonData = await fetch(usAtlasUrl).then((response) =>
    response.json()
  );
  const initialMonthlyStructure = initialData[0].monthlyStructure;

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
    .domain([1, max(initialData, (d) => d.totalFireCount)])
    .interpolator(interpolateOranges);

  const hexbinGenerator = hexbin()
    .extent([0, 0], [containerWidth, containerHeight])
    .radius(10)
    .x((d) => d[0])
    .y((d) => d[1]);

  const fireDataPoints = initialMonthlyStructure.children
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
    .attr("class", "hexbin")
    .selectAll("path")
    .data(bins)
    .join("path")
    .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
    .attr("d", (d) => hexbinGenerator.hexagon())
    .attr("fill", (d) => color(d.length))
    .attr("stroke", (d) => lab(color(d.length)).darker());

  select(container).append(() => svg.node());

  svg.call(
    zoom.extent([
        [0, 0],
        [containerWidth, containerHeight],
      ])
  );

  select("#zoomResetBtnBin").on("click", function () {
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
  });

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

  // let colorLegend = legend(
  //   scaleSequentialLog(
  //     [1, max(initialData, (d) => d.totalFireCount)],
  //     interpolateOranges
  //   ),
  //   svg,
  //   {
  //     title: "binned fire count",
  //     //className: "spiralLegend",
  //     //translateX: -220,
  //     //translateY: -230
  //   }
  // );

  let colorLegend = legendVertical({
    color: scaleSequentialLog(
        [1, max(initialData, (d) => d.totalFireCount)],
        interpolateOranges
      ),
    svg: svg
  })

  return {
    updateBinnedMap(newData) {
      hexGroup.selectAll("path").remove();

      const fireDataPoints = newData.monthlyStructure.children
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
        const monthLabel = timeFormat("%Y-%m")(newData.month);
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
