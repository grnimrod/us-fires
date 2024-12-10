import { create, bin, scaleBand, scaleLinear, max, select } from "d3";
import { setUpContainer } from "./setUpContainer";

export function createHistogram(container, data) {
  const { containerWidth } = setUpContainer(container);

  const height = 100;
  const margin = {
    top: 20,
    right: 30,
    bottom: 20,
    left: 30,
  };

  const svg = create("svg")
    .attr("width", containerWidth)
    .attr("height", height);

  const xScale = scaleBand()
    .domain(data.map((d) => d.month))
    .range([margin.left, containerWidth - margin.right]);

  const yScale = scaleLinear()
    .domain([0, max(data, (d) => d.totalFireCount)])
    .range([height, 0]);

  svg
    .append("g")
    .selectAll()
    .data(data)
    .join("rect")
    .attr("x", (d) => xScale(d.month))
    .attr("y", (d) => yScale(d.totalFireCount))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - yScale(d.totalFireCount))
    .attr("fill", "#dc7633")
    .attr("opacity", 0.8);

  select(container).append(() => svg.node());

  function updateHistFilteredData(filteredData) {
    svg
      .selectAll("rect")
      .data(filteredData)
      .join("rect")
      .transition()
      .duration(200)
      .attr("x", (d) => xScale(d.month))
      .attr("y", (d) => yScale(d.totalFireCount))
      .attr("height", (d) => height - yScale(d.totalFireCount));
  }

  return { updateHistFilteredData };
}
