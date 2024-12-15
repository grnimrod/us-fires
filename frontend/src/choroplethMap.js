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
  
    // legendVertical({
      //   color: scaleSequentialLog(
        //     [1, max(initialData, (monthEntry) => {
          //         return max(monthEntry.stateCounts, (stateEntry) => stateEntry.count);
          //       })],
          //       interpolateOranges
          //     ),
          //     svg: legendGroup,
          //     title: "Fire Count (Logarithm)",
          //     tickSize: 0,
          // });
  const legendGroup = svg.append("g").attr("class", "legend-group");

  legendGroup
  .append("text")
  .attr("class", "legend-title")
  .attr("x", -10) 
  .attr("y", -20)
  .attr("text-anchor", "start") 
  .attr("font-size", "10px")
  .attr("font-weight", "bold")
  .call((text) => {
    text.append("tspan") 
      .text("Fire Count")
      .attr("x", 0)
      .attr("dy", 15); 

    text.append("tspan") 
      .text("(Logarithmic)")
      .attr("x", 0) 
      .attr("dy", 15); 
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
    .attr("pointer-events", "all");  

  const g = svg.append("g");

  const statesData = topojson.feature(topoJsonData, topoJsonData.objects.states);

  const mapGroup = svg.append("g").attr("class", "map-group");

  let valuemapForEntry = new Map(); 
  let stateColorMap = new Map();

  const states = mapGroup
    .selectAll("path")
    .data(statesData.features)
    .join("path")
    .attr("d", path)
    .attr("fill", (d) => color(valuemapForFirstEntry.get(d.id)))
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5);

  states.each(function (d) {
    const stateId = d.id;
    const initialColor = d3.select(this).style("fill"); // Get the initial fill color
    stateColorMap.set(stateId, initialColor); // Store the initial color in the map
});

  // Track selected states
  const selectedStatesSet = new Set();
  const unselectedStatesSet = new Set();
  
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
    const stateId = d.id;
    const isSelected = selectedStatesSet.has([...namemap.entries()].find(([name, id]) => id === stateId)?.[0]);

    if (!isSelected && selectedStatesSet.size > 0) {
      const originalColor = stateColorMap.get(stateId) || color(0);
      d3.select(this)
          .attr("fill", originalColor)
    }

    const currentColor = d3.select(this).style("fill");
    const darkerColor = d3.color(currentColor).darker(0.5);

    d3.select(this)
        .attr("fill", darkerColor) // Darken the current color
})
.on("mouseout", function (event, d) {
    const stateId = d.id;
    const isSelected = selectedStatesSet.has([...namemap.entries()].find(([name, id]) => id === stateId)?.[0]);

    if (!isSelected && selectedStatesSet.size > 0) {
        // Keep the greyscale color for unselected states
        const originalColor = stateColorMap.get(stateId) || color(0);
        const col = d3.color(originalColor);
        const luminance = Math.round(0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b);
        d3.select(this).attr("fill", `rgb(${luminance}, ${luminance}, ${luminance})`);
        return;
    }

    // Restore original color for selected states
    const originalColor = stateColorMap.get(stateId);
    d3.select(this)
        .attr("fill", originalColor)
});

  function clicked(event, d) {
    const stateId = d.id;
    const stateName = [...namemap.entries()].find(([name, id]) => id === stateId)?.[0];
  
    // Toggle selection state
    if (selectedStatesSet.has(stateName)) {
      selectedStatesSet.delete(stateName);
    } else {
      selectedStatesSet.add(stateName);
    }

     // Calculate unselected states
     const allStates = Array.from(namemap.keys());
     const selectedStates = Array.from(selectedStatesSet);
     const unselectedStates = allStates.filter((state) => !selectedStates.includes(state));

     // Emit both selected and unselected states
    eventEmitter.emit("stateSelected", {
      selected: selectedStates,
      unselected: unselectedStates
  });

  console.log("Selected states:", Array.from(selectedStatesSet));
    // Update visual attributes for all states
    const anyStateSelected = selectedStatesSet.size > 0;
    states
      .attr("fill", (d) => {
        const currentStateName = [...namemap.entries()].find(([name, id]) => id === d.id)?.[0];
        const isSelected = selectedStatesSet.has(currentStateName);

        if (isSelected || !anyStateSelected) {
            return stateColorMap.get(d.id) || color(0); // Keep the original color for selected states
        } else {
            // Apply greyscale for unselected states
            const originalColor = stateColorMap.get(d.id) || color(0);
            const col = d3.color(originalColor);
            const luminance = Math.round(0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b);
            return `rgb(${luminance}, ${luminance}, ${luminance})`;
        }
    });
  }

  states
    .style("cursor", "pointer").on("click", clicked);
  
  listeningRect.on("click", function () {
    selectedStatesSet.clear();
    states
      .attr("fill", (d) => stateColorMap.get(d.id))
      .attr("opacity", 1);  
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


  return {
    updateMap(newData) {
      const newStatesData = newData.stateCounts;

      valuemapForEntry = new Map(
        newStatesData.map((stateEntry) => [
          namemap.get(stateEntry.state),
          stateEntry.count,
        ])
      );
      
     
      // Update the stateColorMap to reflect new data
      states.each(function (d) {
        const stateId = d.id;
        const newColor = color(valuemapForEntry.get(stateId) || 0);
        stateColorMap.set(stateId, newColor); 
      });

       // Check if any state is selected
    const anyStateSelected = selectedStatesSet.size > 0;

  
     // Update colors for all states based on new data
    states.transition()
    .duration(100)
    .attr("fill", (d) => {
      const stateId = d.id;
      const stateName = [...namemap.entries()].find(([name, id]) => id === stateId)?.[0];
      const isSelected = selectedStatesSet.has(stateName);

      if (isSelected || !anyStateSelected) {
          // Return the original color for selected or when no states are selected
          return stateColorMap.get(stateId) || color(0);
      } else {
          // Apply greyscale for unselected states
          const originalColor = stateColorMap.get(stateId) || color(0);
          const col = d3.color(originalColor);
          const luminance = Math.round(0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b);
          return `rgb(${luminance}, ${luminance}, ${luminance})`;
      }
    });

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
