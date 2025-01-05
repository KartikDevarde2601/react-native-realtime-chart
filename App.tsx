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

const [width, height] = [Dimensions.get('screen').width - 10, 300];
const [timeSlots, fps] = [40, 60];

type DataPoint = {
  date: Date;
  value: number;
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
  return Array.from(Array(n).keys()).map((_, i) => ({
    date: new Date(fromDate.getTime() - n * 1000 + 1000 * i),
    value: randomInt(min, max)
  }));
};

// Pre-calculate ticks for y-axis
const yTicks = [0, 20, 40, 60, 80, 100];

export default function App() {
  const [data, setData] = useState<DataPoint[]>(
    generateRandomDateValues(timeSlots)
  );

  const path = useSharedValue<string>('');
  const yPoints = useSharedValue<number[]>([]);

  const fontStyle = {
    fontFamily: 'Helvetica',
    fontSize: 11,
    fontWeight: 'bold'
  };
  const font = matchFont(fontStyle as any);

  // Calculate scales on JS thread
  const calculatePath = useCallback((currentData: DataPoint[]) => {
    const xScale = scaleTime()
      .domain([
        new Date(new Date().getTime() - (1000 / fps) * (timeSlots - 2)),
        new Date(new Date().getTime() - (1000 / fps) * 2)
      ])
      .range([0, width]);

    const yScale = scaleLinear()
      .domain([0, 100])
      .range([height - 20, 20]);

    const l = line<DataPoint>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.value))
      .curve(curveBasis);

    const pathData = l(currentData)!;
    const calculatedYPoints = yTicks.map((tick) => yScale(tick));

    return {
      pathData,
      yPoints: calculatedYPoints
    };
  }, []);

  // Worklet to update shared values
  const updatePath = useCallback((pathString: string, newYPoints: number[]) => {
    'worklet';
    path.value = pathString;
    yPoints.value = newYPoints;
  }, []);

  // Initialize and update path
  useEffect(() => {
    const { pathData, yPoints: newYPoints } = calculatePath(data);
    runOnUI(updatePath)(pathData, newYPoints);
  }, [data, calculatePath, updatePath]);

  // Update data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setData((currentData) => {
        const newData = [...currentData];
        newData.shift();
        newData.push({
          date: new Date(),
          value: randomInt()
        });
        return newData;
      });
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <Canvas style={{ width, height }}>
        <Group>
          {yPoints.value.map((yPoint, i) => (
            <Group key={i}>
              <Path
                color="#090909"
                style="stroke"
                strokeWidth={2}
                path={`M30,${yPoint} L${width},${yPoint}`}
              />
              <Text
                text={yTicks[i].toString()}
                x={0}
                y={yPoint + 5}
                color="#474747"
                font={font}
              />
            </Group>
          ))}
        </Group>
        <Group clip={rect(30, 0, width, height)}>
          <Path
            style="stroke"
            strokeWidth={2}
            color="#fff"
            path={Skia.Path.MakeFromSVGString(path.value) || Skia.Path.Make()}
          />
        </Group>
      </Canvas>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
