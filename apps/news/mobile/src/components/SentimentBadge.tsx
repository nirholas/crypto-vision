import React from 'react';
import {
  View,
  Text,
} from 'react-native';
import { useStyles, getTheme } from '../hooks/useStyles';
import { type Sentiment } from '../api/client';

interface SentimentBadgeProps {
  sentiment: Sentiment;
  asset?: string;
}

export default function SentimentBadge({ sentiment, asset }: SentimentBadgeProps) {

  const getColor = (label: string) => {
    switch (label) {
      case 'bullish': return '#22c55e';
      case 'bearish': return '#ef4444';
      default: return '#eab308';
    }
  };

  const getIcon = (label: string) => {
    switch (label) {
      case 'bullish': return '📈';
      case 'bearish': return '📉';
      default: return '➡️';
    }
  };

  const styles = useStyles(badgeStyles);
  const color = getColor(sentiment.label);

  return (
    <View style={[styles.container, { borderColor: color }]}>
      <Text style={styles.icon}>{getIcon(sentiment.label)}</Text>
      <View style={styles.content}>
        <Text style={styles.title}>
          {asset ? `${asset} Sentiment` : 'Market Sentiment'}
        </Text>
        <View style={styles.row}>
          <Text style={[styles.label, { color }]}>
            {sentiment.label.toUpperCase()}
          </Text>
          <Text style={styles.score}>
            Score: {sentiment.score.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const badgeStyles = (isDark: boolean) => {
  const t = getTheme(isDark);
  return {
    container: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: t.card,
      borderRadius: 12,
      borderLeftWidth: 4,
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 8,
    },
    icon: {
      fontSize: 32,
      marginRight: 12,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 13,
      color: t.textSecondary,
      marginBottom: 4,
    },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
    },
    label: {
      fontSize: 16,
      fontWeight: '700' as const,
    },
    score: {
      fontSize: 14,
      color: t.textSecondary,
    },
  };
};
