# ─────────────────────────────────────────────────────────────
# Secret Manager
# ─────────────────────────────────────────────────────────────

resource "google_secret_manager_secret" "secrets" {
  for_each  = toset(var.secret_names)
  secret_id = each.value

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

# Auto-populate REDIS_URL with the Memorystore endpoint (including auth string)
resource "google_secret_manager_secret_version" "redis_url" {
  secret      = google_secret_manager_secret.secrets["REDIS_URL"].id
  secret_data = "redis://:${google_redis_instance.cache.auth_string}@${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
}

# Grant Cloud Run SA access to all secrets
resource "google_secret_manager_secret_iam_member" "cloud_run_access" {
  for_each  = toset(var.secret_names)
  secret_id = google_secret_manager_secret.secrets[each.value].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}
