import {
  select,
  scaleTime,
  scaleLinear,
  extent,
  max,
  area,
  axisBottom,
  axisLeft,
} from "d3";
import {
  fetchFiresData,
  cleanFiresData,
  countFiresPerDay,
} from "./prepareFiresData";
import { setUpContainer } from "./setUpContainer";

export function createAreaChart(container) {
  fetchFiresData().then((firesData) => {
    // Obtain data in necessary shape
    const cleanData = cleanFiresData(firesData);
    const firesPerDay = countFiresPerDay(cleanData);

    const { svg, containerWidth, containerHeight } = setUpContainer(container);

    const margin = {
      top: 20,
      right: 20,
      bottom: 20,
      left: 40,
    };

    const xScale = scaleTime(extent(firesPerDay.map((d) => d[0])), [
      margin.left,
      containerWidth - margin.right,
    ]);

    const yScale = scaleLinear(
      [0, max(firesPerDay.map((d) => d[1]))],
      [containerHeight - margin.bottom, margin.top]
    );

    const firesPerDayArea = area()
      .x((d) => xScale(d[0])) // date
      .y0(yScale(0))
      .y1((d) => yScale(d[1])); // nr of fires on that date

    // Create area
    svg
      .append("path")
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
  });
}
