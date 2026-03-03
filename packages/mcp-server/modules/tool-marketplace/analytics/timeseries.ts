/**
 * Time Series Database
 * @description In-memory time series database with rollup and retention policies
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"

/**
 * Granularity levels for time series data
 */
export type Granularity = "minute" | "hour" | "day" | "week" | "month"

/**
 * Retention policy configuration
 */
export interface RetentionPolicy {
  /** Granularity level */
  granularity: Granularity
  /** Retention duration in milliseconds */
  retentionMs: number
}

/**
 * Time series data point
 */
export interface DataPoint {
  /** Timestamp (Unix ms) */
  timestamp: number
  /** Metric value */
  value: number
  /** Optional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Aggregated data point with statistics
 */
export interface AggregatedDataPoint {
  /** Start of time bucket (Unix ms) */
  timestamp: number
  /** End of time bucket (Unix ms) */
  endTimestamp: number
  /** Number of data points */
  count: number
  /** Sum of values */
  sum: number
  /** Average value */
  avg: number
  /** Minimum value */
  min: number
  /** Maximum value */
  max: number
  /** Standard deviation */
  stddev: number
  /** Percentile values (p50, p95, p99) */
  percentiles: {
    p50: number
    p95: number
    p99: number
  }
}

/**
 * Time series query options
 */
export interface TimeSeriesQueryOptions {
  /** Start time (Unix ms) */
  startTime: number
  /** End time (Unix ms) */
  endTime: number
  /** Desired granularity */
  granularity?: Granularity
  /** Metric name filter */
  metricName?: string
  /** Tags filter */
  tags?: Record<string, string>
}

/**
 * Metric definition
 */
export interface MetricDefinition {
  /** Metric name */
  name: string
  /** Description */
  description: string
  /** Unit of measurement */
  unit: string
  /** Tags for filtering */
  tags?: Record<string, string>
}

/**
 * Time bucket for internal storage
 */
interface TimeBucket {
  points: DataPoint[]
  aggregated?: AggregatedDataPoint
}

/**
 * Metric storage structure
 */
interface MetricStorage {
  definition: MetricDefinition
  /** Raw data points (minute granularity) */
  raw: Map<number, TimeBucket>
  /** Hourly aggregations */
  hourly: Map<number, AggregatedDataPoint>
  /** Daily aggregations */
  daily: Map<number, AggregatedDataPoint>
  /** Weekly aggregations */
  weekly: Map<number, AggregatedDataPoint>
  /** Monthly aggregations */
  monthly: Map<number, AggregatedDataPoint>
}

/**
 * Default retention policies:
 * - Raw: 7 days
 * - Hourly: 30 days
 * - Daily: 1 year
 * - Weekly: 2 years
 * - Monthly: forever (10 years for practical purposes)
 */
const DEFAULT_RETENTION: RetentionPolicy[] = [
  { granularity: "minute", retentionMs: 7 * 24 * 60 * 60 * 1000 },
  { granularity: "hour", retentionMs: 30 * 24 * 60 * 60 * 1000 },
  { granularity: "day", retentionMs: 365 * 24 * 60 * 60 * 1000 },
  { granularity: "week", retentionMs: 2 * 365 * 24 * 60 * 60 * 1000 },
  { granularity: "month", retentionMs: 10 * 365 * 24 * 60 * 60 * 1000 },
]

/**
 * Get bucket timestamp for a given granularity
 */
function getBucketTimestamp(timestamp: number, granularity: Granularity): number {
  const date = new Date(timestamp)
  
  switch (granularity) {
    case "minute":
      date.setSeconds(0, 0)
      return date.getTime()
    case "hour":
      date.setMinutes(0, 0, 0)
      return date.getTime()
    case "day":
      date.setHours(0, 0, 0, 0)
      return date.getTime()
    case "week":
      const dayOfWeek = date.getDay()
      date.setDate(date.getDate() - dayOfWeek)
      date.setHours(0, 0, 0, 0)
      return date.getTime()
    case "month":
      date.setDate(1)
      date.setHours(0, 0, 0, 0)
      return date.getTime()
  }
}

/**
 * Get bucket duration in milliseconds
 */
function getBucketDuration(granularity: Granularity): number {
  switch (granularity) {
    case "minute": return 60 * 1000
    case "hour": return 60 * 60 * 1000
    case "day": return 24 * 60 * 60 * 1000
    case "week": return 7 * 24 * 60 * 60 * 1000
    case "month": return 30 * 24 * 60 * 60 * 1000 // Approximate
  }
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0
  const index = (p / 100) * (sortedArr.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sortedArr[lower]!
  return sortedArr[lower]! * (upper - index) + sortedArr[upper]! * (index - lower)
}

/**
 * Calculate standard deviation
 */
function stddev(values: number[], mean: number): number {
  if (values.length === 0) return 0
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length)
}

/**
 * Aggregate data points into a single aggregated point
 */
function aggregatePoints(
  points: DataPoint[],
  bucketStart: number,
  bucketEnd: number
): AggregatedDataPoint {
  if (points.length === 0) {
    return {
      timestamp: bucketStart,
      endTimestamp: bucketEnd,
      count: 0,
      sum: 0,
      avg: 0,
      min: 0,
      max: 0,
      stddev: 0,
      percentiles: { p50: 0, p95: 0, p99: 0 },
    }
  }

  const values = points.map(p => p.value)
  const sortedValues = [...values].sort((a, b) => a - b)
  const sum = values.reduce((a, b) => a + b, 0)
  const avg = sum / values.length

  return {
    timestamp: bucketStart,
    endTimestamp: bucketEnd,
    count: points.length,
    sum,
    avg,
    min: sortedValues[0]!,
    max: sortedValues[sortedValues.length - 1]!,
    stddev: stddev(values, avg),
    percentiles: {
      p50: percentile(sortedValues, 50),
      p95: percentile(sortedValues, 95),
      p99: percentile(sortedValues, 99),
    },
  }
}

/**
 * Time Series Database
 * Provides efficient storage and querying of time-stamped metrics
 */
export class TimeSeriesDB {
  private metrics: Map<string, MetricStorage> = new Map()
  private retentionPolicies: RetentionPolicy[]
  private rollupInterval: ReturnType<typeof setInterval> | null = null

