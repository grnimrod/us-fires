import {
  select,
  scaleOrdinal,
  quantize,
  interpolateRainbow,
  partition,
  hierarchy,
  arc,
} from "d3";
import {
  fetchFiresData,
  cleanFiresData,
  createHierarchy,
} from "./prepareFiresData";
import { setUpContainer } from "./setUpContainer";

export function createSunburstChart(container) {
  fetchFiresData().then((firesData) => {
    // Obtain data in necessary shape
    const cleanData = cleanFiresData(firesData);
    const hierData = createHierarchy(cleanData);

    const { svg, containerWidth, containerHeight } = setUpContainer(container);

    const radius = Math.min(containerWidth, containerHeight) / 2;
    const color = scaleOrdinal(
      quantize(interpolateRainbow, hierData.children.length + 1)
    );

    // Create partitioning function
    const partitionSunburst = partition().size([2 * Math.PI, radius]);

    // Find root, define that value of broader categories is sum of the value of its children, sort in descending order
    const root = hierarchy(hierData)
      .sum((d) => d.value)
      .sort((a, b) => b.value - a.value);

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

    select(container).append(() => svg.node());
  });
}
