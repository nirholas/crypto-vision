/**
 * Source Network Forensics
 *
 * Advanced analysis of news source relationships, coordinated publishing detection,
 * origin tracing, and network visualization for crypto news.
 *
 * Features:
 * - Source relationship graph construction
 * - Coordinated publishing detection
 * - Original source tracing
 * - Content similarity forensics
 * - Publication timing analysis
 * - Source influence scoring
 * - Network clustering
 * - Plagiarism detection
 *
 * @module source-forensics
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface SourceNode {
  sourceId: string;
  name: string;
  domain: string;
  type: SourceType;
  metadata: SourceMetadata;
  metrics: SourceMetrics;
  firstSeen: Date;
  lastSeen: Date;
}

export type SourceType =
  | 'mainstream'
  | 'crypto-native'
  | 'blog'
  | 'aggregator'
  | 'press-release'
  | 'social'
  | 'institutional'
  | 'unknown';

export interface SourceMetadata {
  country?: string;
  language: string;
  founded?: Date;
  parent?: string;
  knownAliases: string[];
  officialSocials: Record<string, string>;
  rssUrl?: string;
  apiAvailable: boolean;
}

export interface SourceMetrics {
  totalArticles: number;
  averageArticlesPerDay: number;
  averagePublishDelay: number; // seconds after first appearance elsewhere
  originalContentRatio: number; // 0-1
  citationRate: number; // how often cited by others
  breakingNewsRate: number; // how often first to report
  accuracyScore: number; // 0-1 based on corrections/retractions
  influenceScore: number; // 0-1 derived from citations + first-mover
}

export interface SourceEdge {
  fromSourceId: string;
  toSourceId: string;
  relationshipType: RelationshipType;
  strength: number; // 0-1
  evidence: EdgeEvidence[];
  firstObserved: Date;
  lastObserved: Date;
  occurrences: number;
}

export type RelationshipType =
  | 'cites' // explicitly cites another source
  | 'syndicates' // republishes content from
  | 'precedes' // consistently publishes before
  | 'follows' // consistently publishes after
  | 'coordinates' // suspicious timing correlation
  | 'competes' // covers same stories independently
  | 'parent' // ownership relationship
  | 'affiliate' // affiliate/partnership
  | 'mirrors' // near-identical content
  | 'translates'; // translation of content

export interface EdgeEvidence {
  articleId: string;
  timestamp: Date;
  evidenceType: string;
  similarity?: number;
  timeDelta?: number;
  details: Record<string, unknown>;
}

export interface CoordinationPattern {
  patternId: string;
  type: CoordinationType;
  sources: string[];
  detectedAt: Date;
  confidence: number;
  evidence: CoordinationEvidence[];
  isActive: boolean;
  firstOccurrence: Date;
  occurrenceCount: number;
}

export type CoordinationType =
  | 'synchronized-publish' // publish within tight window
  | 'identical-phrasing' // same unusual phrases
  | 'shared-embargo' // honor same embargo
  | 'cascade-pattern' // predictable republish order
  | 'narrative-amplification' // coordinated narrative push
  | 'sock-puppet' // same entity behind multiple "sources"
  | 'pump-and-dump' // coordinated price manipulation coverage
  | 'fud-campaign' // coordinated negative coverage
  | 'astroturf'; // fake grassroots campaign

export interface CoordinationEvidence {
  type: string;
  articles: string[];
  timestamps: Date[];
  similarity: number;
  anomalyScore: number;
  details: Record<string, unknown>;
}

export interface OriginTrace {
  articleId: string;
  title: string;
  claimedSource: string;
  probableOrigin: OriginCandidate;
  alternatives: OriginCandidate[];
  traceChain: TraceStep[];
  confidence: number;
  analysisTimestamp: Date;
}

export interface OriginCandidate {
  sourceId: string;
  articleId: string;
  publishedAt: Date;
  confidence: number;
  evidence: OriginEvidence[];
}

export interface OriginEvidence {
  type: 'timing' | 'citation' | 'similarity' | 'exclusive-info' | 'author' | 'metadata';
  weight: number;
  details: string;
}

export interface TraceStep {
  sourceId: string;
  articleId: string;
  timestamp: Date;
  action: 'originated' | 'republished' | 'cited' | 'modified' | 'translated';
  changes?: ContentDelta[];
}

export interface ContentDelta {
  type: 'addition' | 'removal' | 'modification' | 'translation';
  location: string;
  originalText?: string;
  newText?: string;
  significance: number; // 0-1
}

export interface ForensicsReport {
  reportId: string;
  generatedAt: Date;
  timeRange: { start: Date; end: Date };
  totalSources: number;
  totalArticles: number;
  networkSummary: NetworkSummary;
  coordinationAlerts: CoordinationPattern[];
  originIssues: OriginIssue[];
  influenceRankings: InfluenceRanking[];
  suspiciousPatterns: SuspiciousPattern[];
  recommendations: ForensicsRecommendation[];
}

export interface NetworkSummary {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageClustering: number;
  communities: SourceCommunity[];
  centralSources: string[];
  peripheralSources: string[];
  bridgeSources: string[]; // connect otherwise separate clusters
}

export interface SourceCommunity {
  communityId: string;
  name: string;
  sources: string[];
  characteristics: string[];
  internalCohesion: number;
  externalConnections: number;
}

export interface OriginIssue {
  type: 'misattribution' | 'plagiarism' | 'uncredited' | 'fabrication';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedArticles: string[];
  originalSource?: string;
  claimedSource: string;
  evidence: string;
}

export interface InfluenceRanking {
  sourceId: string;
  rank: number;
  score: number;
  breakdown: {
    firstMover: number;
    citations: number;
    reach: number;
    accuracy: number;
    originality: number;
  };
}

export interface SuspiciousPattern {
  patternId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  sources: string[];
  articles: string[];
  confidence: number;
  actionRequired: boolean;
}

export interface ForensicsRecommendation {
  type: 'monitor' | 'investigate' | 'flag' | 'block' | 'alert';
  target: string;
  reason: string;
  priority: number;
  suggestedAction: string;
}

// ============================================================================
// SOURCE GRAPH CLASS
// ============================================================================

export class SourceGraph {
  private nodes: Map<string, SourceNode> = new Map();
  private edges: Map<string, SourceEdge[]> = new Map();
  private reverseEdges: Map<string, SourceEdge[]> = new Map();

  addNode(node: SourceNode): void {
    this.nodes.set(node.sourceId, node);
    if (!this.edges.has(node.sourceId)) {
      this.edges.set(node.sourceId, []);
    }
    if (!this.reverseEdges.has(node.sourceId)) {
      this.reverseEdges.set(node.sourceId, []);
    }
  }

  addEdge(edge: SourceEdge): void {
    const existing = this.edges.get(edge.fromSourceId);
    if (existing) {
      const existingEdge = existing.find(
        (e) =>
          e.toSourceId === edge.toSourceId && e.relationshipType === edge.relationshipType
      );
      if (existingEdge) {
        existingEdge.occurrences += 1;
        existingEdge.lastObserved = edge.lastObserved;
        existingEdge.evidence.push(...edge.evidence);
        existingEdge.strength = Math.min(
          1,
          existingEdge.strength + 0.05
        );
      } else {
        existing.push(edge);
      }
    } else {
      this.edges.set(edge.fromSourceId, [edge]);
    }

    // Reverse edges for incoming queries
    const reverseExisting = this.reverseEdges.get(edge.toSourceId);
    if (reverseExisting) {
      if (!reverseExisting.find(
        (e) =>
          e.fromSourceId === edge.fromSourceId &&
          e.relationshipType === edge.relationshipType
      )) {
        reverseExisting.push(edge);
      }
    } else {
      this.reverseEdges.set(edge.toSourceId, [edge]);
    }
  }

  getNode(sourceId: string): SourceNode | undefined {
    return this.nodes.get(sourceId);
  }

  getOutgoingEdges(sourceId: string): SourceEdge[] {
    return this.edges.get(sourceId) || [];
  }

  getIncomingEdges(sourceId: string): SourceEdge[] {
    return this.reverseEdges.get(sourceId) || [];
  }

  getAllNodes(): SourceNode[] {
    return Array.from(this.nodes.values());
  }

  getAllEdges(): SourceEdge[] {
    const allEdges: SourceEdge[] = [];
    for (const edges of this.edges.values()) {
      allEdges.push(...edges);
    }
    return allEdges;
  }

  getShortestPath(fromId: string, toId: string): string[] | null {
    const visited = new Set<string>();
    const queue: { nodeId: string; path: string[] }[] = [
      { nodeId: fromId, path: [fromId] },
    ];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === toId) {
        return path;
      }

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const edges = this.getOutgoingEdges(nodeId);
      for (const edge of edges) {
        if (!visited.has(edge.toSourceId)) {
          queue.push({
            nodeId: edge.toSourceId,
            path: [...path, edge.toSourceId],
          });
        }
      }
    }

    return null;
  }

  getNetworkStats(): NetworkSummary {
    const nodeCount = this.nodes.size;
    const allEdges = this.getAllEdges();
    const edgeCount = allEdges.length;
    const maxPossibleEdges = nodeCount * (nodeCount - 1);
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

    // Calculate clustering coefficient
    let totalClustering = 0;
    for (const [nodeId] of this.nodes) {
      const neighbors = new Set<string>();
      for (const edge of this.getOutgoingEdges(nodeId)) {
        neighbors.add(edge.toSourceId);
      }
      for (const edge of this.getIncomingEdges(nodeId)) {
        neighbors.add(edge.fromSourceId);
      }

      const neighborArray = Array.from(neighbors);
      const k = neighborArray.length;
      if (k < 2) continue;

      let triangles = 0;
      for (let i = 0; i < neighborArray.length; i++) {
        for (let j = i + 1; j < neighborArray.length; j++) {
          const n1 = neighborArray[i];
          const n2 = neighborArray[j];
          // Check if there's an edge between neighbors
          const edgesFromN1 = this.getOutgoingEdges(n1);
          const edgesFromN2 = this.getOutgoingEdges(n2);
          if (
            edgesFromN1.some((e) => e.toSourceId === n2) ||
            edgesFromN2.some((e) => e.toSourceId === n1)
          ) {
            triangles++;
          }
        }
      }
      const possibleTriangles = (k * (k - 1)) / 2;
      totalClustering += triangles / possibleTriangles;
    }
    const averageClustering = this.nodes.size > 0 ? totalClustering / this.nodes.size : 0;

    // Detect communities using label propagation
    const communities = this.detectCommunities();

    // Find central sources (high degree)
    const degrees = new Map<string, number>();
    for (const [nodeId] of this.nodes) {
      const outDegree = this.getOutgoingEdges(nodeId).length;
      const inDegree = this.getIncomingEdges(nodeId).length;
      degrees.set(nodeId, outDegree + inDegree);
    }
    const sortedByDegree = Array.from(degrees.entries())
      .sort((a, b) => b[1] - a[1]);
    const centralSources = sortedByDegree.slice(0, 10).map(([id]) => id);
    const peripheralSources = sortedByDegree.slice(-10).map(([id]) => id);

    // Find bridge sources (connect different communities)
    const bridgeSources = this.findBridgeSources(communities);

    return {
      nodeCount,
      edgeCount,
      density,
      averageClustering,
      communities,
      centralSources,
      peripheralSources,
      bridgeSources,
    };
  }

  private detectCommunities(): SourceCommunity[] {
    // Label propagation algorithm
    const labels = new Map<string, string>();
    for (const [nodeId] of this.nodes) {
      labels.set(nodeId, nodeId);
    }

    const maxIterations = 100;
    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = false;
      const nodeIds = Array.from(this.nodes.keys());
      // Shuffle for randomness
      for (let i = nodeIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nodeIds[i], nodeIds[j]] = [nodeIds[j], nodeIds[i]];
      }

      for (const nodeId of nodeIds) {
        const neighborLabels = new Map<string, number>();

        for (const edge of this.getOutgoingEdges(nodeId)) {
          const label = labels.get(edge.toSourceId);
          if (label) {
            neighborLabels.set(label, (neighborLabels.get(label) || 0) + edge.strength);
          }
        }
        for (const edge of this.getIncomingEdges(nodeId)) {
          const label = labels.get(edge.fromSourceId);
          if (label) {
            neighborLabels.set(label, (neighborLabels.get(label) || 0) + edge.strength);
          }
        }

        if (neighborLabels.size > 0) {
          const maxLabel = Array.from(neighborLabels.entries())
            .sort((a, b) => b[1] - a[1])[0][0];
          if (maxLabel !== labels.get(nodeId)) {
            labels.set(nodeId, maxLabel);
            changed = true;
          }
        }
      }

      if (!changed) break;
    }

    // Group by label
    const communityMap = new Map<string, string[]>();
    for (const [nodeId, label] of labels) {
      if (!communityMap.has(label)) {
        communityMap.set(label, []);
      }
      communityMap.get(label)!.push(nodeId);
    }

    // Convert to community objects
    const communities: SourceCommunity[] = [];
    let communityIndex = 1;
    for (const [, sources] of communityMap) {
      if (sources.length < 2) continue;

      // Calculate internal cohesion
      let internalEdges = 0;
      let externalEdges = 0;
      const sourceSet = new Set(sources);

      for (const source of sources) {
        for (const edge of this.getOutgoingEdges(source)) {
          if (sourceSet.has(edge.toSourceId)) {
            internalEdges++;
          } else {
            externalEdges++;
          }
        }
      }

      const possibleInternalEdges = sources.length * (sources.length - 1);
      const internalCohesion = possibleInternalEdges > 0
        ? internalEdges / possibleInternalEdges
        : 0;

      // Determine characteristics
      const characteristics: string[] = [];
      const types = sources.map((s) => this.nodes.get(s)?.type).filter(Boolean);
      const typeCounts = new Map<string, number>();
      for (const type of types) {
        typeCounts.set(type!, (typeCounts.get(type!) || 0) + 1);
      }
      const dominantType = Array.from(typeCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];
      if (dominantType && dominantType[1] > types.length * 0.5) {
        characteristics.push(`Primarily ${dominantType[0]}`);
      }

      communities.push({
        communityId: `community-${communityIndex++}`,
        name: `Community ${communityIndex - 1}`,
        sources,
        characteristics,
        internalCohesion,
        externalConnections: externalEdges,
      });
    }

    return communities.sort((a, b) => b.sources.length - a.sources.length);
  }

  private findBridgeSources(communities: SourceCommunity[]): string[] {
    const bridgeScores = new Map<string, number>();
    const sourceToComm = new Map<string, string>();

    for (const comm of communities) {
      for (const source of comm.sources) {
        sourceToComm.set(source, comm.communityId);
      }
    }

    for (const [nodeId] of this.nodes) {
      const myComm = sourceToComm.get(nodeId);
      if (!myComm) continue;

      const connectedComms = new Set<string>();
      for (const edge of this.getOutgoingEdges(nodeId)) {
        const targetComm = sourceToComm.get(edge.toSourceId);
        if (targetComm && targetComm !== myComm) {
          connectedComms.add(targetComm);
        }
      }
      for (const edge of this.getIncomingEdges(nodeId)) {
        const sourceComm = sourceToComm.get(edge.fromSourceId);
        if (sourceComm && sourceComm !== myComm) {
          connectedComms.add(sourceComm);
        }
      }

      if (connectedComms.size > 0) {
        bridgeScores.set(nodeId, connectedComms.size);
      }
    }

    return Array.from(bridgeScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);
  }

  toJSON(): { nodes: SourceNode[]; edges: SourceEdge[] } {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
    };
  }

  static fromJSON(data: { nodes: SourceNode[]; edges: SourceEdge[] }): SourceGraph {
    const graph = new SourceGraph();
    for (const node of data.nodes) {
      graph.addNode(node);
    }
    for (const edge of data.edges) {
      graph.addEdge(edge);
    }
    return graph;
  }
}

// ============================================================================
// CONTENT SIMILARITY ENGINE
// ============================================================================

export interface SimilarityResult {
  articleId1: string;
  articleId2: string;
  overallSimilarity: number;
  titleSimilarity: number;
  bodySimilarity: number;
  structureSimilarity: number;
  semanticSimilarity: number;
  sharedPhrases: string[];
  isLikelyDuplicate: boolean;
  isPotentialPlagiarism: boolean;
}

/**
 * Calculate n-gram similarity between two texts
 */
