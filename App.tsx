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
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { runOnUI, useSharedValue } from 'react-native-reanimated';

const width = Dimensions.get('screen').width - 20;
const graphHeight = 280;
const gapBetweenGraphs = 40;
const totalHeight = graphHeight * 2 + gapBetweenGraphs;
const [timeSlots, fps] = [40, 60];

type DataPoint = {
  date: Date;
  value: number;
  timestamp: number; // Added for synchronization
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
    const date = new Date(fromDate.getTime() - (n - i) * 1000);
    return {
      date,
      value: randomInt(min, max),
      timestamp: date.getTime()
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
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const animationFrameRef = useRef<number>();

  const [tempData, setTempData] = useState<DataPoint[]>(
    () => generateRandomDateValues(30, 15, 35) // 30 initial points
  );

  const [humidityData, setHumidityData] = useState<DataPoint[]>(
    () => generateRandomDateValues(30, 30, 80) // 30 initial points
  );

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

  const calculatePath = useCallback(
    (currentData: DataPoint[], range: [number, number]) => {
      const xScale = scaleTime()
        .domain([
          new Date(Date.now() - (1000 / fps) * (timeSlots - 2)),
          new Date(Date.now() - (1000 / fps) * 2)
        ])
        .range([0, width - 40]);

      const yScale = scaleLinear()
        .domain(range)
        .range([graphHeight - 40, 20]);

      const l = line<DataPoint>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.value))
        .curve(curveBasis);

      const pathData = l(currentData)!;
      const calculatedYPoints = yTicks.map((tick) =>
        yScale((tick * (range[1] - range[0])) / 100 + range[0])
      );

      return {
        pathData,
        yPoints: calculatedYPoints
      };
    },
    []
  );

  const updatePath = useCallback(
    (pathString: string, newYPoints: number[], isTemp: boolean) => {
      'worklet';
      if (isTemp) {
        tempPath.value = pathString;
        tempYPoints.value = newYPoints;
      } else {
        humidityPath.value = pathString;
        humidityYPoints.value = newYPoints;
      }
    },
    []
  );

  const updateGraphs = useCallback(() => {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastUpdateTime;

    if (timeDiff >= 1000 / fps) {
      const newTimestamp = Date.now();
      const newValue = {
        date: new Date(newTimestamp),
        value: 0,
        timestamp: newTimestamp
      };

      setTempData((currentData) => {
        const newData = [
          ...currentData.slice(1),
          {
            ...newValue,
            value: randomInt(15, 35)
          }
        ];
        return newData;
      });

      setHumidityData((currentData) => {
        const newData = [
          ...currentData.slice(1),
          {
            ...newValue,
            value: randomInt(30, 80)
          }
        ];
        return newData;
      });

      setLastUpdateTime(currentTime);
    }

    animationFrameRef.current = requestAnimationFrame(updateGraphs);
  }, [lastUpdateTime]);

  useEffect(() => {
    const { pathData: tempPathData, yPoints: tempYPoints } = calculatePath(
      tempData,
      [15, 35]
    );
    const { pathData: humidityPathData, yPoints: humidityYPoints } =
      calculatePath(humidityData, [30, 80]);

    runOnUI(updatePath)(tempPathData, tempYPoints, true);
    runOnUI(updatePath)(humidityPathData, humidityYPoints, false);
  }, [tempData, humidityData]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updateGraphs);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateGraphs]);

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
