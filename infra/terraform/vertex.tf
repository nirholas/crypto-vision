# ─────────────────────────────────────────────────────────────
# Vertex AI — Fine-Tuning Infrastructure
#
# Provisions:
#   - GCS bucket for training data
#   - Service account with Vertex AI & Storage permissions
#   - Cloud Run Job for automated retraining
#   - Cloud Scheduler trigger for weekly retraining
# ─────────────────────────────────────────────────────────────

# ── Training Data Bucket ──────────────────────────────────────

resource "google_storage_bucket" "training" {
  name     = "${var.project_id}-crypto-vision-training"
  location = var.region
  project  = var.project_id

  storage_class               = "STANDARD"
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "Delete"
    }
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }

  labels = {
    service     = "crypto-vision"
    component   = "vertex-ai"
    environment = "production"
  }

  depends_on = [google_project_service.vertex_apis]
}

# ── Vertex AI Service Account ────────────────────────────────

resource "google_service_account" "vertex" {
  account_id   = "crypto-vision-vertex"
  display_name = "Crypto Vision Vertex AI"
  description  = "Service account for Vertex AI fine-tuning and inference"
  project      = var.project_id
}

# Vertex AI User — create/manage tuning jobs and endpoints
resource "google_project_iam_member" "vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.vertex.email}"
}

# Storage Object Admin — read/write training data
resource "google_project_iam_member" "vertex_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.vertex.email}"
}

# Service Account Token Creator — for ADC token generation
resource "google_project_iam_member" "vertex_token_creator" {
  project = var.project_id
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:${google_service_account.vertex.email}"
}

# Let Cloud Run service account use the Vertex SA
resource "google_service_account_iam_member" "cloud_run_vertex_user" {
  service_account_id = google_service_account.vertex.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.cloud_run.email}"
}

# ── Required APIs ─────────────────────────────────────────────

locals {
  vertex_apis = [
    "aiplatform.googleapis.com",
    "storage.googleapis.com",
  ]
}

resource "google_project_service" "vertex_apis" {
  for_each = toset(local.vertex_apis)
  project  = var.project_id
  service  = each.value

  disable_on_destroy = false
}

# ── Cloud Run Job for Retraining ──────────────────────────────

resource "google_cloud_run_v2_job" "retrain" {
  name     = "crypto-vision-retrain"
  location = var.region
  project  = var.project_id

  template {
    task_count = 1

    template {
      max_retries = 1
      timeout     = "3600s" # 1 hour max

      service_account = google_service_account.vertex.email

      containers {
        image = var.container_image != "" ? var.container_image : "gcr.io/${var.project_id}/crypto-vision:latest"

        command = ["node"]
        args    = ["dist/scripts/training/retrain.js"]

        resources {
          limits = {
            cpu    = "2"
            memory = "4Gi"
          }
        }

        # Inherit secrets from Cloud Run service
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

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "GCP_REGION"
          value = var.region
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }
      }
    }
  }

  depends_on = [
    google_project_service.vertex_apis,
    google_storage_bucket.training,
  ]

  labels = {
    service   = "crypto-vision"
    component = "vertex-retrain"
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }
}

# ── Scheduler for Weekly Retraining ───────────────────────────

resource "google_service_account" "retrain_invoker" {
  account_id   = "retrain-invoker"
  display_name = "Retrain Job Invoker"
  description  = "Service account for Cloud Scheduler to trigger retraining"
  project      = var.project_id
}

resource "google_project_iam_member" "retrain_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.retrain_invoker.email}"
}

resource "google_cloud_scheduler_job" "retrain_weekly" {
  name        = "crypto-vision-retrain-weekly"
  description = "Weekly retraining of Vertex AI fine-tuned models"
  schedule    = "0 2 * * 0" # Sunday 2 AM UTC
  time_zone   = "UTC"
  region      = var.region
  project     = var.project_id

  retry_config {
    retry_count          = 2
    min_backoff_duration = "30s"
    max_backoff_duration = "300s"
  }

  http_target {
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.retrain.name}:run"
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.retrain_invoker.email
    }
  }

  depends_on = [
    google_cloud_run_v2_job.retrain,
    google_project_service.vertex_apis,
  ]
}

# ── Outputs ───────────────────────────────────────────────────

output "vertex_service_account" {
  description = "Vertex AI service account email"
  value       = google_service_account.vertex.email
}

output "training_bucket" {
  description = "GCS bucket for training data"
  value       = google_storage_bucket.training.url
}

output "retrain_job_name" {
  description = "Cloud Run retraining job name"
  value       = google_cloud_run_v2_job.retrain.name
}

output "retrain_schedule" {
  description = "Cloud Scheduler job for weekly retraining"
  value       = google_cloud_scheduler_job.retrain_weekly.name
}
