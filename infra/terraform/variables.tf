# ─────────────────────────────────────────────────────────────
# Variables
# ─────────────────────────────────────────────────────────────

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "crypto-vision"
}

variable "domain" {
  description = "Custom domain for the service"
  type        = string
  default     = "cryptocurrency.cv"
}

variable "redis_tier" {
  description = "Memorystore Redis tier (BASIC or STANDARD_HA)"
  type        = string
  default     = "STANDARD_HA"
  validation {
    condition     = contains(["BASIC", "STANDARD_HA"], var.redis_tier)
    error_message = "Redis tier must be BASIC or STANDARD_HA."
  }
}

variable "redis_memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 5
}

variable "cloud_run_memory" {
  description = "Memory per Cloud Run instance"
  type        = string
  default     = "2Gi"
}

variable "cloud_run_cpu" {
  description = "vCPUs per Cloud Run instance"
  type        = string
  default     = "4"
}

variable "cloud_run_min_instances" {
  description = "Minimum Cloud Run instances (always warm)"
  type        = number
  default     = 2
}

variable "cloud_run_max_instances" {
  description = "Maximum Cloud Run instances (scales to 10M+ users)"
  type        = number
  default     = 500
}

variable "container_image" {
  description = "Container image to deploy (e.g., us-central1-docker.pkg.dev/PROJECT/crypto-vision/crypto-vision:latest)"
  type        = string
  default     = ""
}

variable "secret_names" {
  description = "List of secret names to create in Secret Manager"
  type        = list(string)
  default = [
    "COINGECKO_API_KEY",
    "GROQ_API_KEY",
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENROUTER_API_KEY",
    "REDIS_URL",
  ]
}

variable "scheduler_jobs" {
  description = "Cloud Scheduler jobs for periodic data refresh"
  type = list(object({
    name     = string
    schedule = string
    path     = string
    desc     = string
  }))
  default = [
    {
      name     = "refresh-coins"
      schedule = "*/2 * * * *"
      path     = "/api/coins"
      desc     = "Refresh top coins by market cap"
    },
    {
      name     = "refresh-trending"
      schedule = "*/5 * * * *"
      path     = "/api/trending"
      desc     = "Refresh trending coins"
    },
    {
      name     = "refresh-global"
      schedule = "*/5 * * * *"
      path     = "/api/global"
      desc     = "Refresh global market stats"
    },
    {
      name     = "refresh-fear-greed"
      schedule = "*/15 * * * *"
      path     = "/api/fear-greed"
      desc     = "Refresh Fear and Greed index"
    },
    {
      name     = "refresh-defi-protocols"
      schedule = "*/10 * * * *"
      path     = "/api/defi/protocols"
      desc     = "Refresh DeFi protocol TVL data"
    },
    {
      name     = "refresh-defi-chains"
      schedule = "*/10 * * * *"
      path     = "/api/defi/chains"
      desc     = "Refresh chain TVL rankings"
    },
    {
      name     = "refresh-news"
      schedule = "*/5 * * * *"
      path     = "/api/news"
      desc     = "Refresh crypto news feed"
    },
  ]
}
