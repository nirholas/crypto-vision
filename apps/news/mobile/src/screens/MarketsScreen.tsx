import React from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  Text,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CoinCard from '../components/CoinCard';
import FearGreedGauge from '../components/FearGreedGauge';
import { useMarketCoins, useFearGreed } from '../hooks/useMarket';
import { useStyles, getTheme } from '../hooks/useStyles';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import type { MarketCoin } from '../api/client';

export default function MarketsScreen() {
  // Performance telemetry — tracks FPS and slow renders on this screen
  usePerformanceMonitor('MarketsScreen');

  const { coins, loading, error, refresh } = useMarketCoins(50);
  const fearGreed = useFearGreed();
  const styles = useStyles(marketsStyles);

  const renderHeader = () => (
    <View style={styles.header}>
      {fearGreed.data && <FearGreedGauge data={fearGreed.data} />}
      <View style={styles.tableHeader}>
        <Text style={styles.headerText}>Coin</Text>
        <Text style={[styles.headerText, styles.headerPrice]}>Price</Text>
        <Text style={[styles.headerText, styles.headerChange]}>24h</Text>
      </View>
    </View>
  );

  if (loading && coins.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Loading markets...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <FlatList<MarketCoin>
        data={coins}
        keyExtractor={(item: MarketCoin) => item.id}
        renderItem={renderCoinCard}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor="#ffffff"
            colors={['#ffffff']}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// Stable renderItem ref — avoids FlatList re-creating row components on every render.
// This is critical for lists of 50+ items: without it, every parent re-render
// causes all rows to unmount/remount, destroying scroll performance.
const renderCoinCard = ({ item }: { item: MarketCoin }) => <CoinCard coin={item} />;

const marketsStyles = (isDark: boolean) => {
  const t = getTheme(isDark);
  return {
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    loadingText: {
      marginTop: 12,
      color: t.textSecondary,
      fontSize: 14,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 20,
    },
    errorText: {
      color: '#ef4444',
      textAlign: 'center' as const,
    },
    header: {
      paddingVertical: 8,
    },
    tableHeader: {
      flexDirection: 'row' as const,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: t.card,
      marginTop: 8,
    },
    headerText: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: t.textSecondary,
      textTransform: 'uppercase' as const,
      flex: 1,
    },
    headerPrice: {
      textAlign: 'right' as const,
      marginRight: 12,
    },
    headerChange: {
      width: 70,
      textAlign: 'center' as const,
    },
  };
};
