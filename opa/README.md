OPA + Ory Keto example

This folder demonstrates a simple integration where an OPA policy calls Ory Keto to check whether a `User` has a specific relation on a `Document`.

Files
- `policy.rego` - Rego policy using `http.send` to call Keto's `/relation-tuples/check` endpoint.
- `server.js` - Express REST API server that validates JWT tokens and checks permissions via OPA for view, edit, delete, and share operations.
- `package.json` - Node dependencies for the server.

Quick start

1. Ensure Keto is running (from project root):

```bash
PERMISSION_TYPE=user-only-permission docker compose up -d
```

2. Start OPA in server mode and load the policy:

```bash
docker run -d --name opa -p 8181:8181 -v "$PWD/opa/policy.rego":/policy.rego openpolicyagent/opa:latest run --server --addr :8181 /policy.rego
```

3. Install Node dependencies and start the REST server (from `opa/`):

```bash
cd opa
npm install
npm start
```

The server will start on port 3000 and display available endpoints.

REST API Endpoints

All endpoints require a JWT token in the `Authorization: Bearer <token>` header.

**GET /documents/:document** - Check view permission
```bash
curl -X GET http://localhost:3000/documents/architecture-design.pdf \
  -H "Authorization: Bearer <JWT>"
```

**POST /documents/:document** - Check edit permission
```bash
curl -X POST http://localhost:3000/documents/api-specification.md \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json"
```

**DELETE /documents/:document** - Check delete permission
```bash
curl -X DELETE http://localhost:3000/documents/architecture-design.pdf \
  -H "Authorization: Bearer <JWT>"
```

**POST /documents/:document/share** - Check share permission
```bash
curl -X POST http://localhost:3000/documents/api-specification.md/share \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"shareWith":"user@example.com"}'
```

**GET /health** - Health check endpoint
```bash
curl http://localhost:3000/health
```

Testing with the CLI Client

A Node.js CLI client (`authz-client.js`) is provided for easy testing:

```bash
# Test view permission
node authz-client.js alice GET architecture-design.pdf
# Output: ✅ VIEW | User: alice | Document: architecture-design.pdf

# Test edit permission
node authz-client.js bob POST api-specification.md

# Test delete permission
node authz-client.js alice DELETE architecture-design.pdf

# Test share permission
node authz-client.js alice SHARE api-specification.md charlie

# Test denied access
node authz-client.js charlie GET architecture-design.pdf
# Output: ❌ VIEW | User: charlie | Document: architecture-design.pdf (403 Forbidden)
```

**CLI Usage:**
```bash
node authz-client.js <user> <action> <document> [shareWith]

# Arguments:
#   user       - User identifier (alice, bob, charlie, diana)
#   action     - GET (view), POST (edit), DELETE (delete), SHARE (share)
#   document   - Document name
#   shareWith  - User to share with (only for SHARE)
```

Testing with cURL

You can also test directly with cURL:

```bash
TOKEN=$(node -e "console.log(Buffer.from(JSON.stringify({alg:'none'})).toString('base64url') + '.' + Buffer.from(JSON.stringify({sub:'alice'})).toString('base64url') + '.')")

# Test view permission
curl -X GET http://localhost:3000/documents/architecture-design.pdf \
  -H "Authorization: Bearer $TOKEN"

# Response: {"allowed":true,"action":"view","document":"architecture-design.pdf","user":"alice"}
```

What happens

- The REST server validates the JWT and extracts the `sub` claim as the user identifier.
- For each request, it maps the HTTP method to a Keto relation:
  - `GET` → `view`
  - `POST` → `edit`
  - `DELETE` → `delete`
  - `POST /share` → `share`
- It calls OPA's REST API (`/v1/data/authz/allow`) with input `{ user, document, relation }`.
- The Rego policy uses `http.send` to POST to Keto's `/relation-tuples/check` endpoint.
- The result flows back: Keto → OPA → REST API → Client.

Response Format

Success (allowed):
```json
{
  "allowed": true,
  "action": "view",
  "document": "architecture-design.pdf",
  "user": "alice"
}
```

Denied:
```json
{
  "allowed": false,
  "action": "edit",
  "document": "architecture-design.pdf",
  "user": "charlie",
  "error": "Permission denied"
}
```

Notes

- The policy uses `host.docker.internal` as the Keto host so that OPA (when run in Docker) can reach the Keto service on the host. If you run everything on the host, the policy will work as-is since it falls back to localhost.
- For production, verify and validate JWTs (signature and issuer). This example only decodes the token for simplicity.
- The server returns HTTP 403 for denied permissions and HTTP 401 for missing/invalid tokens.
