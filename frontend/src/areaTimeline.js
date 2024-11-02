import {
  select,
  scaleTime,
  scaleLinear,
  area,
  min,
  max,
  axisBottom,
  axisLeft,
} from "d3";
import { setUpContainer } from "./setUpContainer";
import { countFiresPerDay } from "./prepareFiresData";

export function createAreaChart(container, cleanData) {
  const firesPerDay = countFiresPerDay(cleanData);
  const { svg, containerWidth, containerHeight } = setUpContainer(container);

  const margin = {
    top: 20,
    right: 20,
    bottom: 20,
    left: 40,
  };

  const xScale = scaleTime()
    .domain([min(firesPerDay, (d) => d.date), max(firesPerDay, (d) => d.date)])
    .range([margin.left, containerWidth - margin.right]);

  const yScale = scaleLinear()
    .domain([0, max(firesPerDay, (d) => d.count)])
    .range([containerHeight - margin.bottom, margin.top]);

  const firesPerDayArea = area()
    .x((d) => xScale(d.date))
    .y0(yScale(0))
    .y1((d) => yScale(d.count));

  // Create area
  const areaPath = svg
    .append("path")
    .attr("class", "area")
    .attr("fill", "#943126")
    .attr("d", firesPerDayArea(firesPerDay));

  // Append x axis
  svg
    .append("g")
    .attr("transform", `translate(0, ${containerHeight - margin.bottom})`)
    .call(axisBottom(xScale));

  // Append y axis
  svg
    .append("g")
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(axisLeft(yScale).ticks(5));

  select(container).append(() => svg.node());

  // Function to update the chart based on filtered data
  function updateChart(filteredData) {
    filteredData = countFiresPerDay(filteredData);
    xScale.domain([
      min(filteredData, (d) => d.date),
      max(filteredData, (d) => d.date),
    ]);
    yScale.domain([0, max(filteredData, (d) => d.count)]);

    areaPath.attr("d", firesPerDayArea(filteredData));
  }

  return { updateChart };
}
