import { combineWith } from 'baconjs';

const PLUGIN_ID = 'signalk-speed-wind-averaging-sliding';
const PLUGIN_NAME = 'Calculate boat & wind speed averages on a sliding time window.';

export default function (app: any) {
  let unsubscribe: () => void;

  // --- All-time counters ---
  let count = 0;
  let maxSpeed = 0;
  let avgSpeed = 0;
  let maxWind = 0;
  let avgWind = 0;

  // --- Sliding window configuration ---
  let sampleIntervalSec = 1;
  let windowSize = 1;
  let sampleIndex = 0;

  // --- Sliding window state ---
  let speedWindow: any[] = [];
  let speedWindowSum = 0;
  let avgSpeedOverPeriod = 0;
  let speedMaxDeque: any[] = [];
  let maxSpeedOverPeriod = 0;
  let maxAvgSpeedOverPeriod = 0;

  let windWindow: any[] = [];
  let windWindowSum = 0;
  let avgWindOverPeriod = 0;
  let windMaxDeque: any[] = [];
  let maxWindOverPeriod = 0;
  let maxAvgWindOverPeriod = 0;

  // --- Configured path variables ---
  let maxWindDeltaPath = '';
  let maxWindOverPeriodDeltaPath = '';
  let avgPeriodWindDeltaPath = '';
  let maxAvgPeriodWindDeltaPath = '';
  let avgWindDeltaPath = '';
  let maxSpeedDeltaPath = '';
  let maxSpeedOverPeriodDeltaPath = '';
  let avgPeriodSpeedDeltaPath = '';
  let maxAvgPeriodSpeedDeltaPath = '';
  let avgSpeedDeltaPath = '';

  let maxWindDeltaPathKn = '';
  let maxWindOverPeriodDeltaPathKn = '';
  let avgPeriodWindDeltaPathKn = '';
  let maxAvgPeriodWindDeltaPathKn = '';
  let avgWindDeltaPathKn = '';
  let maxSpeedDeltaPathKn = '';
  let maxSpeedOverPeriodDeltaPathKn = '';
  let avgPeriodSpeedDeltaPathKn = '';
  let maxAvgPeriodSpeedDeltaPathKn = '';
  let avgSpeedDeltaPathKn = '';

  const plugin: any = {
    id: PLUGIN_ID,
    name: PLUGIN_NAME,
    description: "Calculates average and maximum values for speed over ground (SOG) and true wind speed (TWS).",
    schema: {
      type: 'object',
      required: ['speedPath', 'windSpeedPath', 'averagingPeriod'],
      properties: {
        speedPath: { 
          type: 'string', 
          title: 'Speed path', 
          default: 'navigation.speedOverGround',
          enum: ['navigation.speedOverGround', 'navigation.speedThroughWater', 'navigation.speedThroughWaterTransverse']
        },
        windSpeedPath: { 
          type: 'string', 
          title: 'Wind speed path', 
          default: 'environment.wind.speedTrue',
          enum: ['environment.wind.speedTrue', 'environment.wind.speedOverGround', 'environment.wind.speedApparent']
        },
        averagingPeriod: { type: 'number', title: 'Averaging period (s)', default: 20 },
        updaterate: { type: 'number', title: 'Update rate (s)', default: 1 },
        windDeltas: {
          type: "object",
          properties: {
            maxWindDeltaPath: { type: 'string', default: 'environment.wind.speedMax' },
            maxWindOverPeriodDeltaPath: { type: 'string', default: 'environment.wind.speedPeriodMax' },
            avgWindDeltaPath: { type: 'string', default: 'environment.wind.speedAverage' },
            avgPeriodWindDeltaPath: { type: 'string', default: 'environment.wind.speedPeriodAverage' },
            maxAvgPeriodWindDeltaPath: { type: 'string', default: 'environment.wind.speedMaxPeriodAverage' },
          }
        },
        speedDeltas: {
          type: "object",
          properties: {
            maxSpeedDeltaPath: { type: 'string', default: 'navigation.speedMax' },
            maxSpeedOverPeriodDeltaPath: { type: 'string', default: 'navigation.speedPeriodMax' },
            avgSpeedDeltaPath: { type: 'string', default: 'navigation.speedAverage' },
            avgPeriodSpeedDeltaPath: { type: 'string', default: 'navigation.speedPeriodAverage' },
            maxAvgPeriodSpeedDeltaPath: { type: 'string', default: 'navigation.speedMaxPeriodAverage' }
          }
        }
      }
    },

    start: async function (props: any) {
      try {
        maxWindDeltaPath = props.windDeltas.maxWindDeltaPath;
        maxWindOverPeriodDeltaPath = props.windDeltas.maxWindOverPeriodDeltaPath;
        avgWindDeltaPath = props.windDeltas.avgWindDeltaPath;
        avgPeriodWindDeltaPath = props.windDeltas.avgPeriodWindDeltaPath;
        maxAvgPeriodWindDeltaPath = props.windDeltas.maxAvgPeriodWindDeltaPath;

        maxSpeedDeltaPath = props.speedDeltas.maxSpeedDeltaPath;
        maxSpeedOverPeriodDeltaPath = props.speedDeltas.maxSpeedOverPeriodDeltaPath;
        avgPeriodSpeedDeltaPath = props.speedDeltas.avgPeriodSpeedDeltaPath;
        maxAvgPeriodSpeedDeltaPath = props.speedDeltas.maxAvgPeriodSpeedDeltaPath;
        avgSpeedDeltaPath = props.speedDeltas.avgSpeedDeltaPath;

        const suffix = 'Kn';
        maxWindDeltaPathKn = maxWindDeltaPath && (maxWindDeltaPath + suffix);
        maxWindOverPeriodDeltaPathKn = maxWindOverPeriodDeltaPath && (maxWindOverPeriodDeltaPath + suffix);
        avgPeriodWindDeltaPathKn = avgPeriodWindDeltaPath && (avgPeriodWindDeltaPath + suffix);
        maxAvgPeriodWindDeltaPathKn = maxAvgPeriodWindDeltaPath && (maxAvgPeriodWindDeltaPath + suffix);
        avgWindDeltaPathKn = avgWindDeltaPath && (avgWindDeltaPath + suffix);

        maxSpeedDeltaPathKn = maxSpeedDeltaPath && (maxSpeedDeltaPath + suffix);
        maxSpeedOverPeriodDeltaPathKn = maxSpeedOverPeriodDeltaPath && (maxSpeedOverPeriodDeltaPath + suffix);
        avgPeriodSpeedDeltaPathKn = avgPeriodSpeedDeltaPath && (avgPeriodSpeedDeltaPath + suffix);
        maxAvgPeriodSpeedDeltaPathKn = maxAvgPeriodSpeedDeltaPath && (maxAvgPeriodSpeedDeltaPath + suffix);
        avgSpeedDeltaPathKn = avgSpeedDeltaPath && (avgSpeedDeltaPath + suffix);

        sampleIntervalSec = props.updaterate || 1;
        windowSize = Math.max(1, Math.round(props.averagingPeriod / sampleIntervalSec));

        const speedStream = app.streambundle.getSelfStream(props.speedPath);
        const windStream = app.streambundle.getSelfStream(props.windSpeedPath);

        unsubscribe = combineWith((sog: any, tws: any) => {
          return { speed: sog, wind: tws };
        }, [speedStream, windStream].map((s) => s.toProperty(undefined)))
        .changes()
        .debounceImmediate(sampleIntervalSec * 1000)
        .onValue((value: any) => {
          sampleIndex += 1;
          count += 1;
          updateAvgSpeed(value.speed, sampleIndex);
          updateAvgWind(value.wind, sampleIndex);
          updateSignalKAllTimePaths();
          updateSignalKAveragePaths();
        });
      } catch (e) {
        app.debug(e);
      }
    },

    stop: function () {
      if (unsubscribe) unsubscribe();
    },

    statusMessage: function () {
      return `Averaging active (Window: ${windowSize} samples)`;
    },

    signalKApiRoutes: function (router: any) {
      router.post("/reset-signalk-speed-wind-averaging", (req: any, res: any) => {
        reset();
        res.send('ok');
      });
      return router;
    }
  };

  // --- Helper Functions ---

  function reset() {
    count = 0; sampleIndex = 0;
    maxSpeed = 0; avgSpeed = 0;
    maxWind = 0; avgWind = 0;
    speedWindow = []; speedWindowSum = 0; avgSpeedOverPeriod = 0;
    speedMaxDeque = []; maxSpeedOverPeriod = 0; maxAvgSpeedOverPeriod = 0;
    windWindow = []; windWindowSum = 0; avgWindOverPeriod = 0;
    windMaxDeque = []; maxWindOverPeriod = 0; maxAvgWindOverPeriod = 0;
    updateSignalKAveragePaths();
    updateSignalKAllTimePaths();
  }

  function updateSignalKAveragePaths() {
    const values = [
      { path: maxWindOverPeriodDeltaPath, value: maxWindOverPeriod },
      { path: avgPeriodWindDeltaPath, value: avgWindOverPeriod },
      { path: maxAvgPeriodWindDeltaPath, value: maxAvgWindOverPeriod },
      { path: maxSpeedOverPeriodDeltaPath, value: maxSpeedOverPeriod },
      { path: avgPeriodSpeedDeltaPath, value: avgSpeedOverPeriod },
      { path: maxAvgPeriodSpeedDeltaPath, value: maxAvgSpeedOverPeriod },
      { path: maxWindOverPeriodDeltaPathKn, value: msToKnots(maxWindOverPeriod) },
      { path: avgPeriodWindDeltaPathKn, value: msToKnots(avgWindOverPeriod) },
      { path: maxAvgPeriodWindDeltaPathKn, value: msToKnots(maxAvgWindOverPeriod) },
      { path: maxSpeedOverPeriodDeltaPathKn, value: msToKnots(maxSpeedOverPeriod) },
      { path: avgPeriodSpeedDeltaPathKn, value: msToKnots(avgSpeedOverPeriod) },
      { path: maxAvgPeriodSpeedDeltaPathKn, value: msToKnots(maxAvgSpeedOverPeriod) },
    ].filter(v => v.path && v.path.length > 0);

    app.handleMessage(PLUGIN_ID, { updates: [{ values }] });
  }

  function updateSignalKAllTimePaths() {
    const values = [
      { path: maxWindDeltaPath, value: maxWind },
      { path: avgWindDeltaPath, value: avgWind },
      { path: maxSpeedDeltaPath, value: maxSpeed },
      { path: avgSpeedDeltaPath, value: avgSpeed },
      { path: maxWindDeltaPathKn, value: msToKnots(maxWind) },
      { path: avgWindDeltaPathKn, value: msToKnots(avgWind) },
      { path: maxSpeedDeltaPathKn, value: msToKnots(maxSpeed) },
      { path: avgSpeedDeltaPathKn, value: msToKnots(avgSpeed) },
    ].filter(v => v.path && v.path.length > 0);

    app.handleMessage(PLUGIN_ID, { updates: [{ values }] });
  }

  function msToKnots(v: number) {
    return typeof v === 'number' ? v * 1.9438444924406 : v;
  }

  function updateAvgSpeed(speed: number, index: number) {
    if (typeof speed === 'number') {
      if (speed > maxSpeed) maxSpeed = speed;
      avgSpeed = avgSpeed + (speed - avgSpeed) / count;

      speedWindow.push({ index, value: speed });
      speedWindowSum += speed;
      const minIndex = index - windowSize + 1;

      while (speedWindow.length > 0 && speedWindow[0].index < minIndex) {
        speedWindowSum -= speedWindow.shift().value;
      }

      while (speedMaxDeque.length > 0 && speedMaxDeque[speedMaxDeque.length - 1].value < speed) {
        speedMaxDeque.pop();
      }
      speedMaxDeque.push({ index, value: speed });
      while (speedMaxDeque.length > 0 && speedMaxDeque[0].index < minIndex) {
        speedMaxDeque.shift();
      }

      if (speedWindow.length > 0) {
        avgSpeedOverPeriod = speedWindowSum / speedWindow.length;
        maxSpeedOverPeriod = speedMaxDeque[0].value;
        if (avgSpeedOverPeriod > maxAvgSpeedOverPeriod) maxAvgSpeedOverPeriod = avgSpeedOverPeriod;
      }
    }
  }

  function updateAvgWind(windSpeed: number, index: number) {
    if (typeof windSpeed === 'number') {
      if (windSpeed > maxWind) maxWind = windSpeed;
      avgWind = avgWind + (windSpeed - avgWind) / count;

      windWindow.push({ index, value: windSpeed });
      windWindowSum += windSpeed;
      const minIndex = index - windowSize + 1;

      while (windWindow.length > 0 && windWindow[0].index < minIndex) {
        windWindowSum -= windWindow.shift().value;
      }

      while (windMaxDeque.length > 0 && windMaxDeque[windMaxDeque.length - 1].value < windSpeed) {
        windMaxDeque.pop();
      }
      windMaxDeque.push({ index, value: windSpeed });
      while (windMaxDeque.length > 0 && windMaxDeque[0].index < minIndex) {
        windMaxDeque.shift();
      }

      if (windWindow.length > 0) {
        avgWindOverPeriod = windWindowSum / windWindow.length;
        maxWindOverPeriod = windMaxDeque[0].value;
        if (avgWindOverPeriod > maxAvgWindOverPeriod) maxAvgWindOverPeriod = avgWindOverPeriod;
      }
    }
  }

  return plugin;
}
