#!/bin/bash
# =============================================================================
# Generate Changelog from Git History
# =============================================================================
#
# Usage:
#   ./scripts/changelog/generate-changelog.sh              # Full changelog
#   ./scripts/changelog/generate-changelog.sh --since v1.0 # Since tag
#   ./scripts/changelog/generate-changelog.sh --days 7     # Last 7 days
#   ./scripts/changelog/generate-changelog.sh --json       # JSON output
#
# Output:
#   Generates changelog grouped by type (feat, fix, docs, etc.)
#
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
SINCE=""
DAYS=""
FORMAT="markdown"
OUTPUT_FILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --since)
            SINCE="$2"
            shift 2
            ;;
        --days)
            DAYS="$2"
            shift 2
            ;;
        --json)
            FORMAT="json"
            shift
            ;;
        --output|-o)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --since <tag>     Generate changelog since tag/commit"
            echo "  --days <n>        Generate changelog for last n days"
            echo "  --json            Output in JSON format"
            echo "  --output <file>   Write to file instead of stdout"
            echo "  --help            Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Build git log command
GIT_LOG_CMD="git log --pretty=format:'%H|%ai|%an|%s|%b' --all"

if [[ -n "$SINCE" ]]; then
    GIT_LOG_CMD="$GIT_LOG_CMD $SINCE..HEAD"
fi

if [[ -n "$DAYS" ]]; then
    GIT_LOG_CMD="$GIT_LOG_CMD --since='$DAYS days ago'"
fi

# Categorize commits by conventional commit type
categorize_commits() {
    local commits="$1"
    
    # Initialize categories
    declare -A categories
    categories["feat"]=""
    categories["fix"]=""
    categories["docs"]=""
    categories["style"]=""
    categories["refactor"]=""
    categories["perf"]=""
    categories["test"]=""
    categories["chore"]=""
    categories["other"]=""
    
    while IFS='|' read -r hash date author subject body; do
        # Skip empty lines
        [[ -z "$hash" ]] && continue
        
        # Extract type from conventional commit format
        local type="other"
        if [[ "$subject" =~ ^feat(\(.+\))?:\ .+ ]]; then
            type="feat"
        elif [[ "$subject" =~ ^fix(\(.+\))?:\ .+ ]]; then
            type="fix"
        elif [[ "$subject" =~ ^docs(\(.+\))?:\ .+ ]]; then
            type="docs"
        elif [[ "$subject" =~ ^style(\(.+\))?:\ .+ ]]; then
            type="style"
        elif [[ "$subject" =~ ^refactor(\(.+\))?:\ .+ ]]; then
            type="refactor"
        elif [[ "$subject" =~ ^perf(\(.+\))?:\ .+ ]]; then
            type="perf"
        elif [[ "$subject" =~ ^test(\(.+\))?:\ .+ ]]; then
            type="test"
        elif [[ "$subject" =~ ^chore(\(.+\))?:\ .+ ]]; then
            type="chore"
        fi
        
        # Store commit info
        categories[$type]+="${hash}|${date}|${author}|${subject}|${body}"$'\n'
    done <<< "$commits"
    
    # Output categories
    for type in feat fix docs style refactor perf test chore other; do
        if [[ -n "${categories[$type]}" ]]; then
            echo "CATEGORY:$type"
            echo "${categories[$type]}"
        fi
    done
}

# Generate markdown output
generate_markdown() {
    local commits="$1"
    
    echo "# Changelog (Generated from Git History)"
    echo ""
    echo "Generated on: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "---"
    echo ""
    
    # Get unique dates for grouping
    local current_date=""
    
    # Group by date
    while IFS='|' read -r hash date author subject body; do
        [[ -z "$hash" ]] && continue
        
        local commit_date="${date:0:10}"
        
        if [[ "$commit_date" != "$current_date" ]]; then
            echo ""
            echo "## $commit_date"
            echo ""
            current_date="$commit_date"
        fi
        
        # Format subject nicely
        local formatted_subject="$subject"
        
        # Add emoji based on type
        if [[ "$subject" =~ ^feat ]]; then
            formatted_subject="✨ $subject"
        elif [[ "$subject" =~ ^fix ]]; then
            formatted_subject="🐛 $subject"
        elif [[ "$subject" =~ ^docs ]]; then
            formatted_subject="📚 $subject"
        elif [[ "$subject" =~ ^style ]]; then
            formatted_subject="💅 $subject"
        elif [[ "$subject" =~ ^refactor ]]; then
            formatted_subject="♻️ $subject"
        elif [[ "$subject" =~ ^perf ]]; then
            formatted_subject="⚡ $subject"
        elif [[ "$subject" =~ ^test ]]; then
            formatted_subject="🧪 $subject"
        elif [[ "$subject" =~ ^chore ]]; then
            formatted_subject="🔧 $subject"
        fi
        
        echo "- **$formatted_subject** (\`${hash:0:7}\`)"
        
        # Add body if present
        if [[ -n "$body" && "$body" != " " ]]; then
            echo "  - ${body//\\n/\\n  - }"
        fi
        
    done <<< "$commits"
}

# Generate JSON output
generate_json() {
    local commits="$1"
    
    echo "{"
    echo '  "generated_at": "'$(date -Iseconds)'",'
    echo '  "commits": ['
    
    local first=true
    while IFS='|' read -r hash date author subject body; do
        [[ -z "$hash" ]] && continue
        
        # Determine type
        local type="other"
        if [[ "$subject" =~ ^feat ]]; then type="feat"
        elif [[ "$subject" =~ ^fix ]]; then type="fix"
        elif [[ "$subject" =~ ^docs ]]; then type="docs"
        elif [[ "$subject" =~ ^style ]]; then type="style"
        elif [[ "$subject" =~ ^refactor ]]; then type="refactor"
        elif [[ "$subject" =~ ^perf ]]; then type="perf"
        elif [[ "$subject" =~ ^test ]]; then type="test"
        elif [[ "$subject" =~ ^chore ]]; then type="chore"
        fi
        
        # Escape JSON
        subject="${subject//\"/\\\"}"
        body="${body//\"/\\\"}"
        
        if [[ "$first" != "true" ]]; then
            echo ","
        fi
        first=false
        
        echo '    {'
        echo "      \"hash\": \"$hash\","
        echo "      \"short_hash\": \"${hash:0:7}\","
        echo "      \"date\": \"$date\","
        echo "      \"author\": \"$author\","
        echo "      \"type\": \"$type\","
        echo "      \"subject\": \"$subject\","
        echo "      \"body\": \"$body\""
        echo -n '    }'
        
    done <<< "$commits"
    
    echo ""
    echo "  ]"
    echo "}"
}

# Main execution
echo -e "${CYAN}Generating changelog from git history...${NC}" >&2

# Get commits
COMMITS=$(eval "$GIT_LOG_CMD")

if [[ -z "$COMMITS" ]]; then
    echo -e "${YELLOW}No commits found.${NC}" >&2
    exit 0
fi

# Generate output based on format
if [[ "$FORMAT" == "json" ]]; then
    OUTPUT=$(generate_json "$COMMITS")
else
    OUTPUT=$(generate_markdown "$COMMITS")
fi

# Write to file or stdout
if [[ -n "$OUTPUT_FILE" ]]; then
    echo "$OUTPUT" > "$OUTPUT_FILE"
    echo -e "${GREEN}Changelog written to $OUTPUT_FILE${NC}" >&2
else
    echo "$OUTPUT"
fi

echo -e "${GREEN}Done!${NC}" >&2
