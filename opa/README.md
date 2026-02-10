OPA + Ory Keto example

This folder demonstrates OPA policy integration with Ory Keto for permission checking. Three different policy implementations are provided, each with unique authorization logic and obligation handling.

Files

**Policy Files** (`authz/` directory):
- `approvalGroups.rego` - Advanced policy with ShareApprovers group logic and obligation system (package: `authz.approval`)
- `vpnpolicy.rego` - VPN network requirement policy with obligation reporting (package: `authz.vpn`)
- `simplepolicy.rego` - Simple Keto permission check policy (package: `authz.simple`)

**Server Files**:
- `server.js` - Express REST API server that validates JWT tokens and checks permissions via OPA
- `authz-client.js` - CLI testing client with JWT generation
- `package.json` - Node dependencies

## Policy Documentation

### 1. Approval Groups Policy (`authz.approval`)

**Endpoint**: `/v1/data/authz/approval/approval_or_not`

**Purpose**: Advanced authorization with ShareApprovers group membership and multi-tier obligation system.

**Authorization Logic**:
- **Share Actions**: Allowed if user is in ShareApprovers group OR has explicit share permission from Keto
- **Other Actions** (view/edit/delete): Allowed if user has the required permission from Keto

**Obligations** (returned when denied):

1. **`needs_share_approver_approval`**
   - **When**: User tries to share but only has view/edit permission (not share)
   - **Structure**: 
     ```json
     {
       "type": "needs_share_approver_approval",
       "approvers": ["diana", "securityPerson1", "securityPerson2", "securityPerson3"]
     }
     ```
   - **Message**: "Share action requires approval from ShareApprovers group members: diana, securityPerson1, securityPerson2, securityPerson3"

2. **`security_team_notification`**
   - **When**: User tries to share without ANY permissions (view/edit/share)
   - **Structure**: `{ "type": "security_team_notification" }`
   - **Message**: "Access denied. This attempt has been reported to the security team."

3. **`insufficient_permissions`**
   - **When**: User lacks required permission for non-share actions
   - **Structure**: `{ "type": "insufficient_permissions" }`
   - **Message**: "Insufficient permissions"

**Example Response**:
```json
{
  "allow": false,
  "obligations": [
    {
      "type": "needs_share_approver_approval",
      "approvers": ["diana", "securityPerson1", "securityPerson2", "securityPerson3"]
    }
  ]
}
```

### 2. VPN Policy (`authz.vpn`)

**Endpoint**: `/v1/data/authz/vpn/decision`

**Purpose**: Enforce VPN network requirement (10.x network) before checking permissions.

**Authorization Logic**:
1. Check if user's IP is on 10.x network
2. If on VPN, check Keto permissions
3. Allow only if both conditions met

**Obligations** (returned when denied):

1. **`connect_to_vpn`**
   - **When**: User's IP address is not on 10.x network
   - **Structure**: `"connect_to_vpn"` (string)
   - **Message**: "You must connect to the VPN (10.x network) to access this resource"

2. **`insufficient_permissions`**
   - **When**: User is on VPN but lacks required permission
   - **Structure**: `"insufficient_permissions"` (string)
   - **Message**: "Insufficient permissions"

**Example Request**:
```json
{
  "input": {
    "user": "alice",
    "document": "architecture-design.pdf",
    "relation": "view",
    "client_ip": "192.168.1.100"
  }
}
```

**Example Response**:
```json
{
  "allow": false,
  "obligations": ["connect_to_vpn"]
}
```

### 3. Simple Policy (`authz.simple`)

**Endpoint**: `/v1/data/authz/simple/allowSimple`

**Purpose**: Direct Keto permission check with boolean response.

**Authorization Logic**:
- Calls Keto's `/relation-tuples/check` endpoint
- Returns `true` if permission granted, `false` otherwise

**Obligations**: None (simple boolean response)

**Example Response**:
```json
{
  "allowSimple": true
}
```

Quick start

1. Ensure Keto is running (from project root):

```bash
PERMISSION_TYPE=user-only-permission docker compose up -d
```

2. Start OPA in server mode and load the policies:

```bash
docker run -d --name opa -p 8181:8181 -v "$PWD/opa/authz":/authz openpolicyagent/opa:latest run --server --addr :8181 --watch /authz
```

This loads all three policies with their respective package namespaces.

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

Or use the npm script:
```bash
npm run check <user> <action> <document> [with <shareWith>]

# Examples:
npm run check alice GET architecture-design.pdf
npm run check alice SHARE architecture-design.pdf with bob
npm run check securityPerson1 SHARE test.pdf with charlie
```

## Testing Different Scenarios

### ShareApprovers Group Scenarios

**Scenario 1: User in ShareApprovers tries to share**
```bash
npm run check securityPerson1 SHARE test.pdf with bob
# Result: ✅ ALLOWED (member of ShareApprovers group)
```