export function nGramSimilarity(text1: string, text2: string, n: number = 3): number {
  const getNGrams = (text: string): Set<string> => {
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = normalized.split(/\s+/);
    const ngrams = new Set<string>();
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.add(words.slice(i, i + n).join(' '));
    }
    return ngrams;
  };

  const ngrams1 = getNGrams(text1);
  const ngrams2 = getNGrams(text2);

  if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

  let intersection = 0;
  for (const ngram of ngrams1) {
    if (ngrams2.has(ngram)) intersection++;
  }

  const union = ngrams1.size + ngrams2.size - intersection;
  return intersection / union; // Jaccard similarity
}

/**
 * Find shared unique phrases between texts
 */
export function findSharedPhrases(
  text1: string,
  text2: string,
  minLength: number = 4
): string[] {
  const getNGrams = (text: string, n: number): Map<string, number> => {
    const normalized = text.toLowerCase();
    const words = normalized.split(/\s+/);
    const ngrams = new Map<string, number>();
    for (let i = 0; i <= words.length - n; i++) {
      const ngram = words.slice(i, i + n).join(' ');
      ngrams.set(ngram, (ngrams.get(ngram) || 0) + 1);
    }
    return ngrams;
  };

  const sharedPhrases: string[] = [];

  for (let n = minLength; n <= 10; n++) {
    const ngrams1 = getNGrams(text1, n);
    const ngrams2 = getNGrams(text2, n);

    for (const [phrase] of ngrams1) {
      if (ngrams2.has(phrase)) {
        // Check it's not a common phrase (would need a dictionary)
        const words = phrase.split(' ');
        const hasContentWords = words.some((w) => w.length > 4);
        if (hasContentWords) {
          // Avoid subsets of already found phrases
          const isSubset = sharedPhrases.some((p) => p.includes(phrase));
          if (!isSubset) {
            // Remove phrases that are subsets of this one
            for (let i = sharedPhrases.length - 1; i >= 0; i--) {
              if (phrase.includes(sharedPhrases[i])) {
                sharedPhrases.splice(i, 1);
              }
            }
            sharedPhrases.push(phrase);
          }
        }
      }
    }
  }

  return sharedPhrases.slice(0, 20); // Limit results
}

