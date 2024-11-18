import { 
    geoAlbersUsa,
    geoPath,
    select,
    min,
    max,
    geoIdentity,
    scaleSequentialLog,
    interpolateOranges,
    zoom,
    pointer,
} from "d3";
import { contours } from 'd3-contour'
import { setUpContainer } from "./setUpContainer";
import * as topojson from "topojson-client";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";


// Define the grid resolution (number of cells in x and y directions)
let fireDataPoints;
let gridResolutionX = 200;
let gridResolutionY;
let tooltipIsoband;
let tooltipFire;

// Lookup table for Marching Squares - 16 configurations (0 to 15)
const lookupTable = [
    [],            // 0: 0000, no line
    [[0, 0.5, 0.5, 1]],  // 1: 0001
    [[0.5, 1, 1, 0.5]],  // 2: 0010
    [[0, 0.5, 1, 0.5]],  // 3: 0011
    [[0.5, 0, 1, 0.5]],  // 4: 0100
    [[0, 0.5, 0.5, 0], [0.5, 1, 1, 0.5]], // 5: 0101
    [[0.5, 0, 1, 0.5], [0.5, 1, 1, 0.5]], // 6: 0110
    [[0, 0.5, 0.5, 0]], // 7: 0111
    [[0.5, 0, 0, 0.5]], // 8: 1000
    [[0.5, 0, 0, 0.5], [0.5, 1, 1, 0.5]], // 9: 1001
    [[0.5, 0, 0, 0.5], [0, 0.5, 1, 0.5]], // 10: 1010
    [[0.5, 1, 1, 0.5], [0.5, 0, 0, 0.5]], // 11: 1011
    [[0.5, 0, 1, 0.5], [0, 0.5, 1, 0.5]], // 12: 1100
    [[0, 0.5, 1, 0.5]], // 13: 1101
    [[0, 0.5, 0.5, 1]], // 14: 1110
    []             // 15: 1111, no line
];
// Marching square thresholds
const thresholds = [100, 500, 5000, 20000, 120000, 500000, 1000000, 2000000];  // Adjust these levels as needed
const colors = ['#00f', '#0f0', '#ff0', '#f80', '#f00', '#800'];  // Different colors for each level

export async function createIsoplethMap(container, initialData) {
    const topoJsonData = await fetch(usAtlasUrl).then((response) => 
        response.json()
    );
    const { svg, containerWidth, containerHeight} = setUpContainer(container);
    svg.attr("preserveAspectRatio", "xMidYMid meet");
    const projection = geoAlbersUsa().fitSize(
        [containerWidth, containerHeight],
        topojson.feature(topoJsonData, topoJsonData.objects.states)
    );
    gridResolutionY = gridResolutionX * containerHeight / containerWidth;
    const path = geoPath().projection(projection);

    const g = svg.append("g");
    g.append("path")
        .attr("fill", "none")
        .attr("stroke", "#777")
        .attr("stroke-width", 0.5)
        .attr("stroke-linejoin", "round")
        .attr("class", "state-borders")
        .attr("d", path(topojson.mesh(topoJsonData, topoJsonData.objects.nation)));

    fireDataPoints = initialData[0].children.map((fireEntry) => {
        const [x, y] = projection([fireEntry.LONGITUDE, fireEntry.LATITUDE]);
        return [x, y, 
            fireEntry.FIRE_SIZE, 
            fireEntry.FIRE_NAME, 
            fireEntry.STATE, 
            fireEntry.COUNTY, 
            fireEntry.DISCOVERY_DATE?.toLocaleDateString('en-US', {year: 'numeric', 'month': 'short', day: 'numeric'}), 
            fireEntry.CONT_DATE?.toLocaleDateString('en-US', {year: 'numeric', 'month': 'short', day: 'numeric'}), 
        ];
    });

    // Define a tooltip div
    tooltipIsoband = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("padding", "6px")
        .style("background", "rgba(0,0,0,0.7)")
        .style("color", "#fff")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", 0);

    tooltipFire = d3.select('body')
        .append('div')
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("padding", "6px")
        .style("background", "rgba(0,0,0,0.7)")
        .style("color", "#fff")
        .style("border-radius", "4px")
        .style("opacity", 0);  // Hide it initially
    
    // Hide fire tooltip when clicking elsewhere
    d3.select('body').on('click', function() {
        tooltipFire.style('opacity', 0);
        d3.selectAll('.highlighted-point').transition().duration(200)
            .attr("r", 1)
            .attr("fill", "yellow")
            .attr("selected", false)
    });

    // fireDataPoints.forEach(([x, y]) => {
    //     g.append("circle")
    //         .attr("cx", x)
    //         .attr("cy", y)
    //         .attr("r", 2) // Adjust the radius of the circle to your preference
    //         .attr("fill", "red") // Color the points
    //         .attr("opacity", 0.75); // Add some transparency if needed
    // });

    svg.call(zoom()
        .extent([[0, 0], [containerWidth, containerHeight]])
        .scaleExtent([1, 12])
        .on("zoom", function zoomed(event, d) {
            g.attr("transform", event.transform);
            tooltipFire.style('opacity', 0);
        }));

    drawIsolines(projection, g, containerWidth, containerHeight);

    select(container).append(() => svg.node());

    return {
        updateIsoplethMap(data) {
            fireDataPoints = data.children.map((fireEntry) => {
                const [x, y] = projection([fireEntry.LONGITUDE, fireEntry.LATITUDE]);
                return [x, y, 
                    fireEntry.FIRE_SIZE, 
                    fireEntry.FIRE_NAME, 
                    fireEntry.STATE, 
                    fireEntry.COUNTY, 
                    fireEntry.DISCOVERY_DATE?.toLocaleDateString('en-US', {year: 'numeric', 'month': 'short', day: 'numeric'}), 
                    fireEntry.CONT_DATE?.toLocaleDateString('en-US', {year: 'numeric', 'month': 'short', day: 'numeric'}), 
                ];
            });

            // Clear previous isopleths before redrawing
            g.selectAll('.isopleth').remove();
            g.selectAll('.isopleth-band').remove();
            g.selectAll('.isopleth-path').remove();
            g.selectAll('.highlighted-point').remove();

            drawIsolines(projection, g, containerWidth, containerHeight);
        }
    };
}


