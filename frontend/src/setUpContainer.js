import { select, create } from "d3";

export function setUpContainer(container) {
  const containerBoundingClientRect = select(container)
    .node()
    .getBoundingClientRect();
  const containerWidth = containerBoundingClientRect.width;
  const containerHeight = containerBoundingClientRect.height;

  const svg = create("svg");

  svg
    .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
    .style("width", "100%")
    .style("height", "100%");

  return { svg, containerWidth, containerHeight };
}
