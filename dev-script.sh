#!/bin/bash

# LBMethodEngine development helper script

set -e

case "${1:-help}" in
  demo)
    echo "🏃 Running engine demo..."
    npm run engine:demo
    ;;

  test)
    echo "🧪 Running tests..."
    npm test -- --reporter=verbose
    ;;

  test:watch)
    echo "👀 Tests in watch mode..."
    npm test -- --watch
    ;;

  build)
    echo "🔨 Building..."
    npm run build
    echo "✅ Build complete in ./dist"
    ;;

  lint)
    echo "🔍 Type-checking..."
    npm run lint
    echo "✅ Type-check passed"
    ;;

  dev)
    echo "🚀 Starting API dev server..."
    npm run dev
    ;;

  dev:db)
    echo "🐘 Starting API with PostgreSQL..."
    USE_DB=true npm run dev
    ;;

  seed)
    echo "🌱 Seeding database (requires .env with DATABASE_URL)..."
    npm run prisma:seed
    ;;

  migrate)
    echo "📊 Running migrations..."
    npm run prisma:migrate
    ;;

  all)
    echo "🏃 Running lint + build + test..."
    npm run lint && npm run build && npm test
    echo "✅ All checks passed!"
    ;;

  *)
    cat << EOF
LBMethodEngine Development Helper

Usage: ./dev-script.sh [command]

Commands:
  demo        Run the engine demo (see generated 4-week program)
  test        Run all tests (25 tests)
  test:watch  Run tests in watch mode
  build       Build TypeScript to dist/
  lint        Type-check (tsc --noEmit)
  dev         Start API server (in-memory, no DB)
  dev:db      Start API server with PostgreSQL (set DATABASE_URL in .env)
  seed        Seed the exercise library to DB
  migrate     Run Prisma migrations
  all         Lint + build + test (pre-commit check)

Examples:
  ./dev-script.sh demo        # See what the engine produces
  ./dev-script.sh test        # Run all 25 tests
  ./dev-script.sh dev         # Start API on localhost:3000
  ./dev-script.sh all         # Full pre-commit check
EOF
    ;;
esac
