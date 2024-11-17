import {
  select,
  scaleOrdinal,
  schemeObservable10,
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

  const color = scaleOrdinal(schemeObservable10);

  // Find root, define that value of broader categories is sum of the value of its children, sort in descending order
  const root = hierarchy(firstEntryCategories)
    .sum((d) => d.count)
    .sort((a, b) => b.value - a.value);

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
    .data(root.descendants().slice(1))
    .join("path")
    .attr("fill", (d) => {
      while (d.depth > 1) d = d.parent;
      return color(d.data.name);
    })
    .attr("fill-opacity", 0.9)
    .attr("pointer-events", "auto")
    .attr("d", (d) => arcGenerator(d.current));

  arcs.append("title").text(
    (d) =>
      `${d
        .ancestors()
        .map((d) => d.data.name)
        .reverse()
        .slice(1)
        .join(": ")}\nNumber of fires: ${d.value}`
  );

  svg
    .append("text")
    .attr("text-anchor", "middle")
    .attr("x", 0)
    .attr("y", 0)
    .attr("dy", "0.3em")
    .attr("font-size", `${radius * 0.025}em`)
    .text(root.value);

  // Even if we decide to go with direct labeling, we need to use tspan within the text element
  // function labelFormat(text) {
  //   text = text.replace(/ /g, "\n");
  //   text = text.replace(/\//g, "/\n");

  //   return text;
  // }

  function labelTransform(d) {
    const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
    const y = ((d.y0 + d.y1) / 2) * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }

  const labels = svg
    .append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("font-family", "sans-serif")
    .selectAll("text")
    .data(root.descendants().slice(1));

  labels
    .join("text")
    .attr("transform", (d) => labelTransform(d.current))
    .attr("dy", "0.35em")
    .text((d) => d.data.name);

  select(container).append(() => svg.node());

  return {
    updateSunburst(data) {
      svg.selectAll("text").remove();
      svg.selectAll("title").remove();

      const currentEntryCategories = data.categories;
      const newRoot = hierarchy(currentEntryCategories)
        .sum((d) => d.count)
        .sort((a, b) => b.value - a.value);
      partitionSunburst(newRoot);
      newRoot.each((d) => (d.current = d));

      const newArcs = svg
        .select("g")
        .selectAll("path")
        .data(newRoot.descendants().slice(1))
        .join("path")
        .attr("d", (d) => arcGenerator(d.current))
        .attr("fill", (d) => {
          while (d.depth > 1) d = d.parent;
          return color(d.data.name);
        })
        .attr("fill-opacity", 0.9);

      newArcs.append("title").text(
        (d) =>
          `${d
            .ancestors()
            .map((d) => d.data.name)
            .reverse()
            .slice(1)
            .join(": ")}\nNumber of fires: ${d.value}`
      );

      svg
        .append("text")
        .attr("text-anchor", "middle")
        .attr("x", 0)
        .attr("y", 0)
        .attr("dy", "0.3em")
        .attr("font-size", `${radius * 0.025}em`)
        .text(newRoot.value);

      const newLabels = svg
        .append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("font-family", "sans-serif")
        .selectAll("text")
        .data(newRoot.descendants().slice(1));

      newLabels
        .join("text")
        .attr("transform", (d) => labelTransform(d.current))
        .attr("dy", "0.35em")
        .text((d) => d.data.name);
    },
  };
}
