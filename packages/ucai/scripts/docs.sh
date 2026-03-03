#!/bin/bash
set -e

cd docs

case "${1:-serve}" in
    build)
        echo "Building documentation..."
        mkdocs build
        echo "✓ Documentation built in docs/site/"
        ;;
    serve)
        echo "Starting documentation server..."
        mkdocs serve
        ;;
    deploy)
        echo "Deploying to GitHub Pages..."
        mkdocs gh-deploy
        ;;
    *)
        echo "Usage: $0 {build|serve|deploy}"
        exit 1
        ;;
esac