/**
 * Compare two articles for similarity
 */
export function compareArticles(
  article1: { id: string; title: string; content: string },
  article2: { id: string; title: string; content: string }
): SimilarityResult {
  const titleSimilarity = nGramSimilarity(article1.title, article2.title, 2);
  const bodySimilarity = nGramSimilarity(article1.content, article2.content, 3);

  // Structure similarity (sentence count, paragraph patterns)
  const sentences1 = article1.content.split(/[.!?]+/).length;
  const sentences2 = article2.content.split(/[.!?]+/).length;
  const structureSimilarity = 1 - Math.abs(sentences1 - sentences2) / Math.max(sentences1, sentences2);

  // For semantic similarity, we'd need embeddings - use n-gram as proxy
  const semanticSimilarity = nGramSimilarity(article1.content, article2.content, 5);

  const sharedPhrases = findSharedPhrases(article1.content, article2.content);

  const overallSimilarity =
    titleSimilarity * 0.3 +
    bodySimilarity * 0.4 +
    structureSimilarity * 0.1 +
    semanticSimilarity * 0.2;

  const isLikelyDuplicate = overallSimilarity > 0.8;
  const isPotentialPlagiarism =
    bodySimilarity > 0.5 && sharedPhrases.length > 5 && titleSimilarity < 0.7;

  return {
    articleId1: article1.id,
    articleId2: article2.id,
    overallSimilarity,
    titleSimilarity,
    bodySimilarity,
    structureSimilarity,
    semanticSimilarity,
    sharedPhrases,
    isLikelyDuplicate,
    isPotentialPlagiarism,
  };
}

