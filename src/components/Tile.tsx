import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Svg, Circle, Polygon, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import type { Tile as TileType } from '../types/game';
import { TILE_SIZE, TILE_COLORS, GRID_GAP } from '../constants/theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface Props {
  tile: TileType;
  isSelected: boolean;
  onTap: (tileId: string) => void;
}

const SPRING_SPAWN  = { damping: 22, stiffness: 550 };
const SPRING_SELECT = { damping: 18, stiffness: 350 };

export function Tile({ tile, isSelected, onTap }: Props) {
  const scale         = useSharedValue(1.35);
  const glowIntensity = useSharedValue(0);
  const starPulse     = useSharedValue(0);

  const { row, col } = tile.position;
  const colors        = TILE_COLORS[tile.color];
  const isStar        = tile.value === 'star';
  const shadowColor   = isStar ? '#FFD700' : colors.light;

  // Spawn pop
  useEffect(() => {
    scale.value = withSpring(1, SPRING_SPAWN);
  }, []);

  // Star ambient glow — always pulsing for star tiles
  useEffect(() => {
    if (isStar) {
      starPulse.value = withRepeat(
        withSequence(
          withTiming(1,    { duration: 900 }),
          withTiming(0.15, { duration: 900 }),
        ),
        -1,
        true,
      );
    } else {
      starPulse.value = withTiming(0, { duration: 180 });
    }
  }, [isStar]);

  // Selection glow
  useEffect(() => {
    if (isSelected) {
      scale.value = withSpring(1.1, SPRING_SELECT);
      glowIntensity.value = withRepeat(
        withSequence(
          withTiming(1,   { duration: 380 }),
          withTiming(0.3, { duration: 380 }),
        ),
        -1,
        true,
      );
    } else {
      scale.value = withSpring(1, SPRING_SELECT);
      glowIntensity.value = withTiming(0, { duration: 180 });
    }
  }, [isSelected]);

  const tap = Gesture.Tap().onEnd(() => runOnJS(onTap)(tile.id));

  const animStyle = useAnimatedStyle(() => {
    const starActive = starPulse.value;
    const selActive  = glowIntensity.value;
    return {
      transform: [{ scale: scale.value }],
      zIndex: scale.value > 1 ? 10 : 1,
      shadowOpacity: isStar
        ? 0.25 + starActive * 0.65
        : 0.2  + selActive  * 0.6,
      shadowRadius: isStar
        ? 8  + starActive * 22
        : 6  + selActive  * 20,
      elevation: isStar
        ? 8  + starActive * 12
        : 6  + selActive  * 12,
    };
  });

  // Star outer ring: golden, always animating
  const starRingProps = useAnimatedProps(() => ({
    opacity:     starPulse.value * 0.75,
    strokeWidth: 2 + starPulse.value * 4,
  }));

  // Selection ring: tile's own color, pulses with selection
  const selRingProps = useAnimatedProps(() => ({
    opacity:     glowIntensity.value,
    strokeWidth: 4 + glowIntensity.value * 2,
  }));

  const left    = col * (TILE_SIZE + GRID_GAP);
  const top     = row * (TILE_SIZE + GRID_GAP);
  const gradId  = `g${tile.id}`;
  const glossId = `gl${tile.id}`;

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[styles.tile, { left, top, shadowColor }, animStyle]}>
        <Svg width={TILE_SIZE} height={TILE_SIZE} viewBox="-6 -6 132 132">
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"   stopColor={colors.light} />
              <Stop offset="55%"  stopColor={colors.base}  />
              <Stop offset="100%" stopColor={colors.dark}  />
            </LinearGradient>
            <LinearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"   stopColor="white" stopOpacity={0.4} />
              <Stop offset="100%" stopColor="white" stopOpacity={0}   />
            </LinearGradient>
          </Defs>

          {/* Star outer glow ring — gold, always on for star tiles */}
          {isStar && (
            <AnimatedRect
              x={-4} y={-4} width={128} height={128} rx={24}
              fill="none" stroke="#FFD700"
              animatedProps={starRingProps}
            />
          )}

          {/* Drop shadow */}
          <Rect x={6} y={9} width={108} height={108} rx={18}
                fill={colors.shadow} opacity={0.6} />

          {/* Main tile body */}
          <Rect x={5} y={5} width={110} height={110} rx={18}
                fill={`url(#${gradId})`} />

          {/* Gloss overlay */}
          <Rect x={5} y={5} width={110} height={55} rx={18}
                fill={`url(#${glossId})`} />

          {/* Tile border */}
          <Rect x={5} y={5} width={110} height={110} rx={18}
                fill="none" stroke={colors.border} strokeWidth={1.5} opacity={0.6} />

          {/* Selection ring — tile's own color */}
          <AnimatedRect
            x={1} y={1} width={118} height={118} rx={21}
            fill="none" stroke={colors.light}
            animatedProps={selRingProps}
          />

          {/* Shape */}
          {tile.value === 'circle' && (
            <Circle cx={60} cy={62} r={24} fill="white" opacity={0.95} />
          )}
          {tile.value === 'diamond' && (
            <Polygon points="60,36 84,62 60,88 36,62" fill="white" opacity={0.95} />
          )}
          {tile.value === 'star' && (
            <Polygon
              points="60,22 67,46 92,46 72,61 79,85 60,70 41,85 48,61 28,46 53,46"
              fill="white" opacity={0.95}
            />
          )}
        </Svg>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
});
