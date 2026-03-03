# ─────────────────────────────────────────────────────────────
# Monitoring & Alerting
#
# Cloud Monitoring alert policies for production observability.
# Alerts on: high error rate, high latency, instance saturation,
# Redis memory, and Cloud Run cold starts.
# ─────────────────────────────────────────────────────────────

# ── Notification Channel (email — replace with Slack/PagerDuty) ──

resource "google_monitoring_notification_channel" "email" {
  display_name = "Crypto Vision Alerts"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }
}

# ── Alert: Cloud Run 5xx Error Rate > 5% ────────────────────

resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "Cloud Run — High Error Rate (>5%)"
  combiner     = "OR"

  conditions {
    display_name = "5xx error ratio"

    condition_monitoring_query_language {
      query = <<-EOT
        fetch cloud_run_revision
        | metric 'run.googleapis.com/request_count'
        | filter resource.service_name == '${var.service_name}'
        | align rate(1m)
        | group_by [metric.response_code_class]
        | {
            5xx: filter metric.response_code_class == '5xx'
            ; total: ident
          }
        | ratio
        | condition val() > 0.05
      EOT

      duration = "300s"

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }
}

# ── Alert: Cloud Run p99 Latency > 5s ───────────────────────

resource "google_monitoring_alert_policy" "high_latency" {
  display_name = "Cloud Run — High Latency (p99 > 5s)"
  combiner     = "OR"

  conditions {
    display_name = "p99 latency"

    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.service_name}\" AND metric.type = \"run.googleapis.com/request_latencies\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5000
      duration        = "300s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_99"
        cross_series_reducer = "REDUCE_MAX"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }
}

# ── Alert: Cloud Run Instance Saturation ─────────────────────

resource "google_monitoring_alert_policy" "instance_saturation" {
  display_name = "Cloud Run — Instance Count > 80% Max"
  combiner     = "OR"

  conditions {
    display_name = "Instance count high"

    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.service_name}\" AND metric.type = \"run.googleapis.com/container/instance_count\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.cloud_run_max_instances * 0.8
      duration        = "300s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }
}

# ── Alert: Redis Memory > 80% ───────────────────────────────

resource "google_monitoring_alert_policy" "redis_memory" {
  display_name = "Redis — Memory Usage > 80%"
  combiner     = "OR"

  conditions {
    display_name = "Redis memory ratio"

    condition_threshold {
      filter          = "resource.type = \"redis_instance\" AND resource.labels.instance_id = \"${google_redis_instance.cache.name}\" AND metric.type = \"redis.googleapis.com/stats/memory/usage_ratio\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "300s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }
}

# ── Variable ─────────────────────────────────────────────────

variable "alert_email" {
  description = "Email address for monitoring alerts"
  type        = string
  default     = "alerts@cryptocurrency.cv"
}

# ── Uptime Check ───────────────────────────────────────────

resource "google_monitoring_uptime_check_config" "health" {
  display_name = "${var.service_name} — Health Endpoint"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.domain
    }
  }
}

resource "google_monitoring_alert_policy" "uptime" {
  display_name = "${var.service_name} — Downtime Alert"
  combiner     = "OR"

  conditions {
    display_name = "Uptime check failing"

    condition_threshold {
      filter          = "resource.type = \"uptime_url\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.labels.check_id = \"${google_monitoring_uptime_check_config.health.uptime_check_id}\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "300s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_NEXT_OLDER"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }
}