// ============================================================================
// COORDINATION DETECTION
// ============================================================================

export interface PublishEvent {
  articleId: string;
  sourceId: string;
  publishedAt: Date;
  title: string;
  topics: string[];
}

/**
 * Detect coordinated publishing patterns
 */
export function detectCoordinatedPublishing(
  events: PublishEvent[],
  timeWindowMs: number = 5 * 60 * 1000 // 5 minutes
): CoordinationPattern[] {
  const patterns: CoordinationPattern[] = [];

  // Group events by similar topics/titles
  const topicGroups = new Map<string, PublishEvent[]>();

  for (const event of events) {
    const topicKey = event.topics.sort().join('|') || 'general';
    if (!topicGroups.has(topicKey)) {
      topicGroups.set(topicKey, []);
    }
    topicGroups.get(topicKey)!.push(event);
  }

  // Check each group for timing coordination
  for (const [topic, groupEvents] of topicGroups) {
    if (groupEvents.length < 3) continue;

    // Sort by time
    const sorted = [...groupEvents].sort(
      (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime()
    );

    // Find clusters within time window
    let clusterStart = 0;
    for (let i = 1; i <= sorted.length; i++) {
      if (
        i === sorted.length ||
        sorted[i].publishedAt.getTime() - sorted[i - 1].publishedAt.getTime() > timeWindowMs
      ) {
        const cluster = sorted.slice(clusterStart, i);
        if (cluster.length >= 3) {
          const sources = [...new Set(cluster.map((e) => e.sourceId))];
          if (sources.length >= 3) {
            // Potential coordination
            const timeSpan =
              cluster[cluster.length - 1].publishedAt.getTime() -
              cluster[0].publishedAt.getTime();
            const anomalyScore = calculateCoordinationScore(cluster);

            if (anomalyScore > 0.7) {
              patterns.push({
                patternId: `coord-${Date.now()}-${patterns.length}`,
                type: 'synchronized-publish',
                sources,
                detectedAt: new Date(),
                confidence: anomalyScore,
                evidence: [
                  {
                    type: 'synchronized-timing',
                    articles: cluster.map((e) => e.articleId),
                    timestamps: cluster.map((e) => e.publishedAt),
                    similarity: nGramSimilarity(
                      cluster[0].title,
                      cluster[cluster.length - 1].title,
                      2
                    ),
                    anomalyScore,
                    details: {
                      topic,
                      timeSpanMs: timeSpan,
                      sourceCount: sources.length,
                    },
                  },
                ],
                isActive: true,
                firstOccurrence: cluster[0].publishedAt,
                occurrenceCount: 1,
              });
            }
          }
        }
        clusterStart = i;
      }
    }
  }

  return patterns;
}

function calculateCoordinationScore(events: PublishEvent[]): number {
  if (events.length < 2) return 0;

  // Time clustering score
  const timestamps = events.map((e) => e.publishedAt.getTime());
  const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
  const avgGap = timeSpan / (events.length - 1);

  // Perfect coordination = very small gaps
  const timeScore = Math.max(0, 1 - avgGap / (5 * 60 * 1000));

  // Title similarity
  let titleSimilaritySum = 0;
  let comparisons = 0;
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      titleSimilaritySum += nGramSimilarity(events[i].title, events[j].title, 2);
      comparisons++;
    }
  }
  const avgTitleSimilarity = comparisons > 0 ? titleSimilaritySum / comparisons : 0;

  // Source diversity (more diverse = more suspicious)
  const uniqueSources = new Set(events.map((e) => e.sourceId)).size;
  const diversityScore = uniqueSources / events.length;

  return timeScore * 0.4 + avgTitleSimilarity * 0.4 + diversityScore * 0.2;
}

