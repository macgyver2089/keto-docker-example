import express from 'express'
import fetch from 'node-fetch'
import jwt from 'jsonwebtoken'

const OPA_URL = process.env.OPA_URL || 'http://localhost:8181/v1/data/authz/allow'
const PORT = process.env.PORT || 3000

const app = express()
app.use(express.json())

// Map HTTP methods to Keto relations
const METHOD_TO_RELATION = {
  'GET': 'view',
  'POST': 'edit',
  'DELETE': 'delete'
}

async function checkWithOPA(user, document, relation) {
  const input = { user, document, relation }

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
  return data.result === true
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

  try {
    const allowed = await checkWithOPA(req.user, document, relation)
    
    if (allowed) {
      res.json({ 
        allowed: true, 
        action: relation,
        document,
        user: req.user 
      })
    } else {
      res.status(403).json({ 
        allowed: false, 
        action: relation,
        document,
        user: req.user,
        error: 'Permission denied' 
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

  try {
    const allowed = await checkWithOPA(req.user, document, 'share')
    
    if (allowed) {
      res.json({ 
        allowed: true, 
        action: 'share',
        document,
        user: req.user,
        shareWith: shareWith || 'unspecified'
      })
    } else {
      res.status(403).json({ 
        allowed: false, 
        action: 'share',
        document,
        user: req.user,
        error: 'Permission denied - cannot share this document' 
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
