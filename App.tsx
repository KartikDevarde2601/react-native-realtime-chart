import {
  Canvas,
  Group,
  Path,
  Skia,
  Text,
  matchFont,
  rect
} from '@shopify/react-native-skia';
import { curveBasis, line, scaleLinear, scaleTime } from 'd3';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { runOnUI, useSharedValue } from 'react-native-reanimated';

const width = Dimensions.get('screen').width - 20;
const graphHeight = 280;
const gapBetweenGraphs = 40;
const totalHeight = graphHeight * 2 + gapBetweenGraphs;
const [timeSlots, fps] = [40, 60];

type DataPoint = {
  value: number;
  timestamp: Date;
};

const randomInt = (min: number = 0, max: number = 100): number => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

const generateRandomDateValues = (
  n: number = 10,
  min = 0,
  max = 100,
  fromDate: Date = new Date()
): DataPoint[] => {
  return Array.from(Array(n).keys()).map((_, i) => {
    return {
      value: randomInt(min, max),
      timestamp: new Date(fromDate.getTime() - n * 1000 + 1000 * i)
    };
  });
};

const yTicks = [0, 20, 40, 60, 80, 100];

const createBackgroundPath = (width: number, height: number) => {
  const path = Skia.Path.Make();
  path.addRect(rect(0, 0, width, height));
  return path;
};

export default function App() {
  const [tempData, setTempData] = useState<DataPoint[]>(
    () => generateRandomDateValues(timeSlots) // 30 initial points
  );

  const [humidityData, setHumidityData] = useState<DataPoint[]>(
    () => generateRandomDateValues(timeSlots) // 30 initial points
  );

  console.log('tempData', tempData);

  const tempPath = useSharedValue<string>('');
  const humidityPath = useSharedValue<string>('');
  const tempYPoints = useSharedValue<number[]>([]);
  const humidityYPoints = useSharedValue<number[]>([]);
  const backgroundPath = createBackgroundPath(width, graphHeight);

  const fontStyle = {
    fontFamily: 'Helvetica',
    fontSize: 11,
    fontWeight: 'bold'
  };
  const titleFontStyle = {
    fontFamily: 'Helvetica',
    fontSize: 16,
    fontWeight: 'bold'
  };
  const font = matchFont(fontStyle as any);
  const titleFont = matchFont(titleFontStyle as any);

  const calculatePath_humidity = useCallback((currentData: DataPoint[]) => {
    const xScale = scaleTime()
      .domain([
        new Date(Date.now() - (1000 / fps) * (timeSlots - 2)),
        new Date(Date.now() - (1000 / fps) * 2)
      ])
      .range([0, width]);

    const yScale = scaleLinear()
      .domain([0, 100])
      .range([graphHeight - 20, 20]);

    const l = line<DataPoint>()
      .x((d) => xScale(d.timestamp))
      .y((d) => yScale(d.value))
      .curve(curveBasis);

    const pathData = l(currentData)!;
    const calculatedYPoints = yTicks.map((tick) => yScale(tick));

    return {
      pathData,
      yPoints: calculatedYPoints
    };
  }, []);

  const calculatePath_Temperature = useCallback((currentData: DataPoint[]) => {
    const xScale = scaleTime()
      .domain([
        new Date(Date.now() - (1000 / fps) * (timeSlots - 2)),
        new Date(Date.now() - (1000 / fps) * 2)
      ])
      .range([0, width]);

    const yScale = scaleLinear()
      .domain([0, 100])
      .range([graphHeight - 20, 20]);

    const l = line<DataPoint>()
      .x((d) => xScale(d.timestamp))
      .y((d) => yScale(d.value))
      .curve(curveBasis);

    const pathData = l(currentData)!;
    const calculatedYPoints = yTicks.map((tick) => yScale(tick));

    return {
      pathData,
      yPoints: calculatedYPoints
    };
  }, []);

  const updatePath_temperature = useCallback(
    (pathString: string, newYPoints: number[]) => {
      'worklet';
      tempPath.value = pathString;
      tempYPoints.value = newYPoints;
    },
    []
  );

  const updatePath_humidity = useCallback(
    (pathString: string, newYPoints: number[]) => {
      'worklet';
      humidityPath.value = pathString;
      humidityYPoints.value = newYPoints;
    },
    []
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setHumidityData((prevData) => {
        const newData = [...prevData];
        newData.shift();
        newData.push({
          value: randomInt(30, 80),
          timestamp: new Date()
        });
        return newData;
      });

      setTempData((prevData) => {
        const newData = [...prevData];
        newData.shift();
        newData.push({
          value: randomInt(15, 35),
          timestamp: new Date()
        });
        return newData;
      });
    }, 1000 / fps);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const { pathData: tempPathData, yPoints: tempYPoints } =
      calculatePath_Temperature(tempData);
    const { pathData: humidityPathData, yPoints: humidityYPoints } =
      calculatePath_humidity(humidityData);

    runOnUI(updatePath_temperature)(tempPathData, tempYPoints);
    runOnUI(updatePath_humidity)(humidityPathData, humidityYPoints);
  }, [tempData, humidityData]);

  const Graph = ({ path, yPoints, title, yRange, yOffset = 0 }: any) => (
    <Group transform={[{ translateY: yOffset }]}>
      <Path path={backgroundPath} color="#111" />
      <Text
        text={title}
        x={width / 2 - 50}
        y={25}
        color="#fff"
        font={titleFont}
      />
      <Group>
        {yPoints.value.map((yPoint: number, i: number) => (
          <Group key={i}>
            <Path
              color="#222"
              style="stroke"
              strokeWidth={1}
              path={Skia.Path.Make()
                .moveTo(40, yPoint)
                .lineTo(width - 10, yPoint)}
            />
            <Text
              text={Math.round(
                (i * (yRange[1] - yRange[0])) / 5 + yRange[0]
              ).toString()}
              x={5}
              y={yPoint + 5}
              color="#666"
              font={font}
            />
          </Group>
        ))}
      </Group>
      <Group clip={rect(40, 0, width - 50, graphHeight)}>
        <Path
          style="stroke"
          strokeWidth={2}
          color="#4CAF50"
          path={Skia.Path.MakeFromSVGString(path.value) || Skia.Path.Make()}
        />
      </Group>
    </Group>
  );

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <Graph
          path={tempPath}
          yPoints={tempYPoints}
          title="Temperature (°C)"
          yRange={[15, 35]}
        />
        <Graph
          path={humidityPath}
          yPoints={humidityYPoints}
          title="Humidity (%)"
          yRange={[30, 80]}
          yOffset={graphHeight + gapBetweenGraphs}
        />
      </Canvas>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10
  },
  canvas: {
    width,
    height: totalHeight,
    backgroundColor: '#F8f8f8'
  }
});
