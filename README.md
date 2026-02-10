# Ory Keto Docker Example

A self-contained Docker example demonstrating Ory Keto permission management with a document/file sharing permission model (similar to Google Drive).

## Quick Start

This example includes **two permission models** you can choose from using the `PERMISSION_TYPE` environment variable:
 - group-direct-permission
 - user-only-permission

### 1. Group Direct Permission (default)
Groups receive permissions directly and users inherit them through membership.

```bash
# Start Keto and load sample relationships
docker compose up -d
# OR explicitly set it
PERMISSION_TYPE=group-direct-permission docker compose up -d
```

**How it works:** When you grant `Group:engineering` the `editors` relation on `Folder:engineering-docs`, all members of the engineering group automatically inherit edit permissions. The group itself is listed as having the permission.

### 2. User Only Permission
Only users can receive permissions; groups act purely as membership containers.

```bash
# Start with user-only-permission model
PERMISSION_TYPE=user-only-permission docker compose up -d
```

**How it works:** Permissions are never granted directly to groups. Instead, permission checks traverse group membership to find individual users. For example, `Folder:engineering-docs` has `User:alice` and `User:bob` as editors (through their engineering group membership), but `Group:engineering` itself doesn't have a direct permission relationship.

### Key Difference

| Aspect | Group Direct Permission | User Only Permission |
|--------|------------------------|---------------------|
| **Permission grants** | Groups can be permission subjects | Only users can be permission subjects |
| **Query pattern** | "Does Group X have permission Y?" | "Which users in Group X have permission Y?" |
| **Use case** | Simplified management, fewer tuples | Explicit user tracking, audit trails |
| **Tuple example** | `Group:engineering -> editors -> Folder:docs` | `User:alice -> editors -> Folder:docs` (via group) |

### Wait for Initialization

```bash
# Check that relationships loaded successfully
docker compose logs -f keto-init
```

## What's Included

### Permission Models

Two different permission model implementations are available in the `permissions/` directory:

- **`permissions/group-direct-permission/`** - Groups receive permissions directly
  - `namespaces.keto.ts` - OPL schema allowing groups as permission subjects
  - `relationships.json` - Sample data with group-level permission grants

- **`permissions/user-only-permission/`** - Only users receive permissions
  - `namespaces.keto.ts` - OPL schema restricting permissions to users only
  - `relationships.json` - Sample data with user-level permission grants

The `PERMISSION_TYPE` variable controls which model is loaded into Keto.

### Permission Schema (`namespaces.keto.ts`)

The OPL (Ory Permission Language) file defines four namespaces:

- **User** - Individual users
- **Group** - Groups containing users or other groups
- **Folder** - Folders with hierarchical permissions
- **Document** - Documents that can inherit folder permissions

Permissions support inheritance: if you can view a folder, you can view all documents inside it.

### Sample Data (`relationships.json`)

Both permission models use the same organizational structure but with different relationship tuples based on whether groups or users receive permissions directly.

Pre-loaded relationships create this structure:

```
Users:
  - alice (engineering)
  - bob (engineering)
  - charlie (marketing)
  - diana (executive - owns company-root)

Folders:
  company-root/
  ├── engineering-docs/    (alice owns, engineering can edit)
  │   ├── architecture-design.pdf
  │   └── api-specification.md (bob owns)
  └── marketing-docs/      (charlie owns, marketing can edit)
      ├── brand-guidelines.pdf
      └── q4-campaign.pptx

Shared directly:
  - cross-team-project.docx (alice owns, charlie edits, bob views)
```

## Testing Permissions

### Using NodeJS

A test suite is available in `keto-test/` that demonstrates permission checking via the Keto REST API:

```bash
# Navigate to the test directory
cd keto-test

# Install dependencies (if not already installed)
npm install

# Run the test suite
npm test
```

**What the tests cover:**

1. **User Permission Tests** - Direct user permissions (alice views documents, bob edits files he owns)
2. **Group Membership Tests** - Users inheriting permissions through group membership
3. **Group-as-Subject Tests** - Groups having direct permissions (only works with `PERMISSION_TYPE=group-direct-permission`)

