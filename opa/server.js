import express from 'express'
import fetch from 'node-fetch'
import jwt from 'jsonwebtoken'

const OPA_URL = process.env.OPA_URL || 'http://localhost:8181/v1/data/authz/approval/approval_or_not'
const PORT = process.env.PORT || 3000

const app = express()
app.use(express.json())

// Middleware to extract client IP
function extractClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.socket.remoteAddress ||
         req.connection.remoteAddress
}

// Map HTTP methods to Keto relations
const METHOD_TO_RELATION = {
  'GET': 'view',
  'POST': 'edit',
  'DELETE': 'delete'
}

async function checkWithOPA(user, document, relation, client_ip) {
  const input = { user, document, relation, client_ip }

  const res = await fetch(OPA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OPA request failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data.result // Returns { allow: boolean, obligations: [...] }
}

// Middleware to extract and validate JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  try {
    const decoded = jwt.decode(token)
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const user = decoded.sub || decoded.user || decoded.preferred_username
    if (!user) {
      return res.status(401).json({ error: 'Token missing user identifier' })
    }

    req.user = user
    req.token = token
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Token validation failed', details: err.message })
  }
}

// Generic endpoint handler for view/edit/delete operations
async function handleDocumentRequest(req, res) {
  const { document } = req.params
  const relation = METHOD_TO_RELATION[req.method]
  const client_ip = extractClientIP(req)

  try {
    const decision = await checkWithOPA(req.user, document, relation, client_ip)
    
    if (decision.allow) {
      res.json({ 
        allowed: true, 
        action: relation,
        document,
        user: req.user,
        client_ip 
      })
    } else {
      const obligations = Array.from(decision.obligations || [])
      let message = 'Insufficient permissions'
      
      // Find specific obligation types
      const vpnObligation = obligations.find(o => typeof o === 'string' ? o === 'connect_to_vpn' : o.type === 'connect_to_vpn')
      const approvalObligation = obligations.find(o => typeof o === 'string' ? o === 'needs_share_approver_approval' : o.type === 'needs_share_approver_approval')
      const securityObligation = obligations.find(o => typeof o === 'string' ? o === 'security_team_notification' : o.type === 'security_team_notification')
      
      if (vpnObligation) {
        message = 'You must connect to the VPN (10.x network) to access this resource'
      } else if (approvalObligation) {
        const approvers = approvalObligation.approvers || []
        message = `Share action requires approval from ShareApprovers group members: ${approvers.join(', ')}`
      } else if (securityObligation) {
        message = 'Access denied. This attempt has been reported to the security team.'
      }
      
      res.status(403).json({ 
        allowed: false, 
        action: relation,
        document,
        user: req.user,
        client_ip,
        error: 'Permission denied',
        obligations: obligations.length > 0 ? obligations : undefined,
        message
      })
    }
  } catch (err) {
    res.status(500).json({ error: 'Authorization check failed', details: err.message })
  }
}

// GET /documents/:document - Check view permission
app.get('/documents/:document', authenticateToken, handleDocumentRequest)

// POST /documents/:document - Check edit permission
app.post('/documents/:document', authenticateToken, handleDocumentRequest)

// DELETE /documents/:document - Check delete permission
app.delete('/documents/:document', authenticateToken, handleDocumentRequest)

// POST /documents/:document/share - Check share permission
app.post('/documents/:document/share', authenticateToken, async (req, res) => {
  const { document } = req.params
  const { shareWith } = req.body
  const client_ip = extractClientIP(req)

  try {
    const decision = await checkWithOPA(req.user, document, 'share', client_ip)
    
    if (decision.allow) {
      res.json({ 
        allowed: true, 
        action: 'share',
        document,
        user: req.user,
        client_ip,
        shareWith: shareWith || 'unspecified'
      })
    } else {
      const obligations = Array.from(decision.obligations || [])
      let message = 'Insufficient permissions to share this document'
      
      // Find specific obligation types  
      const vpnObligation = obligations.find(o => typeof o === 'string' ? o === 'connect_to_vpn' : o?.type === 'connect_to_vpn')
      const approvalObligation = obligations.find(o => typeof o === 'string' ? o === 'needs_share_approver_approval' : o?.type === 'needs_share_approver_approval')
      const securityObligation = obligations.find(o => typeof o === 'string' ? o === 'security_team_notification' : o?.type === 'security_team_notification')
      
      if (vpnObligation) {
        message = 'You must connect to the VPN (10.x network) to share this document'
      } else if (approvalObligation) {
        const approvers = approvalObligation?.approvers || []
        if (approvers.length > 0) {
          message = `Share action requires approval from ShareApprovers group members: ${approvers.join(', ')}`
        } else {
          message = 'Share action requires approval from ShareApprovers group members'
        }
      } else if (securityObligation) {
        message = 'Access denied. This attempt has been reported to the security team.'
      }
      
      res.status(403).json({ 
        allowed: false, 
        action: 'share',
        document,
        user: req.user,
        client_ip,
        error: 'Permission denied - cannot share this document',
        obligations: obligations.length > 0 ? obligations : undefined,
        message
      })
    }
  } catch (err) {
    res.status(500).json({ error: 'Authorization check failed', details: err.message })
  }
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'opa-keto-authz-server' })
})

// Start server
app.listen(PORT, () => {
  console.log(`Authorization server listening on port ${PORT}`)
  console.log(`OPA endpoint: ${OPA_URL}`)
  console.log('\nEndpoints:')
  console.log('  GET    /documents/:document       - Check view permission')
  console.log('  POST   /documents/:document       - Check edit permission')
  console.log('  DELETE /documents/:document       - Check delete permission')
  console.log('  POST   /documents/:document/share - Check share permission')
  console.log('  GET    /health                    - Health check')
  console.log('\nAuthorization: Bearer <JWT>')
})

export { checkWithOPA }