function drawIsolines(projection, g, width, height) {
    // Create a 2D array for the grid
    const grid = [];
    // Initialize the grid with values influenced by fireSize and proximity
    for (let i = 0; i < gridResolutionY; i++) {
        // const row = [];
        for (let j = 0; j < gridResolutionX; j++) {
            const x =  width * (j / gridResolutionX);
            const y =  height * (i / gridResolutionY);
            // Initialize the cell value
            let value = 0;
            // Add contribution from each fire point, scaled by fire size and proximity
            fireDataPoints.forEach(([fx, fy, fireSize]) => {
                const dist = Math.hypot(fx - x, fy - y);
                const influence = Math.exp(-dist); // Fire size influence diminishes with distance
                value += fireSize * influence; // Higher fire size has more influence
            });

            // row.push(value*1000);  // Scale up to make values visible
            grid.push(value*1000);
        }
    };
    // Draw contours
    // thresholds.forEach((threshold, levelIndex) => {
    //     // Call the marchingSquares algorithm with a desired threshold for the contour level
    //     const contours = marchingSquares(grid, threshold, levelIndex, width, height); // Adjust threshold based on fireSize influence
    //     // Add the isopleth lines (contours) to the map
    //     g.selectAll(`path.isopleth.level-${levelIndex}`)
    //         .data(contours)
    //         .enter()
    //         .append("path")
    //         .attr("class", `isopleth level-${levelIndex}`)
    //         .attr("d", d => line()(d)) // Create a line for each contour segment
    //         .attr("fill", "none")
    //         .attr("stroke", colors[levelIndex]) // Color for the isopleth lines
    //         .attr("stroke-width", 0.5);
    // })

    const countoursGenerator = contours()
        .size([gridResolutionX, gridResolutionY])
        .thresholds(thresholds);
    const polygons = countoursGenerator(grid);
    const colorScale = scaleSequentialLog()
        .domain([min(thresholds), max(thresholds)])
        .interpolator(interpolateOranges);

    g.selectAll('path.isopleth-band')
        .data(polygons)
        .enter()
        .append('path')
        .attr('class', 'isopleth-band')
        .attr('d', geoPath(geoIdentity().scale(width / gridResolutionX)))
        .attr('fill', d => colorScale(d.value))
        .attr('stroke', 'none')
        .on('mouseover', function (event, d) {
            // Show tooltip
            tooltipIsoband.transition().duration(200)
                .style("opacity", 1);
            tooltipIsoband.html(`<strong>Fire Influence Threshold:</strong> ${d.value}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on('mousemove', function (event) {
            // Update tooltip position
            tooltipIsoband.style("left", (event.pageX + 10) + "px")
                   .style("top", (event.pageY - 10) + "px");
        })
        .on('mouseout', function () {
            tooltipIsoband.transition().duration(200)
                .style("opacity", 0);
        })
        .on('mousedown', function(event) {
            const influencingFires = highlightInfluencingDataPoints(event, polygons, width/gridResolutionX);
            console.log("High influencing fires %s", influencingFires);
            // Clear previous highlighted points
            g.selectAll('.highlighted-point').remove();
            // Plot the influencing points
            influencingFires.forEach(([x, y, fireSize, fireName, state, county, startDate, contDate]) => {
                g.append("circle")
                    .attr('class', 'highlighted-point')
                    .attr("cx", x)
                    .attr("cy", y)
                    .attr("r", 1)
                    .attr("fill", "yellow")
                    .attr('stroke', 'black')
                    .attr('stroke-width', 0.5)
                    .attr('cursor', 'pointer')
                    .on('mouseover', function(event, d) {
                        d3.select(this)
                            .transition().duration(200)
                            .attr("r", 1.5)
                            .attr("fill", "red")
                    })
                    .on('mouseout', function(event, d) {
                        const fire = d3.select(this)
                        if (fire.attr("selected") != "true") {
                            fire.transition().duration(200)
                                .attr("r", 1)
                                .attr("fill", "yellow")
                        }
                    })
                    .on('click', function(event, d) {
                        event.stopPropagation();

                        d3.select(this)
                            .attr("r", 1.5)
                            .attr("fill", "red")
                            .attr("selected", true)

                        tooltipFire.style('left', (event.pageX+10)+'px')
                            .style('top', (event.pageY-10)+'px')
                            .style('opacity', 1)
                            .html(`
                                <strong>Fire Name:</strong> ${fireName}<br>
                                <strong>Fire Size:</strong> ${fireSize} acres<br>
                                <strong>State:</strong> ${state}<br>
                                <strong>County:</strong> ${county}<br>
                                <strong>Start Date:</strong> ${startDate}<br>
                                <strong>Contain Date:</strong> ${contDate}
                            `);
                    })
            });

        });

    g.selectAll('path.isopleth-path')
        .data(polygons)
        .enter()
        .append('path')
        .attr('class', 'isopleth-path')
        .attr('d', geoPath(geoIdentity().scale(width / gridResolutionX)))
        .attr('fill', 'none')
        .attr('stroke', 'black')  // Outline color
        .attr('stroke-width', 0.2)
}

// Function to highlight influencing data points
function highlightInfluencingDataPoints(event, contourPolygons, scaleFactor) {
    let [clickX, clickY] = pointer(event);
    console.log(contourPolygons);
    const clickedBand = contourPolygons.toReversed().find(band =>
        band.coordinates.some(c => 
            d3.polygonContains(c[0], [clickX/scaleFactor, clickY/scaleFactor])
        )
    )
    const bandIndex = contourPolygons.indexOf(clickedBand);
    const bandValueLow = bandIndex > 0 ? thresholds[bandIndex] : 0;
    const bandValueHigh = bandIndex+1 < thresholds.length ? thresholds[bandIndex+1] : Number.MAX_SAFE_INTEGER;
    const influencingDataPoints = fireDataPoints.filter(([x, y, fireSize]) => {
        // Calculate the distance from the clicked point to the fire data point
        const dist = Math.sqrt(Math.pow(clickX - x, 2) + Math.pow(clickY - y, 2));
        // Calculate the contribution of this point based on distance and fire size
        const contribution = fireSize * Math.exp(-dist) * 1000;
        // Set a threshold for significant contribution and filter accordingly
        // Adjust the threshold as needed for your dataset
        return contribution >= bandValueLow/fireDataPoints.length && contribution < bandValueHigh/fireDataPoints.length;
    });
    return influencingDataPoints;
}
