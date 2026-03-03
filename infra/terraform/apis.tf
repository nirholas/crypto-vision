# ─────────────────────────────────────────────────────────────
# GCP APIs
# ─────────────────────────────────────────────────────────────

locals {
  required_apis = [
    "run.googleapis.com",
    "redis.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "vpcaccess.googleapis.com",
    "cloudbuild.googleapis.com",
    "containerregistry.googleapis.com",
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)
  project  = var.project_id
  service  = each.value

  disable_on_destroy = false
}

# ─────────────────────────────────────────────────────────────────
# Artifact Registry — Docker image repository (replaces deprecated GCR)
# ─────────────────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = "crypto-vision"
  format        = "DOCKER"
  description   = "Docker images for crypto-vision"

  cleanup_policy_dry_run = false

  # Keep last 10 tagged images, auto-delete untagged after 7 days
  cleanup_policies {
    id     = "keep-tagged"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s" # 7 days
    }
  }

  depends_on = [google_project_service.apis]
}
