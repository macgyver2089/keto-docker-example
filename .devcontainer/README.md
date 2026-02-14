# Dev Container Setup

This project includes a VS Code Dev Container configuration for a consistent development environment.

## Features

- **Node.js 20**: For running the test suite
- **Keto Service**: Automatically starts with the dev container
- **Port Forwarding**: 
  - 4466: Keto Read API
  - 4467: Keto Write API
- **Git & GitHub CLI**: Pre-installed for version control
- **VS Code Extensions**: 
  - ESLint
  - Prettier
  - Docker
  - YAML support

## Getting Started

### Prerequisites

- [VS Code](https://code.visualstudio.com/)
- [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### Opening in Dev Container

1. Open this project in VS Code
2. Press `F1` or `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows/Linux)
3. Select: **Dev Containers: Reopen in Container**
4. Wait for the container to build and start

### Running Tests

Once inside the dev container:

```bash
cd keto-test
node test-permissions.js
```

### Restarting Keto After Changes

**Option 1: Automatic (Recommended)**
The Keto service has watch mode enabled. It will automatically restart when you modify:
- `namespaces.keto.ts`
- `relationships.json`
- `keto.yaml`

**Option 2: VS Code Task**
1. Press `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows/Linux)
2. Select: **Tasks: Run Task**
3. Choose: **Restart Keto**

**Option 3: Command Line**
```bash
restart-keto
```

**Option 4: Manual Docker Command**
```bash
docker compose -f docker/docker-compose.yml restart keto
```

### Reloading Relationships Only

If you only changed the relationships (not namespaces), use the **Reload Keto Relationships** task:
1. Press `Cmd+Shift+P` / `Ctrl+Shift+P`
2. Select: **Tasks: Run Task**
3. Choose: **Reload Keto Relationships**

This deletes all existing tuples and reloads from your JSON file.

### Changing Permission Types

The container starts with `PERMISSION_TYPE=group-direct-permission` by default. To use a different permission set:

1. Update the `PERMISSION_TYPE` environment variable in [.devcontainer/docker-compose.devcontainer.yml](.devcontainer/docker-compose.devcontainer.yml)
2. Rebuild the container: `Dev Containers: Rebuild Container`

Available types:
- `group-direct-permission`
- `user-only-permission`
- `security-scorecard/set1`

### Accessing Keto CLI

The Keto service runs alongside your dev container. Execute Keto commands with:

**Using the Docker exec alias:**
```bash
keto check alice view Document architecture-design.pdf --insecure-disable-transport-security
```

**Or the full command:**
```bash
docker compose -f docker/docker-compose.yml exec keto keto <command>
```

Example:
```bash
docker compose -f docker/docker-compose.yml exec keto keto check alice view Document architecture-design.pdf --insecure-disable-transport-security
```

### Using Ory CLI

The **Ory CLI** is pre-installed in the devcontainer. You can use it to interact with Keto via the REST API:

**Check permissions:**
```bash
ory check permission \
  --endpoint http://localhost:4466 \
  --namespace Document \
  --object architecture-design.pdf \
  --relation view \
  --subject-id alice \
  --skip-tls-verify
```

**Helper alias (simpler syntax):**
```bash
ory-keto-check alice view Document architecture-design.pdf
```

**List relation tuples:**
```bash
ory list relationships \
  --endpoint http://localhost:4466 \
  --skip-tls-verify
```

**For full Ory CLI documentation:**
```bash
ory help
```

## File Structure

```
.devcontainer/
├── devcontainer.json              # Main dev container configuration
├── docker-compose.devcontainer.yml # Dev container service definition
└── README.md                      # This file
```

## Tips

- **Auto-restart on changes**: The Keto service uses watch mode and automatically reloads when you modify namespace or relationship files
- **VS Code Tasks**: Press `Cmd+Shift+P` → **Tasks: Run Task** to access:
  - **Restart Keto** - Full service restart
  - **Reload Keto Relationships** - Quick relationship reload
  - **Run Permission Tests** - Execute test suite
- **Terminal access**: Open multiple terminals in VS Code to run tests, watch logs, etc.
- **Docker logs**: View Keto logs with `docker compose -f docker/docker-compose.yml logs -f keto`
- **Quick restart**: Just type `restart-keto` in any terminal
- **Quick Keto CLI**: Use the `keto` alias instead of the full docker compose command
- **Ory CLI**: Use `ory-keto-check alice view Document file.pdf` for quick permission checks
- **Available commands**: Type `ory help` to see all available Ory CLI commands