The test suite will show which permissions are allowed or denied, and highlight differences between the two permission models. When running with `user-only-permission`, the group-as-subject tests will all be denied as expected.

Example output:
```
✅ ALLOWED - Alice views architecture design document
  User:alice -> view -> Document:architecture-design.pdf

❌ DENIED - Charlie views engineering folder (should be denied)
  User:charlie -> view -> Folder:engineering-docs
```

### Using CLI

```bash
# Check if alice can view a document in engineering folder
docker compose exec keto keto check User:alice view Document architecture-design.pdf --insecure-disable-transport-security

# Check if bob can edit a document he owns
docker compose exec keto keto check User:bob edit Document api-specification.md --insecure-disable-transport-security

# Check if charlie can view engineering docs (should be denied)
docker compose exec keto keto check User:charlie view Folder engineering-docs --insecure-disable-transport-security

# Check if diana (executive) can view anything
docker compose exec keto keto check User:diana view Document architecture-design.pdf --insecure-disable-transport-security
```

Note: The `--insecure-disable-transport-security` flag is required because the local container uses HTTP, not HTTPS/TLS.

### Using REST API

```bash
# Check permission via REST API
curl -X POST http://localhost:4466/relation-tuples/check \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "Document",
    "object": "architecture-design.pdf",
    "relation": "view",
    "subject_set": {
      "namespace": "User",
      "object": "alice"
    }
  }'

# List all relationships
curl "http://localhost:4466/relation-tuples?namespace=Document"

# Expand permissions (see why access is granted)
curl -X POST http://localhost:4466/relation-tuples/expand \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "Document",
    "object": "architecture-design.pdf",
    "relation": "view",
    "max_depth": 5
  }'
```

### Using gRPC

The write API is available on port 4467 for creating/deleting relationships:

```bash
# Create a new relationship
curl -X PUT http://localhost:4467/admin/relation-tuples \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "Document",
    "object": "new-doc.pdf",
    "relation": "viewers",
    "subject_set": {
      "namespace": "User",
      "object": "alice"
    }
  }'
```

## OPA + Keto Integration

This project includes an **Open Policy Agent (OPA)** integration that demonstrates advanced authorization patterns by combining OPA policy evaluation with Keto permission checks. The integration provides REST API endpoints with JWT authentication and a sophisticated obligation system.

### What's Included

The `opa/` folder contains:
- **Three different policy implementations** with varying authorization logic
- **Express REST API server** with JWT token validation
- **CLI testing client** for easy permission testing
- **Obligation system** that provides actionable feedback when access is denied

**Policy Types:**
1. **Approval Groups Policy** - Advanced authorization with ShareApprovers group membership and multi-tier obligations
2. **VPN Policy** - Network requirement enforcement (10.x network check) before permission validation
3. **Simple Policy** - Direct Keto permission check with boolean response

### Quick Start with OPA

**Prerequisites:** Use the `group-direct-permission` permission model for the best OPA experience:

```bash
# 1. Start Keto with group-direct-permission data
PERMISSION_TYPE=group-direct-permission docker compose up -d

# Wait for initialization
docker compose logs -f keto-init

# 2. Start OPA server (from project root)
docker run -d --name opa -p 8181:8181 \
  -v "$PWD/opa/authz":/authz \
  openpolicyagent/opa:latest run --server --addr :8181 --watch /authz

# 3. Navigate to OPA folder and install dependencies
cd opa
npm install

# 4. Start the REST API server
npm start
# Server starts on http://localhost:3000

# 5. Test permissions (in another terminal)
npm run check alice GET architecture-design.pdf
npm run check alice SHARE architecture-design.pdf with bob
npm run check securityPerson1 SHARE test.pdf with charlie
```

### Key Features

**ShareApprovers Group:**
- Special approval group with members: `diana`, `securityPerson1`, `securityPerson2`, `securityPerson3`
- Members can share any document regardless of Keto permissions
- Dynamically queried from Keto in real-time

**Obligation System:**
- When access is denied, policies return structured obligations explaining why
- Example: User tries to share but only has view permission → Returns list of ShareApprovers who can grant approval
- JSON response includes obligation type and relevant data (like approver names)

