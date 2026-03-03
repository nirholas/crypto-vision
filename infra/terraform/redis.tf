# ─────────────────────────────────────────────────────────────
# Memorystore Redis
# ─────────────────────────────────────────────────────────────

resource "google_redis_instance" "cache" {
  name           = "${var.service_name}-cache"
  tier           = var.redis_tier
  memory_size_gb = var.redis_memory_size_gb
  region         = var.region
  redis_version  = "REDIS_7_0"
  display_name   = "Crypto Vision Cache"

  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 4
        minutes = 0
      }
    }
  }

  depends_on = [google_project_service.apis]
}