**Scenario 2: User with view permission tries to share**
```bash
npm run check alice SHARE architecture-design.pdf with bob
# Result: ❌ DENIED with obligation: needs_share_approver_approval
# Response includes list of approvers: diana, securityPerson1, securityPerson2, securityPerson3
```

**Scenario 3: User with no permissions tries to share**
```bash
npm run check randomuser SHARE test.pdf with bob
# Result: ❌ DENIED with obligation: security_team_notification
```

**Scenario 4: Normal view/edit operations**
```bash
npm run check alice GET architecture-design.pdf
# Result: ✅ ALLOWED (has view permission)

npm run check bob POST api-specification.md
# Result: ✅ ALLOWED (has edit permission)
```

### Testing Policies Directly via OPA API

**Test Approval Groups Policy**:
```bash
curl -s http://localhost:8181/v1/data/authz/approval/approval_or_not \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {
      "user": "alice",
      "document": "architecture-design.pdf",
      "relation": "share"
    }
  }' | jq
```

**Test VPN Policy**:
```bash
curl -s http://localhost:8181/v1/data/authz/vpn/decision \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {
      "user": "alice",
      "document": "architecture-design.pdf",
      "relation": "view",
      "client_ip": "10.0.1.5"
    }
  }' | jq
```

**Test Simple Policy**:
```bash
curl -s http://localhost:8181/v1/data/authz/simple/allowSimple \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {
      "user": "alice",
      "document": "architecture-design.pdf",
      "relation": "view"
    }
  }' | jq
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
- The server extracts the client IP from request headers or socket information.
- For each request, it maps the HTTP method to a Keto relation:
  - `GET` → `view`
  - `POST` → `edit`
  - `DELETE` → `delete`
  - `POST /share` → `share`
- It calls OPA's REST API (`/v1/data/authz/approval/approval_or_not`) with input `{ user, document, relation, client_ip }`.
- The **Approval Groups Policy** executes:
  1. For share actions: Checks ShareApprovers group membership via Keto
  2. For all actions: Checks permissions via Keto's `/relation-tuples/check` endpoint
  3. Returns decision with obligations if denied
- The result flows back: Keto → OPA → REST API → Client.

**Current Configuration**: The server is configured to use the **Approval Groups Policy** (`authz.approval`). To use a different policy, update the `OPA_URL` in `server.js`:
- Approval Groups: `http://localhost:8181/v1/data/authz/approval/approval_or_not`
- VPN Policy: `http://localhost:8181/v1/data/authz/vpn/decision`
- Simple Policy: `http://localhost:8181/v1/data/authz/simple/allowSimple`

Response Format

Success (allowed):
```json
{
  "allowed": true,
  "action": "view",
  "document": "architecture-design.pdf",
  "user": "alice",
  "client_ip": "::1"
}
```

Denied (with obligations):
```json
{
  "allowed": false,
  "action": "share",
  "document": "architecture-design.pdf",
  "user": "alice",
  "client_ip": "::1",
  "error": "Permission denied - cannot share this document",
  "obligations": [
    {
      "type": "needs_share_approver_approval",
      "approvers": ["diana", "securityPerson1", "securityPerson2", "securityPerson3"]
    }
  ],
  "message": "Share action requires approval from ShareApprovers group members: diana, securityPerson1, securityPerson2, securityPerson3"
}
```

Denied (no permissions):
```json
{
  "allowed": false,
  "action": "edit",
  "document": "architecture-design.pdf",
  "user": "charlie",
  "client_ip": "::1",
  "error": "Permission denied",
  "message": "Insufficient permissions"
}
```

Notes

**OPA & Keto Integration**:
- The policies use `host.docker.internal` as the Keto host so that OPA (when run in Docker) can reach the Keto service on the host. If you run everything on the host, the policy will work as-is since it falls back to localhost.
- OPA makes HTTP calls to Keto's REST API to check permissions and query group memberships.

**ShareApprovers Group**:
- A special group defined in Keto that controls who can approve share actions
- Members: diana, securityPerson1, securityPerson2, securityPerson3
- Users in this group can share any document regardless of Keto permissions
- The approval policy dynamically fetches the member list from Keto

**Obligation System**:
- Obligations are structured responses that provide actionable feedback when access is denied
- The `needs_share_approver_approval` obligation includes the list of approvers who can grant access
- Obligations can be used to implement approval workflows or audit logs

**Security & JWT**:
- For production, verify and validate JWTs (signature and issuer). This example only decodes the token for simplicity.
- The server returns HTTP 403 for denied permissions and HTTP 401 for missing/invalid tokens.

**Switching Policies**:
- All three policies are loaded simultaneously in different package namespaces
- Change the `OPA_URL` environment variable in `server.js` to switch between policies
- You can also query policies directly via their respective OPA endpoints