// ============================================================================
// ORIGIN TRACING
// ============================================================================

export interface ArticleForTracing {
  id: string;
  sourceId: string;
  title: string;
  content: string;
  publishedAt: Date;
  citations?: string[];
  author?: string;
}

/**
 * Trace the probable origin of a story
 */
export function traceStoryOrigin(
  targetArticle: ArticleForTracing,
  candidateArticles: ArticleForTracing[]
): OriginTrace {
  const candidates: OriginCandidate[] = [];

  for (const candidate of candidateArticles) {
    if (candidate.id === targetArticle.id) continue;
    if (candidate.sourceId === targetArticle.sourceId) continue;

    const evidence: OriginEvidence[] = [];
    let totalWeight = 0;

    // Timing evidence
    const timeDiff = targetArticle.publishedAt.getTime() - candidate.publishedAt.getTime();
    if (timeDiff > 0) {
      // Candidate is older
      const timingWeight = Math.min(0.3, timeDiff / (24 * 60 * 60 * 1000) * 0.3);
      evidence.push({
        type: 'timing',
        weight: timingWeight,
        details: `Published ${Math.round(timeDiff / 60000)} minutes earlier`,
      });
      totalWeight += timingWeight;
    }

    // Citation evidence
    if (targetArticle.citations?.includes(candidate.sourceId)) {
      evidence.push({
        type: 'citation',
        weight: 0.4,
        details: 'Explicitly cited as source',
      });
      totalWeight += 0.4;
    }

    // Content similarity evidence
    const similarity = nGramSimilarity(targetArticle.content, candidate.content, 4);
    if (similarity > 0.3) {
      evidence.push({
        type: 'similarity',
        weight: similarity * 0.3,
        details: `Content similarity: ${(similarity * 100).toFixed(1)}%`,
      });
      totalWeight += similarity * 0.3;
    }

    // Shared phrases that might indicate exclusive info
    const sharedPhrases = findSharedPhrases(targetArticle.content, candidate.content);
    if (sharedPhrases.length > 3) {
      evidence.push({
        type: 'exclusive-info',
        weight: Math.min(0.2, sharedPhrases.length * 0.03),
        details: `${sharedPhrases.length} shared unique phrases`,
      });
      totalWeight += Math.min(0.2, sharedPhrases.length * 0.03);
    }

    if (evidence.length > 0) {
      candidates.push({
        sourceId: candidate.sourceId,
        articleId: candidate.id,
        publishedAt: candidate.publishedAt,
        confidence: Math.min(1, totalWeight),
        evidence,
      });
    }
  }

  // Sort by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);

  const probableOrigin = candidates[0] || {
    sourceId: targetArticle.sourceId,
    articleId: targetArticle.id,
    publishedAt: targetArticle.publishedAt,
    confidence: 1,
    evidence: [{ type: 'timing' as const, weight: 1, details: 'No earlier source found' }],
  };

  // Build trace chain
  const traceChain: TraceStep[] = [
    {
      sourceId: probableOrigin.sourceId,
      articleId: probableOrigin.articleId,
      timestamp: probableOrigin.publishedAt,
      action: 'originated',
    },
  ];

  if (probableOrigin.sourceId !== targetArticle.sourceId) {
    traceChain.push({
      sourceId: targetArticle.sourceId,
      articleId: targetArticle.id,
      timestamp: targetArticle.publishedAt,
      action: 'republished',
    });
  }

  return {
    articleId: targetArticle.id,
    title: targetArticle.title,
    claimedSource: targetArticle.sourceId,
    probableOrigin,
    alternatives: candidates.slice(1, 5),
    traceChain,
    confidence: probableOrigin.confidence,
    analysisTimestamp: new Date(),
  };
}

