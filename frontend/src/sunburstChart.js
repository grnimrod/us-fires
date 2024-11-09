import {
  select,
  scaleOrdinal,
  quantize,
  interpolateRainbow,
  partition,
  hierarchy,
  arc,
  create,
} from "d3";

export function createSunburstChart(container, monthlyData) {
  const firstEntryCategories = monthlyData[0].categories;

  const containerBoundingClientRect = select(container)
    .node()
    .getBoundingClientRect();
  const containerWidth = containerBoundingClientRect.width;
  const containerHeight = containerBoundingClientRect.height;
  const radius = Math.min(containerWidth, containerHeight) / 6;

  const color = scaleOrdinal(
    quantize(interpolateRainbow, firstEntryCategories.children.length + 1)
  );

  // Find root, define that value of broader categories is sum of the value of its children, sort in descending order
  const root = hierarchy(firstEntryCategories)
    .sum((d) => d.count)
    .sort((a, b) => b.count - a.count);

  // Create partitioning function
  const partitionSunburst = partition().size([2 * Math.PI, root.height + 1]);

  partitionSunburst(root);
  root.each((d) => (d.current = d));

  const arcGenerator = arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius * 1.5)
    .innerRadius((d) => d.y0 * radius)
    .outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius - 1));

  const svg = create("svg")
    .attr("viewBox", [
      -containerWidth / 2,
      -containerHeight / 2,
      containerWidth,
      containerHeight,
    ])
    .style("width", "100%")
    .style("height", "100%");

  const arcs = svg
    .append("g")
    .selectAll("path")
    .data(root.descendants().slice(1)); // Filter out the root (where depth is 0)

  arcs
    .join("path")
    .attr("fill", (d) => {
      while (d.depth > 1) d = d.parent;
      return color(d.data.name);
    })
    .attr("fill-opacity", 0.7) // Set fill color for each path based on name of top-level ancestor node
    .attr("d", (d) => arcGenerator(d.current));

  const labels = svg
    .append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("font-family", "sans-serif")
    .selectAll("text")
    .data(
      root
        .descendants()
        .filter((d) => d.depth && ((d.y0 + d.y1) / 2) * (d.x1 - d.x0) > 10)
    );

  labels
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
      const currentEntryCategories = data.categories;

      const newRoot = hierarchy(currentEntryCategories)
        .sum((d) => d.count)
        .sort((a, b) => b.count - a.count);
      partitionSunburst(newRoot);
      newRoot.each((d) => (d.current = d));

      const newArcs = svg
        .select("g")
        .selectAll("path")
        .data(newRoot.descendants().slice(1));

      newArcs
        .join("path")
        .attr("d", (d) => arcGenerator(d.current))
        .attr("fill", (d) => {
          while (d.depth > 1) d = d.parent;
          return color(d.data.name);
        })
        .attr("fill-opacity", 0.7);

      const newLabels = svg
        .selectAll("text")
        .data(
          newRoot
            .descendants()
            .filter((d) => d.depth && ((d.y0 + d.y1) / 2) * (d.x1 - d.x0) > 10)
        );
      // .join("text")

      newLabels
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
