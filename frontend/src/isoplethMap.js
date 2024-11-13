import { 
    geoAlbersUsa,
    geoPath,
    select,
    min,
    max,
    geoIdentity,
    scaleSequentialLog,
    interpolateOranges,
} from "d3";
import { contours } from 'd3-contour'
import { setUpContainer } from "./setUpContainer";
import * as topojson from "topojson-client";

const usAtlasUrl = "https://unpkg.com/us-atlas@3.0.1/counties-10m.json";


// Define the grid resolution (number of cells in x and y directions)
let gridResolutionX = 200;
let gridResolutionY;
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
const thresholds = [500, 5000, 20000, 40000, 120000, 500000, 1000000, 2000000];  // Adjust these levels as needed
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
    console.log(path);

    const g = svg.append("g");
    g.append("path")
        .attr("fill", "none")
        .attr("stroke", "#777")
        .attr("stroke-width", 0.5)
        .attr("stroke-linejoin", "round")
        .attr("class", "state-borders")
        .attr("d", path(topojson.mesh(topoJsonData, topoJsonData.objects.states)));

    const fireDataPoints = initialData[0].children.map((fireEntry) => {
        const [x, y] = projection([fireEntry.LONGITUDE, fireEntry.LATITUDE]);
        return [x, y, fireEntry.FIRE_SIZE]; // Return the coordinates
    });

    // fireDataPoints.forEach(([x, y]) => {
    //     g.append("circle")
    //         .attr("cx", x)
    //         .attr("cy", y)
    //         .attr("r", 2) // Adjust the radius of the circle to your preference
    //         .attr("fill", "red") // Color the points
    //         .attr("opacity", 0.75); // Add some transparency if needed
    // });

    drawIsolines(g, fireDataPoints, containerWidth, containerHeight, path);

    select(container).append(() => svg.node());

    return {
        updateIsoplethMap(data) {
            const fireDataPoints = data.children.map((fireEntry) => {
                const [x, y] = projection([fireEntry.LONGITUDE, fireEntry.LATITUDE]);
                return [x, y, fireEntry.FIRE_SIZE]; // Return the coordinates
            });

            // Bind the data to circle elements, using a 'key function' if needed for uniqueness
            const circles = g.selectAll("circle").data(fireDataPoints);
            // Remove any extra circles that are no longer needed
            circles.exit().remove();

            // Clear previous isopleths before redrawing
            g.selectAll('.isopleth').remove();
            g.selectAll('.isopleth-band').remove();
            g.selectAll('.isopleth-path').remove();

            // fireDataPoints.forEach(([x, y]) => {
            //     g.append("circle")
            //         .attr("cx", x)
            //         .attr("cy", y)
            //         .attr("r", 2) // Adjust the radius of the circle to your preference
            //         .attr("fill", "red") // Color the points
            //         .attr("opacity", 0.75); // Add some transparency if needed
            // });

            drawIsolines(g, fireDataPoints, containerWidth, containerHeight, path);
        }
    };
}


function drawIsolines(g, fireDataPoints, width, height, path) {
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

    console.log("width %s height %s resX %s resY %s", width, height, gridResolutionX, gridResolutionY);
    console.log(polygons)

    g.selectAll('path.isopleth-band')
        .data(polygons)
        .enter()
        .append('path')
        .attr('class', 'isopleth-band')
        .attr('d', geoPath(geoIdentity().scale(width / gridResolutionX)))
        .attr('fill', d => colorScale(d.value))
        .attr('stroke', 'none')

    g.selectAll('path.isopleth-path')
        .data(polygons)
        .enter()
        .append('path')
        .attr('class', 'isopleth-path')
        .attr('d', geoPath(geoIdentity().scale(width / gridResolutionX)))
        .attr('fill', 'none')
        .attr('stroke', 'black')  // Outline color
        .attr('stroke-width', 0.2);
}

// Marching squares algorithm to find contour lines
function marchingSquares(grid, threshold, levelIndex, width, height) {
    const contours = [];
    for (let i = 0; i < grid.length - 1; i++) {
        for (let j = 0; j < grid[i].length - 1; j++) {
            // Get the grid cell's 4 corner values
            const tl = grid[i][j];
            const tr = grid[i][j + 1];
            const bl = grid[i + 1][j];
            const br = grid[i + 1][j + 1];

            // Determine which case we are in (based on the threshold)
            const index = (tl >= threshold ? 8 : 0) |
                          (tr >= threshold ? 4 : 0) |
                          (br >= threshold ? 2 : 0) |
                          (bl >= threshold ? 1 : 0);
            
            // console.log("index=%s, tl=%s, tr=%s, bl=%s, br=%s", index, tl, tr, bl, br);

            // Get the contour line segments from the lookup table
            const segments = lookupTable[index];
            if (segments.length > 0) {
                segments.forEach(segment => {
                    // Interpolate the contour line coordinates
                    const x1 =  width * (j + segment[0]) / gridResolutionX;
                    const y1 =  height * (i + segment[1]) / gridResolutionY;
                    const x2 =  width * (j + segment[2]) / gridResolutionX;
                    const y2 =  height * (i + segment[3]) / gridResolutionY;

                    contours.push([[x1, y1], [x2, y2]]);
                });
            }
        }
    }
    return contours;
}