// ============================================================================
// FORENSICS ANALYZER
// ============================================================================

export class ForensicsAnalyzer {
  private graph: SourceGraph;
  private coordinationHistory: CoordinationPattern[] = [];

  constructor(graph?: SourceGraph) {
    this.graph = graph || new SourceGraph();
  }

  /**
   * Run comprehensive forensics analysis
   */
  runAnalysis(
    articles: ArticleForTracing[],
    timeRange: { start: Date; end: Date }
  ): ForensicsReport {
    const reportId = `forensics-${Date.now()}`;

    // Build/update source graph from articles
    this.updateGraphFromArticles(articles);

    // Get network summary
    const networkSummary = this.graph.getNetworkStats();

    // Detect coordination patterns
    const publishEvents: PublishEvent[] = articles.map((a) => ({
      articleId: a.id,
      sourceId: a.sourceId,
      publishedAt: a.publishedAt,
      title: a.title,
      topics: this.extractTopics(a.title + ' ' + a.content),
    }));
    const coordinationAlerts = detectCoordinatedPublishing(publishEvents);
    this.coordinationHistory.push(...coordinationAlerts);

    // Find origin issues
    const originIssues = this.findOriginIssues(articles);

    // Calculate influence rankings
    const influenceRankings = this.calculateInfluenceRankings();

    // Identify suspicious patterns
    const suspiciousPatterns = this.identifySuspiciousPatterns(
      articles,
      coordinationAlerts,
      originIssues
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      suspiciousPatterns,
      coordinationAlerts,
      originIssues
    );

    return {
      reportId,
      generatedAt: new Date(),
      timeRange,
      totalSources: this.graph.getAllNodes().length,
      totalArticles: articles.length,
      networkSummary,
      coordinationAlerts,
      originIssues,
      influenceRankings,
      suspiciousPatterns,
      recommendations,
    };
  }

