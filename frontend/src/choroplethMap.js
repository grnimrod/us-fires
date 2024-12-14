import {
  scaleSequentialLog,
  interpolateOranges,
  geoAlbersUsa,
  geoPath,
  select,
  max,
  timeFormat,
} from "d3";
import * as topojson from "topojson-client";
import { setUpContainer } from "./setUpContainer";
import { legend, legendVertical } from "./colorLegend";
import { rgb } from "d3";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";

export async function createChoroplethMap(
  container,
  initialData,
  eventEmitter,
  zoom
) {
  const topoJsonData = await fetch(usAtlasUrl).then((response) =>
    response.json()
  );
  const initialStatesData = initialData[0].stateCounts;

  const { svg, containerWidth, containerHeight } = setUpContainer(container);
  svg.attr("preserveAspectRatio", "xMidYMid meet");

  // Domain of color scale starts at 1 instead of 0 to avoid log(0) = inf
  const color = scaleSequentialLog()
    .domain([
      1,
      max(initialData, (monthEntry) => {
        return max(monthEntry.stateCounts, (stateEntry) => stateEntry.count);
      }),
    ])
    .interpolator(interpolateOranges);

  //  // Create the legend and append it to the SVG
  //  const colorLegend = legend(
  //   scaleSequentialLog(
  //     [1, max(initialData, (monthEntry) => {
  //       return max(monthEntry.stateCounts, (stateEntry) => stateEntry.count);
  //     })],
  //     interpolateOranges
  //   ),
  //   svg,
  //   {
  //     title: "Fire Count by State (Logarithmic Scale)",
  //     //className: "color-legend",
  //     //translateX: containerWidth - 300, 
  //     //translateY: containerHeight - 80, 
  //   }
  // );

  const legendGroup = svg.append("g").attr("class", "legend-group");

  legendGroup
  .append("text")
  .attr("class", "legend-title")
  .attr("x", -10) // Adjust x position to align with the legend
  .attr("y", -20) // Position the title above the legend
  .attr("text-anchor", "start") // Align the text with the legend
  .attr("font-size", "10px") // Font size for the title
  .attr("font-weight", "bold")
  .call((text) => {
    text.append("tspan") // First line
      .text("Fire Count by State")
      .attr("x", 0)
      .attr("dy", 15); // No vertical shift for the first line

    text.append("tspan") // Second line
      .text("(Log Scale)")
      .attr("x", 0) // Align with the first line
      .attr("dy", 15); // Vertical shift for the second line
  });

  
  let colorLegend = legendVertical({
    color: scaleSequentialLog(
      [1, max(initialData, (monthEntry) => {
        return max(monthEntry.stateCounts, (stateEntry) => stateEntry.count);
      })],
      interpolateOranges
    ),
    svg: legendGroup,
    translateY: 5,
  });

  legendGroup.attr(
    "transform",
    `translate(0, ${containerHeight / 2 - 200})`
  );

  // Map state names to FIPS numeric identifiers
  // If you give namemap a state name, it returns the state id
  // We have state names in our data, we have state ids in the topojson data
  const namemap = new Map(
    topoJsonData.objects.states.geometries.map((d) => [d.properties.name, d.id])
  );

  // Create a map linking each state ID to its fire count by flattening `initialData` to extract state entries with counts
  const valuemapForFirstEntry = new Map(
    initialStatesData.map((stateEntry) => [
      namemap.get(stateEntry.state),
      stateEntry.count,
    ])
  );

  const projection = geoAlbersUsa().fitSize(
    [containerWidth, containerHeight],
    topojson.feature(topoJsonData, topoJsonData.objects.states)
  );
  const path = geoPath().projection(projection);

  const listeningRect = svg
    .append("rect")
    .attr("width", containerWidth)
    .attr("height", containerHeight)
    .attr("fill", "none")
    .attr("pointer-events", "all");  // Make the entire SVG clickable

  const g = svg.append("g");

  const statesData = topojson.feature(topoJsonData, topoJsonData.objects.states);

  const mapGroup = svg.append("g").attr("class", "map-group");

  const states = mapGroup
    .selectAll("path")
    .data(statesData.features)
    .join("path")
    .attr("d", path)
    .attr("fill", (d) => color(valuemapForFirstEntry.get(d.id)))
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5);

  // Track selected states
  const selectedStatesSet = new Set();
  
  states
  .append("title")
  .text((d) => {
    const stateId = d.id;
    const stateName = [...namemap.entries()].find(([name, id]) => id === stateId)?.[0];
    const fireCount = valuemapForFirstEntry.get(stateId) || 0;
    return `${stateName || "Unknown"}\nNumber of Fires: ${fireCount}`;
  });



  states
  .on("mouseover", function (event, d) {
    const currentStateName = [...namemap.entries()].find(([name, id]) => id === d.id)?.[0];
    const isSelected = selectedStatesSet.has(currentStateName);
    const anyStateSelected = selectedStatesSet.size > 0;

    // Case 2: Hovering over a state while at least one is already selected
    if (anyStateSelected && !isSelected) {
      // Show the state's original color temporarily
      const originalColor = d3.select(this).style("fill"); // Use current color dynamically
      d3.select(this).attr("fill", originalColor);
    }
   
  })
  .on("mouseout", function (event, d) {
    const currentStateName = [...namemap.entries()].find(([name, id]) => id === d.id)?.[0];
    const isSelected = selectedStatesSet.has(currentStateName);
    const currentColor = d3.select(this).attr("fill");
    const anyStateSelected = selectedStatesSet.size > 0;

    if (anyStateSelected && !isSelected) {
      // Reapply the greyscale based on the current color
      // const currentColor = d3.select(this).style("fill"); // Use current color dynamically
      const col = rgb(currentColor); // Convert to RGB
      const luminance = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
      d3.select(this).attr("fill", `rgb(${luminance},${luminance},${luminance})`);
    }

  
  });

  states
  .on("mouseover", function (event, d) {
    const currentStateName = [...namemap.entries()].find(([name, id]) => id === d.id)?.[0];
    const isSelected = selectedStatesSet.has(currentStateName);
    const anyStateSelected = selectedStatesSet.size > 0;

    // Retrieve the current color dynamically
    const currentColor = d3.select(this).style("fill");
    const col = rgb(currentColor);

    // Darken the color by reducing brightness
    const darkerColor = `rgb(${Math.max(0, col.r - 30)}, ${Math.max(0, col.g - 30)}, ${Math.max(0, col.b - 30)})`;
    d3.select(this).attr("fill", darkerColor);
  })
  .on("mouseout", function (event, d) {
    const currentStateName = [...namemap.entries()].find(([name, id]) => id === d.id)?.[0];
    const isSelected = selectedStatesSet.has(currentStateName);
    const anyStateSelected = selectedStatesSet.size > 0;

    // Restore the color based on selection
    if (isSelected) {
      // Keep selected state in its original color
      const originalColor = color(valuemapForFirstEntry.get(d.id)); // Assuming you have valuemapForFirstEntry
      d3.select(this).attr("fill", originalColor);
    } else if (anyStateSelected) {
      // Apply greyscale for unselected states
      const currentColor = color(valuemapForFirstEntry.get(d.id)); // Dynamically fetch
      const col = rgb(currentColor);
      const luminance = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
      d3.select(this).attr("fill", `rgb(${luminance},${luminance},${luminance})`);
    } else {
      // Restore to original color
      const originalColor = color(valuemapForFirstEntry.get(d.id));
      d3.select(this).attr("fill", originalColor);
    }
  })

  
  // Handle state selection
  function clicked(event, d) {
    const stateId = d.id;
    const stateName = [...namemap.entries()].find(([name, id]) => id === stateId)?.[0];
    if (selectedStatesSet.has(stateName)) {
      selectedStatesSet.delete(stateName);
    } else {
      selectedStatesSet.add(stateName);
    }
    // Update colors for all states
    states.attr("fill", function (d) {
      const currentStateName = [...namemap.entries()].find(([name, id]) => id === d.id)?.[0];
      const isSelected = selectedStatesSet.has(currentStateName);

      const currentColor = d3.select(this).style("fill"); // Use current color dynamically
      const col = rgb(currentColor);

      if (isSelected) {
        return currentColor; // Keep selected state in color
      } else if (selectedStatesSet.size > 0) {
        // Grey out unselected states if at least one state is selected
        const luminance = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
        return `rgb(${luminance},${luminance},${luminance})`;
      } else {
        return currentColor; // Restore original color when no states are selected
      }
    });

    eventEmitter.emit("stateSelected", Array.from(selectedStatesSet));
  }


  states
    .style("cursor", "pointer").on("click", clicked);
  
  listeningRect.on("click", function () {
    selectedStatesSet.clear();
    states
      .attr("fill", (d) => color(valuemapForFirstEntry.get(d.id))) // Reset to original colors
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5);
    eventEmitter.emit("resetData");
  });

  
  // Draw state borders
  mapGroup.append("path")
    .attr("fill", "none")
    .attr("stroke", "white")
    .attr("stroke-linejoin", "round")
    .attr("class", "state-borders")
    .attr(
      "d",
      path(
        topojson.mesh(
          topoJsonData,
          topoJsonData.objects.states,
          (a, b) => a !== b
        )
      )
    );

  select(container).append(() => svg.node());

  svg.call(
    zoom.extent([
        [0, 0],
        [containerWidth, containerHeight],
      ])
  );

  select("#zoomResetBtnChoro").on("click", function () {
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
  });


  // Listen for slidingChange events
  let isSliding = false;

  eventEmitter.on("slidingChange", (sliderState) => {
    isSliding = sliderState;
    if (!isSliding) {
      svg
        .select(".background-title")
        .transition()
        .duration(1000)
        .style("opacity", 0)
        .remove(); // Remove the background title when not sliding
    }
  });

  const legendGroup = svg.append("g").attr("class", "legend-group");
  legendVertical({
    color: scaleSequentialLog(
      [1, max(initialData, (monthEntry) => {
          return max(monthEntry.stateCounts, (stateEntry) => stateEntry.count);
        })],
        interpolateOranges
      ),
      svg: legendGroup,
      title: "Fire Count (Logarithm)",
      tickSize: 0,
  });

  return {
    updateMap(newData, selectedStatesSet = new Set()) {
      const newStatesData = newData.stateCounts;
      // Create map along similar principle as above, only for a single object of the data array (corresponding to data of a single month)
      const valuemapForEntry = new Map(
        newStatesData.map((stateEntry) => [
          namemap.get(stateEntry.state),
          stateEntry.count,
        ])
      );

      if(selectedStatesSet.size === 0) {
        states.attr("fill", (d) => color(valuemapForEntry.get(d.id)));
      }

      states
        .transition()
        .duration(100)

      // Update tooltips dynamically
      states.select("title").text((d) => {
        const stateId = d.id;
        const stateName = [...namemap.entries()].find(([name, id]) => id === stateId)?.[0];
        const fireCount = valuemapForEntry.get(stateId) || 0;
        return `${stateName || "Unknown"}\nNumber of Fires: ${fireCount}`;
      });

      const backgroundText = svg.select(".background-title");
      if (isSliding) {
        const monthLabel = timeFormat("%Y-%m")(newData.month);
        if (backgroundText.empty()) {
          svg
            .append("text")
            .attr("class", "background-title")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "3em")
            .attr("fill", "#ccc")
            .text(monthLabel);
        } else {
          backgroundText.text(monthLabel); // Update the text if it already exists
        }
      }
    },
  };
}
