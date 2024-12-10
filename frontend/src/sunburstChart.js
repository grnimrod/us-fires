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
    .sort((a, b) => a.data.name.localeCompare(b.data.name));

  // Create partitioning function
  const partitionSunburst = partition().size([2 * Math.PI, root.height + 1]);

  partitionSunburst(root);

  root.each((d) => {
    d.current = d;
  });

  const currentNodeMap = new Map();
  root.each((node) => {
    currentNodeMap.set(node.data.name, {
      x0: node.current?.x0 || node.x0,
      x1: node.current?.x1 || node.x1,
      y0: node.current?.y0 || node.y0,
      y1: node.current?.y1 || node.y1,
    });
  });

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

  const arcs = svg
    .append("g")
    .attr(
      "transform",
      `translate(${containerWidth / 2}, ${(containerHeight + margin.top) / 2})`
    )
    .selectAll("path")
    .data(root.descendants().slice(1))
    .join("path")
    .attr("class", "arcs")
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

  let selectedCategory = null;

  function clicked(event, d) {
    selectedCategory = d.data.name;

    const currentArcs = d3.selectAll(".arcs");

    currentArcs.attr("fill-opacity", (slice) => {
      return slice.data.name == selectedCategory ? 0.9 : 0.3;
    });

    eventEmitter.emit("categorySelected", selectedCategory);
  }

  arcs.style("cursor", "pointer").on("click", clicked);

  listeningRect.on("click", function () {
    selectedCategory = null;

    const currentArcs = d3.selectAll(".arcs");

    currentArcs.attr("fill-opacity", 0.9);

    eventEmitter.emit("resetData");
  });

  // Chart title current month
  const chartTitle = svg
    .append("text")
    .attr("x", containerWidth / 2 - 3 * radius)
    .attr("y", margin.top / 2)
    .attr("font-size", "20px")
    .text(`${timeFormat("%Y-%m")(initialData[0].month)}`);

  // Add fire count title to middle of the chart
  const midTitle = svg
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

  const labels = svg
    .append("g")
    .attr("class", "labels")
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
      svg.selectAll(".labels").remove();
      svg.selectAll("title").remove();

      const currentEntryCategories = newData.categories;
      const newRoot = hierarchy(currentEntryCategories)
        .sum((d) => d.count)
        .sort((a, b) => a.data.name.localeCompare(b.data.name));
      partitionSunburst(newRoot);
      newRoot.each((d) => (d.current = d));

      newRoot.each((node) => {
        const current = currentNodeMap.get(node.data.name);
        if (current) {
          // Initialize with the current values from the previous root
          node.current = {
            x0: current.x0,
            x1: current.x1,
            y0: current.y0,
            y1: current.y1,
          };
        } else {
          // Initialize with the new target values for new nodes
          node.current = {
            x0: node.x0,
            x1: node.x1,
            y0: node.y0,
            y1: node.y1,
          };
        }

        // Always set the target values
        node.target = {
          x0: node.x0,
          x1: node.x1,
          y0: node.y0,
          y1: node.y1,
        };
      });

      chartTitle.text(`${timeFormat("%Y-%m")(newData.month)}`);
      midTitle.text(newRoot.value);

      const newArcs = svg
        .select("g")
        .attr(
          "transform",
          `translate(${containerWidth / 2}, ${
            (containerHeight + margin.top) / 2
          })`
        )
        .selectAll("path")
        .data(newRoot.descendants().slice(1), (d) => d.data.name)
        .join("path")
        .attr("class", "arcs")
        .attr("d", (d) => arcGenerator(d.current))
        .attr("fill", (d) => {
          while (d.depth > 1) d = d.parent;
          return color(d.data.name);
        })
        .attr("fill-opacity", (slice) => {
          console.log(slice.data.count);
          if (slice.data.count === 0) {
            return 0;
          }
          if (!selectedCategory) return 0.9;
          return slice.data.name === selectedCategory ? 0.9 : 0.3;
        });

      const t = svg.transition().duration(150);
      newArcs
        .transition(t)
        .tween("data", (d) => {
          // Interpolators for each attribute
          const iX0 = d3.interpolate(d.current.x0, d.target.x0);
          const iX1 = d3.interpolate(d.current.x1, d.target.x1);
          const iY0 = d3.interpolate(d.current.y0, d.target.y0);
          const iY1 = d3.interpolate(d.current.y1, d.target.y1);

          return (t) => {
            d.current = {
              x0: iX0(t),
              x1: iX1(t),
              y0: iY0(t),
              y1: iY1(t),
            };
          };
        })
        .attrTween("d", (d) => () => arcGenerator(d.current))
        .on("end", () => {
          // After the transition, set current to target
          newRoot.each((node) => {
            node.current = {
              x0: node.target.x0,
              x1: node.target.x1,
              y0: node.target.y0,
              y1: node.target.y1,
            };

            currentNodeMap.set(node.data.name, {
              x0: node.current?.x0 || node.x0,
              x1: node.current?.x1 || node.x1,
              y0: node.current?.y0 || node.y0,
              y1: node.current?.y1 || node.y1,
            });
          });
        });

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

      const newLabels = svg
        .append("g")
        .attr("class", "labels")
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
        .transition(t)
        .attrTween("fill-opacity", (d) => {
          return (t) => {
            return +labelVisible(d.current);
          };
        })
        .attrTween("transform", function (d) {
          const iTransform = d3.interpolate(
            [d.current.x0, d.current.y0],
            [d.current.x1, d.current.y1]
          );

          return (t) => {
            const [newX, newY] = iTransform(t);
            const lineCount = d.data.name.split(/\s|\/|\\n/).length;
            return labelTransform(d.current, lineCount, newX, newY);
          };
        })
        .each(function (d) {
          const textElement = select(this);
          labelFormat(textElement, d.data.name);
        });
    },
  };
}