  private updateGraphFromArticles(articles: ArticleForTracing[]): void {
    const sourceStats = new Map<string, {
      articles: number;
      firstSeen: Date;
      lastSeen: Date;
    }>();

    for (const article of articles) {
      const stats = sourceStats.get(article.sourceId) || {
        articles: 0,
        firstSeen: article.publishedAt,
        lastSeen: article.publishedAt,
      };
      stats.articles++;
      if (article.publishedAt < stats.firstSeen) stats.firstSeen = article.publishedAt;
      if (article.publishedAt > stats.lastSeen) stats.lastSeen = article.publishedAt;
      sourceStats.set(article.sourceId, stats);

      // Add citations as edges
      if (article.citations) {
        for (const citedSource of article.citations) {
          this.graph.addEdge({
            fromSourceId: article.sourceId,
            toSourceId: citedSource,
            relationshipType: 'cites',
            strength: 0.5,
            evidence: [{
              articleId: article.id,
              timestamp: article.publishedAt,
              evidenceType: 'explicit-citation',
              details: {},
            }],
            firstObserved: article.publishedAt,
            lastObserved: article.publishedAt,
            occurrences: 1,
          });
        }
      }
    }

    // Ensure all sources are nodes
    for (const [sourceId, stats] of sourceStats) {
      if (!this.graph.getNode(sourceId)) {
        this.graph.addNode({
          sourceId,
          name: sourceId,
          domain: sourceId,
          type: 'unknown',
          metadata: {
            language: 'en',
            knownAliases: [],
            officialSocials: {},
            apiAvailable: false,
          },
          metrics: {
            totalArticles: stats.articles,
            averageArticlesPerDay: 0,
            averagePublishDelay: 0,
            originalContentRatio: 0.5,
            citationRate: 0,
            breakingNewsRate: 0,
            accuracyScore: 0.5,
            influenceScore: 0.5,
          },
          firstSeen: stats.firstSeen,
          lastSeen: stats.lastSeen,
        });
      }
    }
  }

  private extractTopics(text: string): string[] {
    const topics: string[] = [];
    const cryptoRegex = /\b(bitcoin|btc|ethereum|eth|crypto|defi|nft|blockchain|token|coin)\b/gi;
    const matches = text.match(cryptoRegex);
    if (matches) {
      const unique = [...new Set(matches.map((m) => m.toLowerCase()))];
      topics.push(...unique);
    }
    return topics;
  }

  private findOriginIssues(articles: ArticleForTracing[]): OriginIssue[] {
    const issues: OriginIssue[] = [];

    // Check for potential plagiarism
    for (let i = 0; i < articles.length; i++) {
      for (let j = i + 1; j < articles.length; j++) {
        const similarity = compareArticles(
          { id: articles[i].id, title: articles[i].title, content: articles[i].content },
          { id: articles[j].id, title: articles[j].title, content: articles[j].content }
        );

        if (similarity.isPotentialPlagiarism) {
          const earlier = articles[i].publishedAt < articles[j].publishedAt
            ? articles[i]
            : articles[j];
          const later = articles[i].publishedAt < articles[j].publishedAt
            ? articles[j]
            : articles[i];

          issues.push({
            type: 'plagiarism',
            severity: similarity.bodySimilarity > 0.7 ? 'high' : 'medium',
            affectedArticles: [later.id],
            originalSource: earlier.sourceId,
            claimedSource: later.sourceId,
            evidence: `${(similarity.bodySimilarity * 100).toFixed(0)}% body similarity, ${similarity.sharedPhrases.length} shared phrases`,
          });
        }
      }
    }

    return issues;
  }

