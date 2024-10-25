import {
  select,
  create,
  scaleTime,
  scaleLinear,
  extent,
  max,
  rollups,
  timeDay,
  area,
  axisBottom,
  axisLeft,
} from "d3";
import { fetchFiresData, cleanFiresData } from "./prepareFiresData";

export function createAreaChart(container) {
  fetchFiresData().then((firesData) => {
    const containerWidth = select(container)
      .node()
      .getBoundingClientRect().width;
    const containerHeight = select(container)
      .node()
      .getBoundingClientRect().height;

    const margin = {
      top: 20,
      right: 20,
      bottom: 20,
      left: 40,
    };

    const svg = create("svg");

    svg
      .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
      .style("width", "100%")
      .style("height", "100%");

    const cleanData = cleanFiresData(firesData);

    // Wrangle data to sufficient form for the area chart
    const firesPerDay = rollups(
      cleanData,
      (v) => v.length,
      (d) => timeDay(d.DISCOVERY_DATE)
    );

    firesPerDay.sort((a, b) => a[0] - b[0]);

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

    svg
      .append("path")
      .attr("fill", "#ff5733")
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