  constructor(retentionPolicies?: RetentionPolicy[]) {
    this.retentionPolicies = retentionPolicies || DEFAULT_RETENTION
  }

  /**
   * Start automatic rollup and cleanup
   */
  startRollup(intervalMs: number = 60000): void {
    if (this.rollupInterval) return
    
    this.rollupInterval = setInterval(() => {
      this.runRollup()
      this.applyRetention()
    }, intervalMs)
    
    Logger.debug("TimeSeriesDB: Started automatic rollup")
  }

  /**
   * Stop automatic rollup
   */
  stopRollup(): void {
    if (this.rollupInterval) {
      clearInterval(this.rollupInterval)
      this.rollupInterval = null
      Logger.debug("TimeSeriesDB: Stopped automatic rollup")
    }
  }

  /**
   * Register a new metric
   */
  registerMetric(definition: MetricDefinition): void {
    if (this.metrics.has(definition.name)) {
      return // Already registered
    }

    this.metrics.set(definition.name, {
      definition,
      raw: new Map(),
      hourly: new Map(),
      daily: new Map(),
      weekly: new Map(),
      monthly: new Map(),
    })

    Logger.debug(`TimeSeriesDB: Registered metric ${definition.name}`)
  }

  /**
   * Record a data point
   */
  record(metricName: string, value: number, metadata?: Record<string, unknown>): void {
    const metric = this.metrics.get(metricName)
    if (!metric) {
      throw new Error(`Metric not registered: ${metricName}`)
    }

    const timestamp = Date.now()
    const bucketTime = getBucketTimestamp(timestamp, "minute")
    
    let bucket = metric.raw.get(bucketTime)
    if (!bucket) {
      bucket = { points: [] }
      metric.raw.set(bucketTime, bucket)
    }

    bucket.points.push({ timestamp, value, metadata })
  }

  /**
   * Record multiple data points
   */
  recordBatch(
    metricName: string,
    points: Array<{ value: number; timestamp?: number; metadata?: Record<string, unknown> }>
  ): void {
    const metric = this.metrics.get(metricName)
    if (!metric) {
      throw new Error(`Metric not registered: ${metricName}`)
    }

    for (const point of points) {
      const timestamp = point.timestamp || Date.now()
      const bucketTime = getBucketTimestamp(timestamp, "minute")
      
      let bucket = metric.raw.get(bucketTime)
      if (!bucket) {
        bucket = { points: [] }
        metric.raw.set(bucketTime, bucket)
      }

      bucket.points.push({
        timestamp,
        value: point.value,
        metadata: point.metadata,
      })
    }
  }

