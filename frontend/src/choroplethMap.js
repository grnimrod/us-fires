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

  let colorLegend = legendVertical({
    color: scaleSequentialLog(
      [1, max(initialData, (monthEntry) => {
          return max(monthEntry.stateCounts, (stateEntry) => stateEntry.count);
        })],
        interpolateOranges
      ),
      svg: legendGroup,
  });


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

  // states.on("click", function(event, d) {
  //   const selectedState = d.properties.name; 
  //   eventEmitter.emit("stateSelected", selectedState);
  // });

  // Handle state selection
  states
    .on("click", function (event, d) {
      const stateId = d.id;
      const stateName = [...namemap.entries()].find(([name, id]) => id === stateId)?.[0];

      if (selectedStatesSet.has(stateName)) {
        selectedStatesSet.delete(stateName);
        select(this).attr("stroke", "#fff").attr("stroke-width", 0.5);
      } else {
        selectedStatesSet.add(stateName);
        select(this).attr("stroke", "black").attr("stroke-width", 2);
      }

      eventEmitter.emit("stateSelected", Array.from(selectedStatesSet));
    });


  listeningRect.on("click", function () {
    selectedStatesSet.clear();
    eventEmitter.emit("resetData");
    states.attr("opacity", 1).attr("stroke", "none"); // Reset state styles
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
      .on("zoom", (event) => { 
        mapGroup.attr("transform", event.transform);
      })
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
      // Create map along similar principle as above, only for a single object of the data array (corresponding to data of a single month)
      const valuemapForEntry = new Map(
        newStatesData.map((stateEntry) => [
          namemap.get(stateEntry.state),
          stateEntry.count,
        ])
      );

      states
        .transition()
        .duration(100)
        .attr("fill", (d) => color(valuemapForEntry.get(d.id)));

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
