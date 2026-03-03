# ─────────────────────────────────────────────────────────────
# Cloud Run Service
# ─────────────────────────────────────────────────────────────

locals {
  # Use provided image or default to Artifact Registry path
  image = var.container_image != "" ? var.container_image : "${var.region}-docker.pkg.dev/${var.project_id}/crypto-vision/${var.service_name}:latest"

  # Build secret env var mappings
  secret_env_vars = {
    for name in var.secret_names : name => {
      secret  = name
      version = "latest"
    }
  }
}

resource "google_cloud_run_v2_service" "app" {
  provider = google-beta
  name     = var.service_name
  location = var.region

  # Prevent Terraform from fighting with Cloud Build deploys
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  template {
    service_account = google_service_account.cloud_run.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = local.image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "COINGECKO_PRO"
        value = "true"
      }

      # Secret environment variables
      dynamic "env" {
        for_each = local.secret_env_vars
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        period_seconds = 30
      }
    }

    timeout                          = "60s"
    max_instance_request_concurrency = 250
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_version.redis_url,
  ]
}

# Internal only — no public access. Callers must present a valid
# identity token (e.g. Cloud Scheduler OIDC, service-to-service IAM).
# To grant access to specific accounts:
#   google_cloud_run_v2_service_iam_member with member = "serviceAccount:..."

# ─── Custom Domain Mapping ───────────────────────────────────

resource "google_cloud_run_domain_mapping" "domain" {
  provider = google-beta
  name     = var.domain
  location = var.region

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }
}
