import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type RootStackParamList } from '../../App';
import { type Article } from '../api/client';
import { useStylesWithArgs, getTheme } from '../hooks/useStyles';

interface NewsCardProps {
  article: Article;
  compact?: boolean;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NewsCard({ article, compact = false }: NewsCardProps) {
  const navigation = useNavigation<NavigationProp>();

  const handlePress = () => {
    navigation.navigate('Article', {
      url: article.link,
      title: article.title,
    });
  };

  const styles = useStylesWithArgs(newsCardStyles, compact);

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
      {article.image && !compact && (
        <Image source={{ uri: article.image }} style={styles.image} />
      )}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.source}>{article.source}</Text>
          <Text style={styles.time}>{article.timeAgo}</Text>
        </View>
        <Text style={styles.title} numberOfLines={compact ? 2 : 3}>
          {article.title}
        </Text>
        {article.description && !compact && (
          <Text style={styles.description} numberOfLines={2}>
            {article.description}
          </Text>
        )}
        {article.ticker && (
          <View style={styles.tickerBadge}>
            <Text style={styles.tickerText}>${article.ticker}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const newsCardStyles = (isDark: boolean, compact: boolean) => {
  const t = getTheme(isDark);
  return {
    card: {
      backgroundColor: t.card,
      borderRadius: 12,
      marginHorizontal: 16,
      marginVertical: 8,
      overflow: 'hidden' as const,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    image: {
      width: '100%' as const,
      height: 180,
      backgroundColor: t.surface,
    },
    content: {
      padding: compact ? 12 : 16,
    },
    header: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: 8,
    },
    source: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: t.text,
      textTransform: 'uppercase' as const,
    },
    time: {
      fontSize: 12,
      color: t.textSecondary,
    },
    title: {
      fontSize: compact ? 14 : 16,
      fontWeight: '700' as const,
      color: t.text,
      lineHeight: compact ? 20 : 22,
    },
    description: {
      fontSize: 14,
      color: isDark ? '#aaa' : '#666',
      marginTop: 8,
      lineHeight: 20,
    },
    tickerBadge: {
      backgroundColor: t.surface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      alignSelf: 'flex-start' as const,
      marginTop: 8,
    },
    tickerText: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: t.text,
    },
  };
};
