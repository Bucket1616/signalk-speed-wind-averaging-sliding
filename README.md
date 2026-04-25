# signalk-speed-wind-averaging-sliding

This is a derivative of https://github.com/Boatly/signalk-speed-wind-averaging.

## Features
SignalK plugin to calculate average boat speed and wind speed over a sliding window,defined period.  The plugin receives boat speed and wind speed deltas every seconds and calculates running averages from that data.

The plugin calculates the following values:

- Maximum boat speed
- Maximum boat speed over the last [sample period] seconds
- Running average boat speed (all time average)
- The boat speed averaged over the last [sample period] seconds
- The maximum average [sample period] second boat speed

- Maximum wind speed
- Maximum wind speed over the last [sample_period] seconds
- Running average wind speed (all time average)
- The wind speed averaged over the last [sample period] seconds
- The maximum average [sample period] second wind speed

All values are calculated as m/s.

The following properties can be set in the plugin's configuration screen:

- The [sample_period] over which to average (10 seconds by default)
- The SignalK paths from which to read the current boat speed and wind speed
- The SignalK paths which are written to with the calculated values

To reset the running averages for boat speed and wind speed you can call the following handler:

`http://<signalk-server>/signalk/v1/api/reset-signalk-speed-wind-averaging-sliding`

## How this varies from Boatly/signalk-speed-wind-averaging
The original Boatly plugin captures samples over the [sample_period] amount of time.  When the total samples have been taken, the averages are transmitted and the buffer is emptied and a new sample widnw begins.  This is reasonable and useful for short sample period, however, when averaging over 15 mnutes, and hour, etc, it may be more useful to know what the averages were over the last [sample period] amount of time, not just what the averages were over a set [sample_period] amount of time

All-time averages and Maximums are still produced, however a deque is used to store maximums for the sliding window so that the processing time to calculate this is not excessive.

