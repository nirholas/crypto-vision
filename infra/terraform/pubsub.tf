# ─────────────────────────────────────────────────────────────
# Pub/Sub Topics, Subscriptions & Schemas
#
# Tiered topic architecture for different data frequencies:
#   realtime  — WebSocket ticks (< 1s latency)
#   frequent  — Poll every 1-2 min (prices, gas, dex pairs)
#   standard  — Poll every 5-10 min (markets, DeFi, news)
#   hourly    — Poll every 30-60 min (exchanges, governance, macro)
#   daily     — Poll once per day (OHLC backfill, security scans)
# ─────────────────────────────────────────────────────────────

# ── Pub/Sub Schema (shared JSON envelope) ─────────────────

resource "google_pubsub_schema" "market_event" {
  name       = "market-event-schema"
  project    = var.project_id
  type       = "AVRO"
  definition = jsonencode({
    type = "record"
    name = "MarketEvent"
    fields = [
      { name = "type", type = "string" },
      { name = "source", type = "string" },
      { name = "timestamp", type = "string" },
      { name = "data", type = "string" }, # JSON-encoded payload
    ]
  })
}

# ── Realtime Topic — WebSocket ticks ──────────────────────

resource "google_pubsub_topic" "realtime" {
  name    = "crypto-vision-realtime"
  project = var.project_id

  message_retention_duration = "86400s" # 24h retention

  labels = {
    tier        = "realtime"
    environment = "production"
    service     = "crypto-vision"
  }
}

resource "google_pubsub_subscription" "realtime_bq" {
  name    = "crypto-vision-realtime-bq"
  topic   = google_pubsub_topic.realtime.id
  project = var.project_id

  bigquery_config {
    table          = "${var.project_id}.crypto_vision.realtime_ticks"
    write_metadata = true
  }

  ack_deadline_seconds       = 20
  message_retention_duration = "604800s" # 7 days
  retain_acked_messages      = false

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  labels = {
    tier = "realtime"
  }
}

# Dead letter topic for realtime failures
resource "google_pubsub_topic" "realtime_dlq" {
  name    = "crypto-vision-realtime-dlq"
  project = var.project_id

  message_retention_duration = "604800s" # 7 days

  labels = {
    tier = "realtime"
    type = "dead-letter"
  }
}

# ── Frequent Topic — Every 1-2 minutes ───────────────────

resource "google_pubsub_topic" "frequent" {
  name    = "crypto-vision-frequent"
  project = var.project_id

  message_retention_duration = "86400s"

  labels = {
    tier        = "frequent"
    environment = "production"
    service     = "crypto-vision"
  }
}

resource "google_pubsub_subscription" "frequent_bq" {
  name    = "crypto-vision-frequent-bq"
  topic   = google_pubsub_topic.frequent.id
  project = var.project_id

  bigquery_config {
    table          = "${var.project_id}.crypto_vision.frequent_events"
    write_metadata = true
  }

  ack_deadline_seconds       = 30
  message_retention_duration = "604800s"
  retain_acked_messages      = false

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  labels = {
    tier = "frequent"
  }
}

resource "google_pubsub_topic" "frequent_dlq" {
  name    = "crypto-vision-frequent-dlq"
  project = var.project_id

  message_retention_duration = "604800s"

  labels = {
    tier = "frequent"
    type = "dead-letter"
  }
}

# ── Standard Topic — Every 5-10 minutes ──────────────────

resource "google_pubsub_topic" "standard" {
  name    = "crypto-vision-standard"
  project = var.project_id

  message_retention_duration = "86400s"

  labels = {
    tier        = "standard"
    environment = "production"
    service     = "crypto-vision"
  }
}

resource "google_pubsub_subscription" "standard_bq" {
  name    = "crypto-vision-standard-bq"
  topic   = google_pubsub_topic.standard.id
  project = var.project_id

  bigquery_config {
    table          = "${var.project_id}.crypto_vision.standard_events"
    write_metadata = true
  }

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s"
  retain_acked_messages      = false

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  labels = {
    tier = "standard"
  }
}

resource "google_pubsub_topic" "standard_dlq" {
  name    = "crypto-vision-standard-dlq"
  project = var.project_id

  message_retention_duration = "604800s"

  labels = {
    tier = "standard"
    type = "dead-letter"
  }
}

# ── Hourly Topic — Every 30-60 minutes ───────────────────

resource "google_pubsub_topic" "hourly" {
  name    = "crypto-vision-hourly"
  project = var.project_id

  message_retention_duration = "172800s" # 48h retention

  labels = {
    tier        = "hourly"
    environment = "production"
    service     = "crypto-vision"
  }
}

resource "google_pubsub_subscription" "hourly_bq" {
  name    = "crypto-vision-hourly-bq"
  topic   = google_pubsub_topic.hourly.id
  project = var.project_id

  bigquery_config {
    table          = "${var.project_id}.crypto_vision.hourly_events"
    write_metadata = true
  }

  ack_deadline_seconds       = 120
  message_retention_duration = "604800s"
  retain_acked_messages      = false

  retry_policy {
    minimum_backoff = "30s"
    maximum_backoff = "600s"
  }

  labels = {
    tier = "hourly"
  }
}

