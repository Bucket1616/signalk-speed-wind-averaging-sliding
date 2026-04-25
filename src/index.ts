import { combineWith } from 'baconjs'

const PLUGIN_ID = 'signalk-speed-wind-averaging-sliding';
const PLUGIN_NAME = 'Calculate boat & wind speed averages on a sliding time window.';

function default_1(app) {
    let unsubscribe;

    // --- All-time counters ---
    let count = 0;
    let maxSpeed = 0;
    let avgSpeed = 0;
    let maxWind = 0;
    let avgWind = 0;

    // --- Sliding window configuration ---
    let sampleIntervalSec = 1; // derived from props.updaterate
    let windowSize = 1;        // number of samples in window = averagingPeriod / updaterate
    let sampleIndex = 0;       // monotonically increasing index per combined sample

    // --- Sliding window state for speed ---
    // FIFO of { index, value } for average computation
    let speedWindow = [];
    let speedWindowSum = 0;
    let avgSpeedOverPeriod = 0;

    // Monotonic deque (max queue) of { index, value } for window max
    let speedMaxDeque = [];
    let maxSpeedOverPeriod = 0;
    let maxAvgSpeedOverPeriod = 0;

    // --- Sliding window state for wind ---
    let windWindow = [];
    let windWindowSum = 0;
    let avgWindOverPeriod = 0;

    let windMaxDeque = [];
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

    const plugin = {
        start: function (props) {
            return __awaiter(this, void 0, void 0, function* () {
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

                    // Derived “Kn” paths (for knots output)
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

                    // Window size in samples
                    sampleIntervalSec = props.updaterate || 1;
                    windowSize = Math.max(1, Math.round(props.averagingPeriod / sampleIntervalSec));

                    const speedStream = app.streambundle.getSelfStream(props.speedPath);
                    const windStream = app.streambundle.getSelfStream(props.windSpeedPath);

                    unsubscribe = baconjs_1.combineWith(function (sog, tws) {
                        return formatData(sog, tws);
                    }, [
                        speedStream,
                        windStream,
                    ].map((s) => s.toProperty(undefined)))
                        .changes()
                        .debounceImmediate(sampleIntervalSec * 1000)
                        .onValue((value) => {
                            // global sample index for windowing
                            sampleIndex += 1;
                            count += 1;

                            updateAvgSpeed(value.speed, sampleIndex);
                            updateAvgWind(value.wind, sampleIndex);

                            updateSignalKAllTimePaths();
                            updateSignalKAveragePaths();
                        });
                } catch (e) {
                    plugin.started = false;
                    app.debug(e);
                }
            });
        },
        stop: function () {
            if (unsubscribe) {
                unsubscribe();
            }
        },
        statusMessage: function () {
            return `Started`;
        },
        signalKApiRoutes: function (router) {
            router.post("/reset-signalk-speed-wind-averaging", (req, res) => {
                reset();
                res.send('ok');
            });
            return router;
        },
        started: false,
        id: PLUGIN_ID,
        name: PLUGIN_NAME,
        description: "Calculates average and maximum values for speed over ground (SOG) and true wind speed (TWS).",
        schema: {
            type: 'object',
            required: ['speedPath', 'windSpeedPath', 'averagingPeriod'],
            properties: {
                speedPath: {
                    type: 'string',
                    title: 'The path of the SignalK speed data to use.',
                    default: 'navigation.speedOverGround',
                    enum: [
                        'navigation.speedOverGround',
                        'navigation.speedThroughWater',
                        'navigation.speedThroughWaterTransverse'
                    ]
                },
                windSpeedPath: {
                    type: 'string',
                    title: 'The path of the SignalK wind speed data to use.',
                    default: 'environment.wind.speedTrue',
                    enum: [
                        'environment.wind.speedTrue',
                        'environment.wind.speedOverGround',
                        'environment.wind.speedApparent'
                    ]
                },
                averagingPeriod: {
                    type: 'number',
                    title: 'The period over which to average (seconds)',
                    default: 20
                },
                windDeltas: {
                    type: "object",
                    title: "Wind Speed Paths",
                    properties: {
                        maxWindDeltaPath: {
                            type: 'string',
                            title: 'The path to which the all time max wind speed is published.',
                            default: 'environment.wind.speedMax'
                        },
                        maxWindOverPeriodDeltaPath: {
                            type: 'string',
                            title: 'The path to which the max wind speed over the averaging period is published.',
                            default: 'environment.wind.speedPeriodMax'
                        },
                        avgWindDeltaPath: {
                            type: 'string',
                            title: 'The path to which the all time average wind speed is published.',
                            default: 'environment.wind.speedAverage'
                        },
                        avgPeriodWindDeltaPath: {
                            type: 'string',
                            title: 'The path to which the average wind speed over the averaging period will be published.',
                            default: 'environment.wind.speedPeriodAverage'
                        },
                        maxAvgPeriodWindDeltaPath: {
                            type: 'string',
                            title: 'The path to which the maximum average wind speed over the averaging period will be published.',
                            default: 'environment.wind.speedMaxPeriodAverage'
                        },
                    },
                },
                speedDeltas: {
                    type: "object",
                    title: "Boat Speed Paths",
                    properties: {
                        maxSpeedDeltaPath: {
                            type: 'string',
                            title: 'The path to which the all time max boat speed is published.',
                            default: 'navigation.speedMax'
                        },
                        maxSpeedOverPeriodDeltaPath: {
                            type: 'string',
                            title: 'The path to which the max boat speed over the averaging period is published.',
                            default: 'navigation.speedPeriodMax'
                        },
                        avgSpeedDeltaPath: {
                            type: 'string',
                            title: 'The path to which the all time average boat speed is published.',
                            default: 'navigation.speedAverage'
                        },
                        avgPeriodSpeedDeltaPath: {
                            type: 'string',
                            title: 'The path to which the average boat speed over the averaging period will be published.',
                            default: 'navigation.speedPeriodAverage'
                        },
                        maxAvgPeriodSpeedDeltaPath: {
                            type: 'string',
                            title: 'The path to which the maximum boat speed average over the averaging period will be published.',
                            default: 'navigation.speedMaxPeriodAverage'
                        }
                    },
                },
            }
        }
    };

    return plugin;

    function reset() {
        count = 0;
        sampleIndex = 0;

        maxSpeed = 0;
        avgSpeed = 0;
        maxWind = 0;
        avgWind = 0;

        speedWindow = [];
        speedWindowSum = 0;
        avgSpeedOverPeriod = 0;
        speedMaxDeque = [];
        maxSpeedOverPeriod = 0;
        maxAvgSpeedOverPeriod = 0;

        windWindow = [];
        windWindowSum = 0;
        avgWindOverPeriod = 0;
        windMaxDeque = [];
        maxWindOverPeriod = 0;
        maxAvgWindOverPeriod = 0;

        updateSignalKAveragePaths();
        updateSignalKAllTimePaths();
    }

    function updateSignalKAveragePaths() {
        const values = [
            // SI (m/s)
            { path: maxWindOverPeriodDeltaPath, value: maxWindOverPeriod },
            { path: avgPeriodWindDeltaPath, value: avgWindOverPeriod },
            { path: maxAvgPeriodWindDeltaPath, value: maxAvgWindOverPeriod },
            { path: maxSpeedOverPeriodDeltaPath, value: maxSpeedOverPeriod },
            { path: avgPeriodSpeedDeltaPath, value: avgSpeedOverPeriod },
            { path: maxAvgPeriodSpeedDeltaPath, value: maxAvgSpeedOverPeriod },

            // Knots
            { path: maxWindOverPeriodDeltaPathKn, value: msToKnots(maxWindOverPeriod) },
            { path: avgPeriodWindDeltaPathKn, value: msToKnots(avgWindOverPeriod) },
            { path: maxAvgPeriodWindDeltaPathKn, value: msToKnots(maxAvgWindOverPeriod) },
            { path: maxSpeedOverPeriodDeltaPathKn, value: msToKnots(maxSpeedOverPeriod) },
            { path: avgPeriodSpeedDeltaPathKn, value: msToKnots(avgSpeedOverPeriod) },
            { path: maxAvgPeriodSpeedDeltaPathKn, value: msToKnots(maxAvgSpeedOverPeriod) },
        ].filter(v => v && typeof v.path === 'string' && v.path.length > 0);

        app.handleMessage('my-signalk-plugin', {
            updates: [{ values }]
        });
    }

    function updateSignalKAllTimePaths() {
        const values = [
            // SI (m/s)
            { path: maxWindDeltaPath, value: maxWind },
            { path: avgWindDeltaPath, value: avgWind },
            { path: maxSpeedDeltaPath, value: maxSpeed },
            { path: avgSpeedDeltaPath, value: avgSpeed },

            // Knots
            { path: maxWindDeltaPathKn, value: msToKnots(maxWind) },
            { path: avgWindDeltaPathKn, value: msToKnots(avgWind) },
            { path: maxSpeedDeltaPathKn, value: msToKnots(maxSpeed) },
            { path: avgSpeedDeltaPathKn, value: msToKnots(avgSpeed) },
        ].filter(v => v && typeof v.path === 'string' && v.path.length > 0);

        app.handleMessage('my-signalk-plugin', {
            updates: [{ values }]
        });
    }

    function msToKnots(v) {
        return typeof v === 'number' ? v * 1.9438444924406 : v;
    }

    function formatData(speed, wind) {
        return ({ speed: speed, wind: wind });
    }

    function updateAvgSpeed(speed, index) {
        if (typeof speed === 'number') {
            // All-time max and average
            if (speed > maxSpeed) {
                maxSpeed = speed;
            }
            avgSpeed = avgSpeed + (speed - avgSpeed) / count;

            // Sliding window: average (FIFO of {index, value})
            speedWindow.push({ index, value: speed });
            speedWindowSum += speed;

            const minIndex = index - windowSize + 1;

            // Remove expired samples from speedWindow
            while (speedWindow.length > 0 && speedWindow[0].index < minIndex) {
                const old = speedWindow.shift();
                speedWindowSum -= old.value;
            }

            // Sliding window: max (monotonic deque of {index, value})
            // Remove smaller values from back
            while (speedMaxDeque.length > 0 &&
                speedMaxDeque[speedMaxDeque.length - 1].value < speed) {
                speedMaxDeque.pop();
            }
            // Add new sample at back
            speedMaxDeque.push({ index, value: speed });

            // Remove expired indices from front
            while (speedMaxDeque.length > 0 &&
                speedMaxDeque[0].index < minIndex) {
                speedMaxDeque.shift();
            }

            if (speedWindow.length > 0) {
                avgSpeedOverPeriod = speedWindowSum / speedWindow.length;
                maxSpeedOverPeriod = speedMaxDeque.length > 0 ? speedMaxDeque[0].value : 0;

                if (avgSpeedOverPeriod > maxAvgSpeedOverPeriod) {
                    maxAvgSpeedOverPeriod = avgSpeedOverPeriod;
                }
            } else {
                avgSpeedOverPeriod = 0;
                maxSpeedOverPeriod = 0;
            }
        }
    }

    function updateAvgWind(windSpeed, index) {
        if (typeof windSpeed === 'number') {
            // All-time max and average
            if (windSpeed > maxWind) {
                maxWind = windSpeed;
            }
            avgWind = avgWind + (windSpeed - avgWind) / count;

            // Sliding window: average
            windWindow.push({ index, value: windSpeed });
            windWindowSum += windSpeed;

            const minIndex = index - windowSize + 1;

            // Remove expired samples from windWindow
            while (windWindow.length > 0 && windWindow[0].index < minIndex) {
                const old = windWindow.shift();
                windWindowSum -= old.value;
            }

            // Sliding window: max (monotonic deque)
            while (windMaxDeque.length > 0 &&
                windMaxDeque[windMaxDeque.length - 1].value < windSpeed) {
                windMaxDeque.pop();
            }
            windMaxDeque.push({ index, value: windSpeed });

            while (windMaxDeque.length > 0 &&
                windMaxDeque[0].index < minIndex) {
                windMaxDeque.shift();
            }

            if (windWindow.length > 0) {
                avgWindOverPeriod = windWindowSum / windWindow.length;
                maxWindOverPeriod = windMaxDeque.length > 0 ? windMaxDeque[0].value : 0;

                if (avgWindOverPeriod > maxAvgWindOverPeriod) {
                    maxAvgWindOverPeriod = avgWindOverPeriod;
                }
            } else {
                avgWindOverPeriod = 0;
                maxWindOverPeriod = 0;
            }
        }
    }
}

exports.default = default_1;
