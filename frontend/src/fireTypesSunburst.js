import {
  select,
  scaleOrdinal,
  quantize,
  interpolateRainbow,
  partition,
  hierarchy,
  arc,
} from "d3";
import { setUpContainer } from "./setUpContainer";

export function createSunburstChart(container, monthlyData) {
  const initialData = monthlyData[0].categories;

  const { svg, containerWidth, containerHeight } = setUpContainer(container);

  const radius = Math.min(containerWidth, containerHeight) / 2;
  const color = scaleOrdinal(
    quantize(interpolateRainbow, initialData.children.length + 1)
  );

  // Create partitioning function
  const partitionSunburst = partition().size([2 * Math.PI, radius]);

  // Find root, define that value of broader categories is sum of the value of its children, sort in descending order
  const root = hierarchy(initialData)
    .sum((d) => d.count)
    .sort((a, b) => b.count - a.count);
  partitionSunburst(root);

  // Add an arc for each element
  const arcs = arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius / 2)
    .innerRadius((d) => d.y0)
    .outerRadius((d) => d.y1 - 1);

  svg
    .append("g")
    .attr(
      "transform",
      `translate(${containerWidth / 2}, ${containerHeight / 2})`
    ) // Position chart to middle of container
    .selectAll("path")
    .data(root.descendants().filter((d) => d.depth)) // Filter out the root (where depth is 0)
    .join("path")
    .attr("fill", (d) => {
      while (d.depth > 1) d = d.parent;
      return color(d.data.name);
    }) // Set fill color for each path based on name of top-level ancestor node
    .attr("d", arcs);

  svg
    .append("g")
    .attr(
      "transform",
      `translate(${containerWidth / 2}, ${containerHeight / 2})`
    )
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("font-family", "sans-serif")
    .selectAll("text")
    .data(
      root
        .descendants()
        .filter((d) => d.depth && ((d.y0 + d.y1) / 2) * (d.x1 - d.x0) > 10)
    )
    .join("text")
    .attr("transform", function (d) {
      const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
      const y = (d.y0 + d.y1) / 2;
      return `rotate(${
        x - 90
      }) translate(${y}, 0) rotate(${x < 180 ? 0 : 180})`;
    })
    .attr("dy", "0.35em")
    .text((d) => d.data.name);

  select(container).append(() => svg.node());

  return {
    updateSunburst(data) {
      const root = hierarchy(data.categories)
        .sum((d) => d.count)
        .sort((a, b) => b.count - a.count);
      partitionSunburst(root);

      // console.log(
      //   root.descendants().map((d) => ({
      //     name: d.data.name,
      //     depth: d.depth,
      //     y0: d.y0,
      //     y1: d.y1,
      //     x0: d.x0,
      //     x1: d.x1,
      //   }))
      // );

      const paths = svg
        .selectAll("path")
        .data(root.descendants().filter((d) => d.depth));

      paths
        .join("path")
        .transition()
        .attr("d", arcs) // Apply new arc positions
        .attr("fill", (d) => {
          while (d.depth > 1) d = d.parent;
          return color(d.data.name);
        });

      const texts = svg
        .selectAll("text")
        .data(
          root
            .descendants()
            .filter((d) => d.depth && ((d.y0 + d.y1) / 2) * (d.x1 - d.x0) > 10)
        );

      texts
        .join("text")
        .transition()
        .attr("transform", function (d) {
          const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
          const y = (d.y0 + d.y1) / 2;
          return `rotate(${
            x - 90
          }) translate(${y}, 0) rotate(${x < 180 ? 0 : 180})`;
        })
        .text((d) => d.data.name);
    },
  };
}
