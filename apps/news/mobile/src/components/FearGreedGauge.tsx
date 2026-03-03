import React from 'react';
import {
  View,
  Text,
} from 'react-native';
import { useStyles, getTheme } from '../hooks/useStyles';
import { type FearGreed } from '../api/client';

interface FearGreedGaugeProps {
  data: FearGreed;
}

export default function FearGreedGauge({ data }: FearGreedGaugeProps) {

  const getColor = (value: number) => {
    if (value <= 25) return '#ef4444'; // Extreme Fear
    if (value <= 45) return '#f97316'; // Fear
    if (value <= 55) return '#eab308'; // Neutral
    if (value <= 75) return '#84cc16'; // Greed
    return '#22c55e'; // Extreme Greed
  };

  const styles = useStyles(gaugeStyles);
  const color = getColor(data.value);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fear & Greed Index</Text>
      <View style={styles.gaugeContainer}>
        <View style={styles.gauge}>
          <View 
            style={[
              styles.gaugeFill, 
              { width: `${data.value}%`, backgroundColor: color }
            ]} 
          />
        </View>
        <View style={styles.valueContainer}>
          <Text style={[styles.value, { color }]}>{data.value}</Text>
          <Text style={[styles.classification, { color }]}>{data.classification}</Text>
        </View>
      </View>
      <View style={styles.labels}>
        <Text style={styles.label}>Extreme Fear</Text>
        <Text style={styles.label}>Extreme Greed</Text>
      </View>
    </View>
  );
}

const gaugeStyles = (isDark: boolean) => {
  const t = getTheme(isDark);
  return {
    container: {
      backgroundColor: t.card,
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 8,
    },
    title: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: t.textSecondary,
      marginBottom: 12,
    },
    gaugeContainer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 16,
    },
    gauge: {
      flex: 1,
      height: 8,
      backgroundColor: t.surface,
      borderRadius: 4,
      overflow: 'hidden' as const,
    },
    gaugeFill: {
      height: '100%' as const,
      borderRadius: 4,
    },
    valueContainer: {
      alignItems: 'flex-end' as const,
    },
    value: {
      fontSize: 28,
      fontWeight: '700' as const,
    },
    classification: {
      fontSize: 12,
      fontWeight: '600' as const,
      textTransform: 'uppercase' as const,
    },
    labels: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      marginTop: 8,
    },
    label: {
      fontSize: 11,
      color: isDark ? '#666' : '#888',
    },
  };
};
