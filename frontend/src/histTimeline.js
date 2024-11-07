import { bin, scaleLinear, max, select } from "d3";
import { setUpContainer } from "./setUpContainer";

export function createHistogram(container, data) {
  const { svg, containerWidth } = setUpContainer(container);

  const height = 70;
  //   const margin = {
  //     top: 20,
  //     right: 20,
  //     bottom: 20,
  //     left: 20,
  //   };

  const distinctDates = Array.from(
    new Set(
      data.map((d) => {
        const year = d.DISCOVERY_DATE.getFullYear();
        const month = d.DISCOVERY_DATE.getMonth();
        return `${year}-${month}`; // Create a string representing year and month
      })
    )
  );

  const numBins = Math.ceil(distinctDates.length / 4);

  const binGenerator = bin()
    .thresholds(numBins)
    .value(
      (d) =>
        new Date(d.DISCOVERY_DATE.getFullYear(), d.DISCOVERY_DATE.getMonth())
    );

  const bins = binGenerator(data);

  const xScale = scaleLinear()
    .domain([bins[0].x0, bins[bins.length - 1].x1])
    .range([0, containerWidth]);

  const yScale = scaleLinear()
    .domain([0, max(bins, (d) => d.length)])
    .range([height, 0]);

  svg
    .append("g")
    .attr("transform", `translate(0, 130)`)
    .selectAll()
    .data(bins)
    .join("rect")
    .attr("x", (d) => xScale(d.x0) + 1)
    .attr("y", (d) => yScale(d.length))
    .attr("width", (d) => xScale(d.x1) - xScale(d.x0) - 1)
    .attr("height", (d) => height - yScale(d.length))
    .attr("fill", "#dc7633")
    .attr("opacity", 0.8);

  select(container).append(() => svg.node());
}
