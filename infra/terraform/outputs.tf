# ─────────────────────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────────────────────

output "cloud_run_url" {
  description = "Cloud Run service URL"
  value       = google_cloud_run_v2_service.app.uri
}

output "redis_host" {
  description = "Memorystore Redis host"
  value       = google_redis_instance.cache.host
}

output "redis_port" {
  description = "Memorystore Redis port"
  value       = google_redis_instance.cache.port
}

output "domain" {
  description = "Custom domain"
  value       = var.domain
}

output "domain_dns_records" {
  description = "DNS records to configure for the custom domain"
  value       = google_cloud_run_domain_mapping.domain.status
}

output "vpc_connector" {
  description = "VPC connector name"
  value       = google_vpc_access_connector.connector.name
}

output "cloud_run_service_account" {
  description = "Cloud Run service account email"
  value       = google_service_account.cloud_run.email
}

output "scheduler_service_account" {
  description = "Scheduler invoker service account email"
  value       = google_service_account.scheduler.email
}

output "artifact_registry" {
  description = "Artifact Registry Docker repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}

output "redis_auth_enabled" {
  description = "Whether Redis AUTH is enabled"
  value       = google_redis_instance.cache.auth_enabled
  sensitive   = true
}
