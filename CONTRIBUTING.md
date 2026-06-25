# Contributing to Zhidu

Thank you for your interest in contributing to Zhidu! This guide will help you get started.

## Project Structure

```
zhidu/
  apps/
    web/          # Next.js frontend (App Router)
  packages/
    ui/           # Shared UI components
    config/       # Shared configs (TypeScript, Tailwind, etc.)
  src-tauri/      # Tauri desktop app (Rust backend)
```

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Rust** (latest stable, for Tauri desktop builds)

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/zhidu.git
   cd zhidu
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the dev server:
   ```bash
   pnpm dev
   ```

   This runs all apps in parallel via Turborepo. The web app will be available at `http://localhost:3000`.

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `dev` | Active development |
| `feature/*` | New features (branch from `dev`) |
| `fix/*` | Bug fixes (branch from `dev`) |

## Commit Message Convention

Follow the Conventional Commits format:

```
type(scope): description
```

**Types:**
- `feat` - New features
- `fix` - Bug fixes
- `docs` - Documentation changes
- `style` - Code style (formatting, semicolons, etc.)
- `refactor` - Code refactoring (no feature or fix)
- `test` - Adding or updating tests
- `chore` - Build, CI, or tooling changes

**Examples:**
```
feat(web): add volunteer recommendation page
fix(ui): correct button border radius on mobile
docs: update README with setup instructions
```

## Code Style

- **TypeScript** with strict mode enabled
- **TailwindCSS** for all styling -- avoid custom CSS unless necessary
- **Prettier** for formatting (config in `.prettierrc`)
- Components should be functional with proper TypeScript types

## Pull Request Process

1. Fork the repository
2. Create a branch from `dev`: `feature/your-feature`
3. Make your changes and commit following the convention above
4. Push to your fork and open a PR targeting `dev`
5. Ensure CI passes and address review feedback
6. A maintainer will merge once approved

## Questions?

Open an issue on GitHub or reach out to the maintainers.
