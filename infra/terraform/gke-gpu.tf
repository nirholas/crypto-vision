# ─────────────────────────────────────────────────────────────
# GKE GPU Cluster for Model Training
#
# Provisions a GKE cluster with GPU node pools for fine-tuning
# open-source LLMs. Nodes scale from 0 to minimize costs.
#
# GPU Node Pools:
#   - L4 (24GB VRAM): For 7-8B models, ~$1.50/hr
#   - A100 40GB: For larger models or faster training, ~$3/hr
#   - A100 80GB: For 70B models with LoRA, ~$7.50/hr
#
# Copyright 2024-2026 nirholas. All rights reserved.
# ─────────────────────────────────────────────────────────────

# ─── GKE Training Cluster ────────────────────────────────────

resource "google_container_cluster" "training" {
  name     = "crypto-vision-training"
  location = var.region
  project  = var.project_id

  # Use a separately managed node pool (remove default)
  remove_default_node_pool = true
  initial_node_count       = 1

  # Network config
  network    = google_compute_network.vpc.self_link
  subnetwork = google_compute_subnetwork.private.self_link

  ip_allocation_policy {
    # Use IP aliases for VPC-native cluster (required for private clusters)
  }

  # Enable Workload Identity for secure GCS access
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Logging and monitoring
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
    managed_prometheus {
      enabled = true
    }
  }

  # Release channel for automatic upgrades
  release_channel {
    channel = "REGULAR"
  }

  # Maintenance window — train during off-peak
  maintenance_policy {
    daily_maintenance_window {
      start_time = "03:00"
    }
  }

  lifecycle {
    ignore_changes = [
      initial_node_count,
    ]
  }
}

# ─── CPU Node Pool (system workloads) ────────────────────────

resource "google_container_node_pool" "cpu_system" {
  name     = "cpu-system-pool"
  cluster  = google_container_cluster.training.id
  location = var.region
  project  = var.project_id

  initial_node_count = 1

  autoscaling {
    min_node_count = 1
    max_node_count = 3
  }

  node_config {
    machine_type = "e2-standard-4"
    disk_size_gb = 100
    disk_type    = "pd-standard"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = {
      workload = "system"
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# ─── L4 GPU Node Pool (7-8B models) ─────────────────────────

resource "google_container_node_pool" "gpu_l4" {
  name     = "gpu-l4-pool"
  cluster  = google_container_cluster.training.id
  location = var.region
  project  = var.project_id

  # Scale from 0 — no cost when idle
  initial_node_count = 0

  autoscaling {
    min_node_count = 0
    max_node_count = 4
  }

  node_config {
    machine_type = "g2-standard-8" # 8 vCPUs, 32GB RAM, 1x L4 GPU

    guest_accelerator {
      type  = "nvidia-l4"
      count = 1
      gpu_driver_installation_config {
        gpu_driver_version = "LATEST"
      }
    }

    disk_size_gb = 200
    disk_type    = "pd-ssd"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = {
      workload = "gpu-training"
      gpu-type = "nvidia-l4"
    }

    taint {
      key    = "nvidia.com/gpu"
      value  = "present"
      effect = "NO_SCHEDULE"
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# ─── A100 40GB GPU Node Pool (larger models) ────────────────

resource "google_container_node_pool" "gpu_a100_40" {
  name     = "gpu-a100-40-pool"
  cluster  = google_container_cluster.training.id
  location = var.region
  project  = var.project_id

  initial_node_count = 0

  autoscaling {
    min_node_count = 0
    max_node_count = 2
  }

  node_config {
    machine_type = "a2-highgpu-1g" # 12 vCPUs, 85GB RAM, 1x A100 40GB

    guest_accelerator {
      type  = "nvidia-tesla-a100"
      count = 1
      gpu_driver_installation_config {
        gpu_driver_version = "LATEST"
      }
    }

    disk_size_gb = 500
    disk_type    = "pd-ssd"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = {
      workload = "gpu-training"
      gpu-type = "nvidia-tesla-a100"
    }

    taint {
      key    = "nvidia.com/gpu"
      value  = "present"
      effect = "NO_SCHEDULE"
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# ─── A100 80GB GPU Node Pool (70B models) ───────────────────

resource "google_container_node_pool" "gpu_a100_80" {
  name     = "gpu-a100-80-pool"
  cluster  = google_container_cluster.training.id
  location = var.region
  project  = var.project_id

  initial_node_count = 0

  autoscaling {
    min_node_count = 0
    max_node_count = 2
  }

  node_config {
    machine_type = "a2-ultragpu-1g" # 12 vCPUs, 170GB RAM, 1x A100 80GB

    guest_accelerator {
      type  = "nvidia-a100-80gb"
      count = 1
      gpu_driver_installation_config {
        gpu_driver_version = "LATEST"
      }
    }

    disk_size_gb = 500
    disk_type    = "pd-ssd"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = {
      workload = "gpu-training"
      gpu-type = "nvidia-a100-80gb"
    }

    taint {
      key    = "nvidia.com/gpu"
      value  = "present"
      effect = "NO_SCHEDULE"
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# ─── GCS Bucket for Model Weights ───────────────────────────

resource "google_storage_bucket" "models" {
  name     = "${var.project_id}-models"
  project  = var.project_id
  location = var.region

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90 # Delete old model versions after 90 days
    }
    action {
      type = "Delete"
    }
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 3 # Keep only 3 versions per object
    }
    action {
      type = "Delete"
    }
  }
}

# ─── Artifact Registry for Training Images ──────────────────

resource "google_artifact_registry_repository" "training" {
  project       = var.project_id
  location      = var.region
  repository_id = "crypto-vision-training"
  format        = "DOCKER"
  description   = "Docker images for model training and inference"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 5
    }
  }
}

# ─── IAM: Training Service Account ──────────────────────────

resource "google_service_account" "training" {
  project      = var.project_id
  account_id   = "crypto-vision-training"
  display_name = "Crypto Vision Training Service Account"
  description  = "Used by GKE training jobs to access GCS and Artifact Registry"
}

# GCS access for model upload
resource "google_storage_bucket_iam_member" "training_gcs" {
  bucket = google_storage_bucket.models.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.training.email}"
}

# Artifact Registry access for pulling training images
resource "google_artifact_registry_repository_iam_member" "training_ar" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.training.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.training.email}"
}

# Workload Identity binding
resource "google_service_account_iam_member" "training_workload_identity" {
  service_account_id = google_service_account.training.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[training/training-sa]"
}

# ─── Outputs ─────────────────────────────────────────────────

output "training_cluster_name" {
  description = "GKE training cluster name"
  value       = google_container_cluster.training.name
}

output "training_cluster_endpoint" {
  description = "GKE training cluster endpoint"
  value       = google_container_cluster.training.endpoint
  sensitive   = true
}

output "models_bucket" {
  description = "GCS bucket for model weights"
  value       = google_storage_bucket.models.url
}

output "training_registry" {
  description = "Artifact Registry URL for training images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.training.repository_id}"
}

output "training_service_account" {
  description = "Training service account email"
  value       = google_service_account.training.email
}