  /**
   * Query time series data
   */
  query(metricName: string, options: TimeSeriesQueryOptions): AggregatedDataPoint[] {
    const metric = this.metrics.get(metricName)
    if (!metric) {
      throw new Error(`Metric not registered: ${metricName}`)
    }

    const { startTime, endTime, granularity = "hour" } = options
    const results: AggregatedDataPoint[] = []

    // Select the appropriate storage based on granularity
    let storage: Map<number, AggregatedDataPoint | TimeBucket>
    switch (granularity) {
      case "minute":
        storage = metric.raw as Map<number, AggregatedDataPoint | TimeBucket>
        break
      case "hour":
        storage = metric.hourly as Map<number, AggregatedDataPoint | TimeBucket>
        break
      case "day":
        storage = metric.daily as Map<number, AggregatedDataPoint | TimeBucket>
        break
      case "week":
        storage = metric.weekly as Map<number, AggregatedDataPoint | TimeBucket>
        break
      case "month":
        storage = metric.monthly as Map<number, AggregatedDataPoint | TimeBucket>
        break
    }

    // Iterate through time range
    const bucketDuration = getBucketDuration(granularity)
    let currentBucket = getBucketTimestamp(startTime, granularity)
    const endBucket = getBucketTimestamp(endTime, granularity)

    while (currentBucket <= endBucket) {
      const data = storage.get(currentBucket)
      
      if (data) {
        if (granularity === "minute") {
          // Raw data needs to be aggregated on-the-fly
          const bucket = data as TimeBucket
          if (bucket.points.length > 0) {
            results.push(aggregatePoints(
              bucket.points,
              currentBucket,
              currentBucket + bucketDuration
            ))
          }
        } else {
          // Already aggregated
          results.push(data as AggregatedDataPoint)
        }
      }

      currentBucket += bucketDuration
    }

    return results
  }

  /**
   * Get the latest value for a metric
   */
  getLatest(metricName: string): DataPoint | null {
    const metric = this.metrics.get(metricName)
    if (!metric) return null

    // Find the most recent bucket
    const buckets = Array.from(metric.raw.keys()).sort((a, b) => b - a)
    if (buckets.length === 0) return null

    const latestBucket = metric.raw.get(buckets[0]!)
    if (!latestBucket || latestBucket.points.length === 0) return null

    return latestBucket.points[latestBucket.points.length - 1] ?? null
  }

  /**
   * Get aggregated summary for a time range
   */
  getSummary(metricName: string, startTime: number, endTime: number): AggregatedDataPoint {
    const metric = this.metrics.get(metricName)
    if (!metric) {
      throw new Error(`Metric not registered: ${metricName}`)
    }

    // Collect all points in range
    const allPoints: DataPoint[] = []
    
    for (const [bucketTime, bucket] of metric.raw) {
      if (bucketTime >= startTime && bucketTime <= endTime) {
        allPoints.push(...bucket.points.filter(p => 
          p.timestamp >= startTime && p.timestamp <= endTime
        ))
      }
    }

    return aggregatePoints(allPoints, startTime, endTime)
  }

  /**
   * Run rollup from raw data to aggregated buckets
   */
  runRollup(): void {
    const now = Date.now()

    for (const [metricName, metric] of this.metrics) {
      // Rollup minute → hour
      this.rollupTo(metric, "minute", "hour", now)
      
      // Rollup hour → day
      this.rollupTo(metric, "hour", "day", now)
      
      // Rollup day → week
      this.rollupTo(metric, "day", "week", now)
      
      // Rollup week → month
      this.rollupTo(metric, "week", "month", now)
    }

    Logger.debug("TimeSeriesDB: Rollup completed")
  }