  private calculateInfluenceRankings(): InfluenceRanking[] {
    const rankings: InfluenceRanking[] = [];
    const nodes = this.graph.getAllNodes();

    for (const node of nodes) {
      const incomingEdges = this.graph.getIncomingEdges(node.sourceId);
      const outgoingEdges = this.graph.getOutgoingEdges(node.sourceId);

      const citations = incomingEdges.filter((e) => e.relationshipType === 'cites').length;
      const reach = incomingEdges.length + outgoingEdges.length;

      const breakdown = {
        firstMover: node.metrics.breakingNewsRate,
        citations: Math.min(1, citations / 10),
        reach: Math.min(1, reach / 20),
        accuracy: node.metrics.accuracyScore,
        originality: node.metrics.originalContentRatio,
      };

      const score =
        breakdown.firstMover * 0.25 +
        breakdown.citations * 0.25 +
        breakdown.reach * 0.2 +
        breakdown.accuracy * 0.15 +
        breakdown.originality * 0.15;

      rankings.push({
        sourceId: node.sourceId,
        rank: 0, // Will be set after sorting
        score,
        breakdown,
      });
    }

    rankings.sort((a, b) => b.score - a.score);
    rankings.forEach((r, i) => { r.rank = i + 1; });

    return rankings;
  }

  private identifySuspiciousPatterns(
    articles: ArticleForTracing[],
    coordination: CoordinationPattern[],
    originIssues: OriginIssue[]
  ): SuspiciousPattern[] {
    const patterns: SuspiciousPattern[] = [];

    // Convert coordination patterns to suspicious patterns
    for (const coord of coordination) {
      if (coord.confidence > 0.8) {
        patterns.push({
          patternId: coord.patternId,
          description: `Synchronized publishing across ${coord.sources.length} sources`,
          severity: coord.confidence > 0.9 ? 'high' : 'medium',
          sources: coord.sources,
          articles: coord.evidence.flatMap((e) => e.articles),
          confidence: coord.confidence,
          actionRequired: coord.confidence > 0.9,
        });
      }
    }

    // Convert origin issues to suspicious patterns
    for (const issue of originIssues) {
      if (issue.severity === 'high' || issue.severity === 'critical') {
        patterns.push({
          patternId: `origin-${Date.now()}-${patterns.length}`,
          description: `Potential ${issue.type}: ${issue.claimedSource}`,
          severity: issue.severity,
          sources: [issue.claimedSource, issue.originalSource].filter(Boolean) as string[],
          articles: issue.affectedArticles,
          confidence: 0.8,
          actionRequired: true,
        });
      }
    }

    return patterns;
  }

  private generateRecommendations(
    patterns: SuspiciousPattern[],
    coordination: CoordinationPattern[],
    originIssues: OriginIssue[]
  ): ForensicsRecommendation[] {
    const recommendations: ForensicsRecommendation[] = [];

    // High-severity patterns need investigation
    for (const pattern of patterns.filter((p) => p.severity === 'high' || p.severity === 'critical')) {
      recommendations.push({
        type: 'investigate',
        target: pattern.sources[0],
        reason: pattern.description,
        priority: pattern.severity === 'critical' ? 1 : 2,
        suggestedAction: 'Review source credibility and content authenticity',
      });
    }

    // Recurring coordination needs monitoring
    const sourceCoordCount = new Map<string, number>();
    for (const coord of coordination) {
      for (const source of coord.sources) {
        sourceCoordCount.set(source, (sourceCoordCount.get(source) || 0) + 1);
      }
    }
    for (const [source, count] of sourceCoordCount) {
      if (count >= 3) {
        recommendations.push({
          type: 'monitor',
          target: source,
          reason: `Involved in ${count} coordination patterns`,
          priority: 3,
          suggestedAction: 'Add to watchlist for ongoing monitoring',
        });
      }
    }

    // Plagiarism needs flagging
    for (const issue of originIssues.filter((i) => i.type === 'plagiarism')) {
      recommendations.push({
        type: 'flag',
        target: issue.claimedSource,
        reason: `Plagiarism detected: ${issue.evidence}`,
        priority: 2,
        suggestedAction: 'Flag content and consider source demotion',
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  getGraph(): SourceGraph {
    return this.graph;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function createForensicsAnalyzer(existingGraph?: SourceGraph): ForensicsAnalyzer {
  return new ForensicsAnalyzer(existingGraph);
}

export function createSourceGraph(): SourceGraph {
  return new SourceGraph();
}
