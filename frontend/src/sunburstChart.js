import {
  select,
  scaleOrdinal,
  schemeObservable10,
  partition,
  hierarchy,
  arc,
  create,
  timeFormat,
} from "d3";

export function createSunburstChart(container, initialData, eventEmitter) {
  const firstEntryCategories = initialData[0].categories;

  const containerBoundingClientRect = select(container)
    .node()
    .getBoundingClientRect();
  const containerWidth = containerBoundingClientRect.width;
  const containerHeight = containerBoundingClientRect.height;

  const margin = {
    top: 40,
    right: 20,
    bottom: 20,
    left: 20,
  };

  const radius = Math.min(containerWidth, containerHeight - margin.top) / 6;

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
    .attr("viewBox", [0, 0, containerWidth, containerHeight])
    .style("width", "100%")
    .style("height", "100%");

  const listeningRect = svg
    .append("rect")
    .attr("width", containerWidth)
    .attr("height", containerHeight)
    .attr("fill", "none")
    .attr("pointer-events", "all");

  // Chart title current month
  svg
    .append("text")
    .attr("x", containerWidth / 2 - 3 * radius)
    .attr("y", margin.top / 2)
    .attr("font-size", "20px")
    .text(`${timeFormat("%Y-%m")(initialData[0].month)}`);

  const arcs = svg
    .append("g")
    .attr(
      "transform",
      `translate(${containerWidth / 2}, ${(containerHeight + margin.top) / 2})`
    )
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

  function clicked(event, d) {
    arcs.attr("fill-opacity", (slice) => {
      return slice.data.name == d.data.name ? 0.9 : 0.3;
    });

    eventEmitter.emit("categorySelected", d.data.name);
  }

  arcs.style("cursor", "pointer").on("click", clicked);

  listeningRect.on("click", function () {
    arcs.attr("fill-opacity", 0.9);
    eventEmitter.emit("resetData");
  });

  // Add fire count title to middle of the chart
  svg
    .append("text")
    .attr(
      "transform",
      `translate(${containerWidth / 2}, ${(containerHeight + margin.top) / 2})`
    )
    .attr("text-anchor", "middle")
    .attr("dy", "0.3em")
    .attr("font-size", `${radius * 0.025}em`)
    .text(root.value);

  function labelVisible(d) {
    return (d.y1 - d.y0) * (d.x1 - d.x0) > 0.04;
  }

  function labelFormat(selection, text) {
    const words = text.replace(/\//g, "/\n").split(/\s/);

    words.forEach((word, i) => {
      selection
        .append("tspan")
        .text(
          word.includes("/")
            ? word.length > 3
              ? word.slice(0, 3).concat("./")
              : word.concat("/")
            : word.length > 4
            ? word.slice(0, 4).concat(".")
            : word
        )
        .attr("x", 0)
        .attr("dy", i === 0 ? "0.3em" : "1em");
    });
  }

  function labelTransform(d, lineCount) {
    const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
    const y = ((d.y0 + d.y1) / 2) * radius;

    const offset = (lineCount - 1) * 4;
    return `rotate(${x - 90}) translate(${y},${
      x < 180 ? -offset : offset
    }) rotate(${x < 180 ? 0 : 180})`;
  }

  const labels = svg // some weird behavior, on update adds new one doesn't remove existing one
    .append("g")
    .attr(
      "transform",
      `translate(${containerWidth / 2}, ${(containerHeight + margin.top) / 2})`
    )
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("font-family", "sans-serif")
    .selectAll("text")
    .data(root.descendants().slice(1));

  labels
    .join("text")
    .attr("fill-opacity", (d) => +labelVisible(d.current))
    .attr("transform", function (d) {
      const lineCount = d.data.name.split(/\s|\/|\\n/).length;
      return labelTransform(d.current, lineCount);
    })
    .each(function (d) {
      const textElement = select(this);
      labelFormat(textElement, d.data.name);
    });

  select(container).append(() => svg.node());

  return {
    updateSunburst(newData) {
      svg.selectAll("text").remove();
      svg.selectAll("title").remove();

      const currentEntryCategories = newData.categories;
      const newRoot = hierarchy(currentEntryCategories)
        .sum((d) => d.count)
        .sort((a, b) => b.value - a.value);
      partitionSunburst(newRoot);
      newRoot.each((d) => (d.current = d));

      svg
        .append("text")
        .attr("x", containerWidth / 2 - 3 * radius)
        .attr("y", margin.top / 2)
        .attr("font-size", "20px")
        .text(`${timeFormat("%Y-%m")(newData.month)}`);

      const newArcs = svg
        .select("g")
        .attr(
          "transform",
          `translate(${containerWidth / 2}, ${
            (containerHeight + margin.top) / 2
          })`
        )
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

      newArcs.style("cursor", "pointer").on("click", clicked);

      svg
        .append("text")
        .attr(
          "transform",
          `translate(${containerWidth / 2}, ${
            (containerHeight + margin.top) / 2
          })`
        )
        .attr("text-anchor", "middle")
        .attr("x", 0)
        .attr("y", 0)
        .attr("dy", "0.3em")
        .attr("font-size", `${radius * 0.025}em`)
        .text(newRoot.value);

      const newLabels = svg
        .append("g")
        .attr(
          "transform",
          `translate(${containerWidth / 2}, ${
            (containerHeight + margin.top) / 2
          })`
        )
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("font-family", "sans-serif")
        .selectAll("text")
        .data(newRoot.descendants().slice(1));

      newLabels
        .join("text")
        .attr("fill-opacity", (d) => +labelVisible(d.current))
        .attr("transform", function (d) {
          const lineCount = d.data.name.split(/\s|\/|\\n/).length;
          return labelTransform(d.current, lineCount);
        })
        .each(function (d) {
          const textElement = select(this);
          labelFormat(textElement, d.data.name);
        });
    },
  };
}
