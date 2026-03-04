# Changelog Scripts

Automated tools for generating and maintaining the project changelog from git history.

## Available Scripts

### Generate Changelog

Generate a complete changelog from git history:

```bash
# Generate markdown changelog (stdout)
npm run changelog

# Generate JSON format
npm run changelog:json

# Generate HTML file
npm run changelog:html

# With options
node scripts/changelog/changelog-generator.js --since v1.0.0 --output CHANGELOG.md
```

### Sync Changelog

Compare existing CHANGELOG.md with git history:

```bash
# Show sync report (what's missing)
npm run changelog:sync

# Auto-update CHANGELOG.md with missing commits
npm run changelog:update
```

## Output Formats

### Markdown (default)
- Grouped by date
- Categorized by commit type (feat, fix, docs, etc.)
- Includes commit hashes with GitHub links
- Statistics summary

### JSON
- Machine-readable format
- Full commit metadata
- Useful for integrations

### HTML
- Styled dark theme
- Statistics cards
- Ready to deploy

## Conventional Commits

The scripts parse [Conventional Commits](https://www.conventionalcommits.org/):

| Type | Description |
|------|-------------|
| `feat` | New features |
| `fix` | Bug fixes |
| `docs` | Documentation |
| `style` | Formatting/styling |
| `refactor` | Code refactoring |
| `perf` | Performance improvements |
| `test` | Tests |
| `chore` | Maintenance |
| `ci` | CI/CD changes |
| `build` | Build system |

### Breaking Changes

Detected via:
- `!` in commit type: `feat!: breaking change`
- `BREAKING CHANGE:` in body

## Bash Script

For shell-based workflows:

```bash
# Make executable
chmod +x scripts/changelog/generate-changelog.sh

# Run
./scripts/changelog/generate-changelog.sh
./scripts/changelog/generate-changelog.sh --since v1.0.0
./scripts/changelog/generate-changelog.sh --days 7
./scripts/changelog/generate-changelog.sh --json
```

## Integration

### Pre-release

Add to your release workflow:

```bash
# Generate changelog for release
npm run changelog -- --since v1.0.0 --output RELEASE_NOTES.md
```

### CI/CD

```yaml
# GitHub Actions example
- name: Generate Changelog
  run: npm run changelog -- --output CHANGELOG_GENERATED.md
  
- name: Upload Changelog
  uses: actions/upload-artifact@v3
  with:
    name: changelog
    path: CHANGELOG_GENERATED.md
```

## Coverage Report

The sync script provides coverage metrics:

```
## Summary

- Total commits in git: 42
- Commits not in changelog: 5
- Coverage: 88.1%
```

Aim for 100% coverage for production releases.
