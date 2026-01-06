# Ory Keto Docker Example

A self-contained Docker example demonstrating Ory Keto permission management with a document/file sharing permission model (similar to Google Drive).

## Quick Start

```bash
# Start Keto and load sample relationships
docker compose up -d

# Wait for initialization (check logs)
docker compose logs -f keto-init
```

## What's Included

### Permission Model (`namespaces.keto.ts`)

The OPL (Ory Permission Language) file defines four namespaces:

- **User** - Individual users
- **Group** - Groups containing users or other groups
- **Folder** - Folders with hierarchical permissions
- **Document** - Documents that can inherit folder permissions

Permissions support inheritance: if you can view a folder, you can view all documents inside it.

### Sample Data (`relation-tuples/relationships.json`)

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

## Cleanup

```bash
docker compose down -v
```

## Documentation

- [Ory Keto Documentation](https://www.ory.com/docs/keto)
- [Ory Permission Language (OPL)](https://www.ory.com/docs/keto/modeling/create-permission-model)
- [Keto CLI Reference](https://www.ory.com/docs/keto/cli/keto)