**Sample Responses:**

```json
// Denied with approver list obligation
{
  "allowed": false,
  "obligations": [{
    "type": "needs_share_approver_approval",
    "approvers": ["diana", "securityPerson1", "securityPerson2", "securityPerson3"]
  }],
  "message": "Share action requires approval from ShareApprovers group members: ..."
}
```

### Learn More

📖 **See the [opa/README.md](opa/README.md) for:**
- Detailed policy documentation and obligation types
- REST API endpoint reference
- Testing different authorization scenarios
- How to test policies directly via OPA API
- How to switch between policy implementations

The OPA integration demonstrates real-world patterns like:
- Group-based authorization with dynamic membership queries
- Multi-tier access control with fallback rules  
- Obligation-based denial with actionable feedback
- Approval workflow foundations

## Expected Permission Results

| User    | Resource                  | view | edit | delete |
|---------|---------------------------|------|------|--------|
| alice   | engineering-docs/         | ✅   | ✅   | ✅     |
| alice   | architecture-design.pdf   | ✅   | ✅   | ✅     |
| bob     | engineering-docs/         | ✅   | ✅   | ❌     |
| bob     | api-specification.md      | ✅   | ✅   | ✅     |
| charlie | marketing-docs/           | ✅   | ✅   | ✅     |
| charlie | engineering-docs/         | ❌   | ❌   | ❌     |
| charlie | cross-team-project.docx   | ✅   | ✅   | ❌     |
| diana   | company-root/             | ✅   | ❌   | ✅     |
| diana   | engineering-docs/         | ✅   | ❌   | ❌     |

## Configuration

### keto.yaml

```yaml
dsn: memory                                    # In-memory storage (resets on restart)
namespaces:
  location: file:///etc/keto/namespaces.keto.ts
serve:
  read:
    port: 4466                                 # Read API (check, expand, list)
  write:
    port: 4467                                 # Write API (create, delete)
```

### Switching to Persistent Storage

To use PostgreSQL instead of in-memory:

1. Add a postgres service to docker-compose.yml
2. Update `dsn` in keto.yaml:
   ```yaml
   dsn: postgres://keto:secret@postgres:5432/keto?sslmode=disable
   ```
3. Run migrations: `docker compose exec keto keto migrate up`

## Switching Permission Models

To switch between permission models:

```bash
# Stop current setup
docker compose down -v

# Start with different model
PERMISSION_TYPE=user-only-permission docker compose up -d
```

You can also create a `.env` file in the project root to set a default:

```bash
PERMISSION_TYPE=user-only-permission
```

## Export Relationships After Editing

After making changes to relationships using the Write API, you can export the current state using the provided Python script:

```bash
# Export to stdout (view in terminal)
python3 permissions/exportRelationshipTuples.py

# Export to a file
python3 permissions/exportRelationshipTuples.py output.json
```

**What the script does:**

- Fetches all relation tuples from the Keto Read API (`http://localhost:4466/relation-tuples`)
- Cleans up the JSON format (removes empty relation fields from subject_set)
- Removes duplicate entries
- Sorts tuples for consistency
- Outputs clean JSON that can be used as a new `relationships.json` file

This is useful when you've added or modified relationships via the Write API and want to:
- Back up the current permission state
- Create a new relationships.json file for a permission model
- Review all active relationships in a clean format

**Example workflow:**

```bash
# 1. Make changes via the Write API
curl -X PUT http://localhost:4467/admin/relation-tuples \
  -H "Content-Type: application/json" \
  -d '{"namespace":"Document","object":"new-doc.pdf","relation":"viewers","subject_set":{"namespace":"User","object":"alice"}}'

# 2. Export the updated relationships
python3 permissions/exportRelationshipTuples.py permissions/custom-permission/relationships.json

# 3. Use the exported file with a new permission model
```

## Cleanup

```bash
docker compose down -v
```

## Documentation

- [Ory Keto Documentation](https://www.ory.com/docs/keto)
- [Ory Permission Language (OPL)](https://www.ory.com/docs/keto/modeling/create-permission-model)
- [Keto CLI Reference](https://www.ory.com/docs/keto/cli/keto)
