import {
    select,
    scaleSequential,
    interpolateRdYlGn,
    interpolateOranges,
    scaleOrdinal,
    quantize,
    interpolateRainbow,
    partition,
    hierarchy,
    arc,
  } from "d3";
  import { setUpContainer } from "./setUpContainer";

const radians = 0.0174532925;

        //CHART CONSTANTS
        const chartRadius = 250;
        const chartWidth = chartRadius * 2;
        const chartHeight = chartRadius * 2;
      	const labelRadius = chartRadius + 5;
        const margin = { "top": 40, "bottom": 40, "left": 40, "right": 40 };
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        //CHART OPTIONS
        const holeRadiusProportion = 0.3; //fraction of chartRadius. 0 gives you some pointy arcs in the centre.
        const holeRadius = holeRadiusProportion * chartRadius;
        const segmentsPerCoil = 12; //number of coils. for this example, I have 12 months per year. But you change to whatever suits your data. 
        const segmentAngle = 360 / segmentsPerCoil;
        var coils; //number of coils, based on data.length / segmentsPerCoil
        var coilWidth; //remaining chartRadius (after holeRadius removed), divided by coils + 1. I add 1 as the end of the coil moves out by 1 each time
        function convertTextToNumbers(d) {
            //console.log(d);
            d.count = +d.count;
            d.date = dateParse(d.date);
            d.year = yearFormat(d.date);
            d.month = monthFormat(d.date);
            return d;
        };
export function createSpiralHeatmap(container, monthlyData){
    const { svg, containerWidth, containerHeight } = setUpContainer(container);

    var heatmap = spiralHeatmap()
    .radius(chartRadius)
    .holeRadiusProportion(0.2)
    .arcsPerCoil(12)
    .coilPadding(0.1)
    .arcLabel("month")
    .coilLabel("year")

    //var colour = d3.scaleSequential([190,7378],d3.interpolateRdYlGn);

    const color = scaleSequential()
    .domain([190,7378])
    .interpolator(interpolateOranges);


        //ENSURE THE DATA IS SORTED CORRECTLY, IN THIS CASE BY YEAR AND MONTH
        //THE SPIRAL WILL START IN THE MIDDLE AND WORK OUTWARDS

        var nestedData = d3.nest()
            .key(function (d) { return d.car_type; })
            .sortValues(function (a, b) { return a.date - b.date; })
            .entries(monthlyData);

        nestedData.forEach(function (chartData) {

            //colour.domain([190,7378]);

            //set the options for the sprial heatmap
            let heatmap = spiralHeatmap()
                .radius(chartRadius)
                .holeRadiusProportion(0.2)
                .arcsPerCoil(12)
                .coilPadding(0.1)
                .arcLabel("month")
                .coilLabel("year")

            //CREATE SVG AND A G PLACED IN THE CENTRE OF THE SVG
            const div = d3.select(container).append("div")

            div.append("p")
                .text(chartData.key)

            const svg = div.append("svg")
                .attr("width", chartWidth + margin.left + margin.right)
                .attr("height", chartHeight + margin.top + margin.bottom);

            const g = svg.append("g")
                .attr("transform", "translate("
                + (margin.left + chartRadius)
                + ","
                + (margin.top + chartRadius) + ")");

            g.datum(chartData.values)
                .call(heatmap);

            g.selectAll(".arc").selectAll("path")
                .style("fill", function (d) { return color(d.count); })

        })

        select(container).append(() => svg.node());
    return heatmap;

}