resource "google_pubsub_topic" "hourly_dlq" {
  name    = "crypto-vision-hourly-dlq"
  project = var.project_id

  message_retention_duration = "604800s"

  labels = {
    tier = "hourly"
    type = "dead-letter"
  }
}

# ── Daily Topic — Once per day ────────────────────────────

resource "google_pubsub_topic" "daily" {
  name    = "crypto-vision-daily"
  project = var.project_id

  message_retention_duration = "604800s" # 7 days retention

  labels = {
    tier        = "daily"
    environment = "production"
    service     = "crypto-vision"
  }
}

resource "google_pubsub_subscription" "daily_bq" {
  name    = "crypto-vision-daily-bq"
  topic   = google_pubsub_topic.daily.id
  project = var.project_id

  bigquery_config {
    table          = "${var.project_id}.crypto_vision.daily_events"
    write_metadata = true
  }

  ack_deadline_seconds       = 300
  message_retention_duration = "604800s"
  retain_acked_messages      = false

  retry_policy {
    minimum_backoff = "60s"
    maximum_backoff = "600s"
  }

  labels = {
    tier = "daily"
  }
}

resource "google_pubsub_topic" "daily_dlq" {
  name    = "crypto-vision-daily-dlq"
  project = var.project_id

  message_retention_duration = "604800s"

  labels = {
    tier = "daily"
    type = "dead-letter"
  }
}

# ── IAM — Allow Cloud Run SA to publish ───────────────────

resource "google_pubsub_topic_iam_member" "run_publisher" {
  for_each = toset([
    google_pubsub_topic.realtime.name,
    google_pubsub_topic.frequent.name,
    google_pubsub_topic.standard.name,
    google_pubsub_topic.hourly.name,
    google_pubsub_topic.daily.name,
  ])

  project = var.project_id
  topic   = each.value
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# ── Cloud Run Jobs for Ingestion Workers ──────────────────

resource "google_cloud_run_v2_job" "ingest_workers" {
  for_each = toset([
    "market",
    "defi",
    "news",
    "dex",
    "derivatives",
    "onchain",
    "governance",
    "macro",
  ])

  name     = "ingest-${each.key}"
  location = var.region
  project  = var.project_id

  template {
    task_count  = 1
    parallelism = 1

    template {
      max_retries = 3
      timeout     = "600s"

      containers {
        image   = "${var.region}-docker.pkg.dev/${var.project_id}/crypto-vision/worker:latest"
        command = ["node"]
        args    = ["dist/src/workers/ingest-${each.key}.js"]

        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        # Mount secrets
        dynamic "env" {
          for_each = var.secret_names
          content {
            name = env.value
            value_source {
              secret_key_ref {
                secret  = env.value
                version = "latest"
              }
            }
          }
        }
      }

      service_account = google_service_account.cloud_run.email
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }
}

# ── Cloud Scheduler Jobs for Ingestion Workers ────────────

locals {
  worker_schedules = {
    market      = "*/2 * * * *"
    defi        = "*/5 * * * *"
    news        = "*/5 * * * *"
    dex         = "*/2 * * * *"
    derivatives = "*/10 * * * *"
    onchain     = "*/5 * * * *"
    governance  = "*/30 * * * *"
    macro       = "0 * * * *"
  }
}

resource "google_cloud_scheduler_job" "ingest_workers" {
  for_each = local.worker_schedules

  name        = "trigger-ingest-${each.key}"
  description = "Trigger the ingest-${each.key} Cloud Run Job"
  schedule    = each.value
  time_zone   = "UTC"
  region      = var.region

  retry_config {
    retry_count          = 2
    min_backoff_duration = "10s"
    max_backoff_duration = "120s"
  }

  http_target {
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/ingest-${each.key}:run"
    http_method = "POST"

    oauth_token {
      service_account_email = google_service_account.scheduler.email
    }
  }

  depends_on = [google_cloud_run_v2_job.ingest_workers]
}

# Backfill job (on-demand, no scheduler)
resource "google_cloud_run_v2_job" "backfill" {
  name     = "backfill-historical"
  location = var.region
  project  = var.project_id

  template {
    task_count  = 1
    parallelism = 1

    template {
      max_retries = 1
      timeout     = "3600s" # 1 hour for backfill

      containers {
        image   = "${var.region}-docker.pkg.dev/${var.project_id}/crypto-vision/worker:latest"
        command = ["node"]
        args    = ["dist/src/workers/backfill-historical.js"]

        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        dynamic "env" {
          for_each = var.secret_names
          content {
            name = env.value
            value_source {
              secret_key_ref {
                secret  = env.value
                version = "latest"
              }
            }
          }
        }
      }

      service_account = google_service_account.cloud_run.email
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }
}
