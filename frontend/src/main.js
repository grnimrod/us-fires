import { createMapFigure } from "./usMap";
import { createSunburstChart } from "./fireTypesSunburst";
import { createAreaChart } from "./areaTimeline";

createMapFigure("#fig1");
createSunburstChart("#fig2");
createAreaChart("#fig3");

//   // Filter out fire data points where the return of projection is null
//   // const validProjectedFires = firesData.filter((d) => {
//   //   const projected = projection([d.LONGITUDE, d.LATITUDE]);
//   //   return projected !== null;
//   // });

//   // Apparently this also works and doesn't rely on 'projection'
//   const validProjectedFires = firesData.filter((d) => {
//     return d.LONGITUDE !== undefined && d.LATITUDE !== undefined; // Filter for valid coordinates
//   });