function spiralHeatmap () {
    // constants
    const radians = 0.0174532925
  
    // All options that are accessible to caller
    // Default values
    var radius = 250
    var holeRadiusProportion = 0.3 // proportion of radius
    var arcsPerCoil = 12 // assuming months per year
    var coilPadding = 0 // no padding
    var arcLabel = months // no labels
    var coilLabel = '' // no labels
    var startAngle = 0 //starts at 12 o'clock
  
    function chart (selection) {
      selection.each(function (data) {
        const arcAngle = 360 / arcsPerCoil
        const labelRadius = radius + 20
  
        var arcLabelsArray = []
  
        for (var i = 0; i < arcsPerCoil; i++) {
          arcLabelsArray.push(i)
        }
  
  
  
        // Create/update the x/y coordinates for the vertices and control points for the paths
        // Stores the x/y coordinates on the data
        updatePathData(data)
  
        let thisSelection = d3
          .select(this)
          .append('g')
          .attr('class', 'spiral-heatmap')
  
        var arcLabelsG = thisSelection
          .selectAll('.arc-label')
          .data(arcLabelsArray)
          .enter()
          .append('g')
          .attr('class', 'arc-label')
  
        arcLabelsG
          .append('text')
          .text(function (d) {
            return months[data[d][arcLabel].getMonth()]
          })
          .attr('x', function (d, i) {
            let labelAngle = i * arcAngle + arcAngle / 2
            return x(labelAngle, labelRadius)
          })
          .attr('y', function (d, i) {
            let labelAngle = i * arcAngle + arcAngle / 2
            return y(labelAngle, labelRadius)
          })
          .style('text-anchor', function (d, i) {
            return i < arcLabelsArray.length / 2 ? 'start' : 'end'
          })
  
        arcLabelsG
          .append('line')
          .attr('x2', function (d, i) {
            let lineAngle = i * arcAngle
            let lineRadius = radius + 10
            return x(lineAngle, lineRadius)
          })
          .attr('y2', function (d, i) {
            let lineAngle = i * arcAngle
            let lineRadius = radius + 10
            return y(lineAngle, lineRadius)
          })
  
        var arcs = thisSelection
          .selectAll('.arc')
          .data(data)
          .enter()
          .append('g')
          .attr('class', 'arc')
  
        arcs.append('path').attr('d', function (d) {
          // start at vertice 1
          let start = 'M ' + d.x1 + ' ' + d.y1
          // inner curve to vertice 2
          let side1 =
            ' Q ' +
            d.controlPoint1x +
            ' ' +
            d.controlPoint1y +
            ' ' +
            d.x2 +
            ' ' +
            d.y2
          // straight line to vertice 3
          let side2 = 'L ' + d.x3 + ' ' + d.y3
          // outer curve vertice 4
          let side3 =
            ' Q ' +
            d.controlPoint2x +
            ' ' +
            d.controlPoint2y +
            ' ' +
            d.x4 +
            ' ' +
            d.y4
          // combine into string, with closure (Z) to vertice 1
          return start + ' ' + side1 + ' ' + side2 + ' ' + side3 + ' Z'
        })
  
        // create coil labels on the first arc of each coil
        if (coilLabel != '') {
          let coilLabels = arcs
          .filter(function (d) {
            return d.arcNumber == 0
          })
          .raise()
  
        coilLabels
          .append('path')
          .attr('id', function (d) {
            return 'path-' + d.month.getFullYear();
          })
          .attr('d', function (d) {
            // start at vertice 1
            let start = 'M ' + d.x1 + ' ' + d.y1
            // inner curve to vertice 2
            let side1 =
              ' Q ' +
              d.controlPoint1x +
              ' ' +
              d.controlPoint1y +
              ' ' +
              d.x2 +
              ' ' +
              d.y2
            return (start + side1)
          })
          .style('opacity', 0)
  
        coilLabels
          .append('text')
          .attr('class', 'coil-label')
          .attr('x', 3)
          .attr('dy', -4)
          .append('textPath')
          .attr('xlink:href', function (d) {
            return '#path-' + d.month.getFullYear();
          })
          .text(function (d) {
            return d.month.getFullYear();
          })
        }
      })
  
      function updatePathData (data) {
        let holeRadius = radius * holeRadiusProportion
        let arcAngle = 360 / arcsPerCoil
        let dataLength = data.length
        let coils = Math.ceil(dataLength / arcsPerCoil) // number of coils, based on data.length / arcsPerCoil
        let coilWidth = radius * (1 - holeRadiusProportion) / (coils + 1) // remaining radius (after holeRadius removed), divided by coils + 1. I add 1 as the end of the coil moves out by 1 each time
  
        data.forEach(function (d, i) {
          let coil = Math.floor(i / arcsPerCoil)
          let position = i - coil * arcsPerCoil
          let startAngle = position * arcAngle
          let endAngle = (position + 1) * arcAngle
          let startInnerRadius = holeRadius + i / arcsPerCoil * coilWidth
          let startOuterRadius =
            holeRadius +
            i / arcsPerCoil * coilWidth +
            coilWidth * (1 - coilPadding)
          let endInnerRadius = holeRadius + (i + 1) / arcsPerCoil * coilWidth
          let endOuterRadius =
            holeRadius +
            (i + 1) / arcsPerCoil * coilWidth +
            coilWidth * (1 - coilPadding)
  
          // vertices of each arc
          d.x1 = x(startAngle, startInnerRadius)
          d.y1 = y(startAngle, startInnerRadius)
          d.x2 = x(endAngle, endInnerRadius)
          d.y2 = y(endAngle, endInnerRadius)
          d.x3 = x(endAngle, endOuterRadius)
          d.y3 = y(endAngle, endOuterRadius)
          d.x4 = x(startAngle, startOuterRadius)
          d.y4 = y(startAngle, startOuterRadius)
  
          // CURVE CONTROL POINTS
          let midAngle = startAngle + arcAngle / 2
          let midInnerRadius =
            holeRadius + (i + 0.5) / arcsPerCoil * coilWidth
          let midOuterRadius =
            holeRadius +
            (i + 0.5) / arcsPerCoil * coilWidth +
            coilWidth * (1 - coilPadding)
  
          // MID POINTS, WHERE THE CURVE WILL PASS THRU
          d.mid1x = x(midAngle, midInnerRadius)
          d.mid1y = y(midAngle, midInnerRadius)
          d.mid2x = x(midAngle, midOuterRadius)
          d.mid2y = y(midAngle, midOuterRadius)
  
          d.controlPoint1x = (d.mid1x - 0.25 * d.x1 - 0.25 * d.x2) / 0.5
          d.controlPoint1y = (d.mid1y - 0.25 * d.y1 - 0.25 * d.y2) / 0.5
          d.controlPoint2x = (d.mid2x - 0.25 * d.x3 - 0.25 * d.x4) / 0.5
          d.controlPoint2y = (d.mid2y - 0.25 * d.y3 - 0.25 * d.y4) / 0.5
  
          d.arcNumber = position
          d.coilNumber = coil
        })
  
        return data
      }
  
      function x (angle, radius) {
        // change to clockwise
        let a = 360 - angle
        // start from 12 o'clock
        a = a + 180 - startAngle;
        return radius * Math.sin(a * radians)
      }
  
      function y (angle, radius) {
        // change to clockwise
        let a = 360 - angle
        // start from 12 o'clock
        a = a + 180 - startAngle;
        return radius * Math.cos(a * radians)
      }
  
      function chartWH (r) {
        return r * 2
      }
    }
  
    chart.radius = function (value) {
      if (!arguments.length) return radius
      radius = value
      return chart
    }
  
    chart.holeRadiusProportion = function (value) {
      if (!arguments.length) return holeRadiusProportion
      holeRadiusProportion = value
      return chart
    }
  
    chart.arcsPerCoil = function (value) {
      if (!arguments.length) return arcsPerCoil
      arcsPerCoil = value
      return chart
    }
  
    chart.coilPadding = function (value) {
      if (!arguments.length) return coilPadding
      coilPadding = value
      return chart
    }
  
    chart.arcLabel = function (value) {
      if (!arguments.length) return arcLabel
      arcLabel = value
      return chart
    }
  
    chart.coilLabel = function (value) {
      if (!arguments.length) return coilLabel
      coilLabel = value
      return chart
    }
    
    chart.startAngle = function (value) {
      if (!arguments.length) return startAngle
      startAngle = value
      return chart
    }
  
    return chart
  }