  /**
   * Rollup from one granularity to another
   */
  private rollupTo(
    metric: MetricStorage,
    fromGranularity: Granularity,
    toGranularity: Granularity,
    now: number
  ): void {
    const fromStorage = this.getStorage(metric, fromGranularity)
    const toStorage = this.getStorage(metric, toGranularity)
    const bucketDuration = getBucketDuration(toGranularity)

    // Group source buckets by target bucket
    const groups = new Map<number, (DataPoint | AggregatedDataPoint)[]>()

    for (const [bucketTime, data] of fromStorage) {
      // Only rollup completed buckets (older than current bucket)
      const targetBucket = getBucketTimestamp(bucketTime, toGranularity)
      const targetEnd = targetBucket + bucketDuration
      
      if (targetEnd > now) continue // Skip current incomplete bucket

      let group = groups.get(targetBucket)
      if (!group) {
        group = []
        groups.set(targetBucket, group)
      }

      if (fromGranularity === "minute") {
        group.push(...(data as TimeBucket).points)
      } else {
        // For higher granularities, we need to combine aggregates
        const agg = data as AggregatedDataPoint
        // Create synthetic points for combination
        for (let i = 0; i < agg.count; i++) {
          group.push({ timestamp: agg.timestamp, value: agg.avg })
        }
      }
    }

    // Create aggregated buckets
    for (const [bucketTime, dataPoints] of groups) {
      // Skip if already exists in target
      if (toStorage.has(bucketTime)) continue

      const points = (dataPoints as DataPoint[])
      if (points.length > 0) {
        const aggregated = aggregatePoints(points, bucketTime, bucketTime + bucketDuration)
        ;(toStorage as Map<number, AggregatedDataPoint>).set(bucketTime, aggregated)
      }
    }
  }

  /**
   * Get storage for a granularity
   */
  private getStorage(
    metric: MetricStorage,
    granularity: Granularity
  ): Map<number, TimeBucket | AggregatedDataPoint> {
    switch (granularity) {
      case "minute": return metric.raw
      case "hour": return metric.hourly
      case "day": return metric.daily
      case "week": return metric.weekly
      case "month": return metric.monthly
    }
  }

  /**
   * Apply retention policies and clean up old data
   */
  applyRetention(): void {
    const now = Date.now()

    for (const [metricName, metric] of this.metrics) {
      for (const policy of this.retentionPolicies) {
        const cutoff = now - policy.retentionMs
        const storage = this.getStorage(metric, policy.granularity)

        for (const [bucketTime] of storage) {
          if (bucketTime < cutoff) {
            storage.delete(bucketTime)
          }
        }
      }
    }

    Logger.debug("TimeSeriesDB: Retention applied")
  }

  /**
   * Get all registered metrics
   */
  getMetrics(): MetricDefinition[] {
    return Array.from(this.metrics.values()).map(m => m.definition)
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalMetrics: number
    totalDataPoints: number
    storageByGranularity: Record<Granularity, number>
  } {
    let totalDataPoints = 0
    const storageByGranularity: Record<Granularity, number> = {
      minute: 0,
      hour: 0,
      day: 0,
      week: 0,
      month: 0,
    }

    for (const metric of this.metrics.values()) {
      for (const bucket of metric.raw.values()) {
        totalDataPoints += bucket.points.length
        storageByGranularity.minute += bucket.points.length
      }
      storageByGranularity.hour += metric.hourly.size
      storageByGranularity.day += metric.daily.size
      storageByGranularity.week += metric.weekly.size
      storageByGranularity.month += metric.monthly.size
    }

    return {
      totalMetrics: this.metrics.size,
      totalDataPoints,
      storageByGranularity,
    }
  }

  /**
   * Clear all data for a metric
   */
  clearMetric(metricName: string): void {
    const metric = this.metrics.get(metricName)
    if (metric) {
      metric.raw.clear()
      metric.hourly.clear()
      metric.daily.clear()
      metric.weekly.clear()
      metric.monthly.clear()
    }
  }

  /**
   * Export all data as JSON
   */
  export(): Record<string, {
    definition: MetricDefinition
    data: {
      granularity: Granularity
      points: AggregatedDataPoint[]
    }[]
  }> {
    const result: Record<string, any> = {}

    for (const [name, metric] of this.metrics) {
      result[name] = {
        definition: metric.definition,
        data: [
          { granularity: "hour", points: Array.from(metric.hourly.values()) },
          { granularity: "day", points: Array.from(metric.daily.values()) },
          { granularity: "week", points: Array.from(metric.weekly.values()) },
          { granularity: "month", points: Array.from(metric.monthly.values()) },
        ],
      }
    }

    return result
  }
}

// Singleton instance
export const timeseriesDB = new TimeSeriesDB()
