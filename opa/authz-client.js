#!/usr/bin/env node
import fetch from 'node-fetch'

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000'

function generateToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: user })).toString('base64url')
  return `${header}.${payload}.`
}

async function makeRequest(method, document, token, body = null) {
  const url = `${SERVER_URL}/documents/${document}`
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)
  const data = await response.json()
  
  return {
    status: response.status,
    statusText: response.statusText,
    data
  }
}

async function makeShareRequest(document, token, shareWith) {
  const url = `${SERVER_URL}/documents/${document}/share`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ shareWith })
  })
  
  const data = await response.json()
  
  return {
    status: response.status,
    statusText: response.statusText,
    data
  }
}

function printResult(user, action, document, result) {
  const statusEmoji = result.status === 200 ? '✅' : '❌'
  const actionMap = {
    'GET': 'VIEW',
    'POST': 'EDIT',
    'DELETE': 'DELETE',
    'SHARE': 'SHARE'
  }
  
  console.log(`\n${statusEmoji} ${actionMap[action]} | User: ${user} | Document: ${document}`)
  console.log(`Status: ${result.status} ${result.statusText}`)
  console.log('Response:', JSON.stringify(result.data, null, 2))
}

function showUsage() {
  console.log(`
Authorization Client - Test Keto permissions via OPA

Usage:
  node authz-client.js <user> <action> <document> [shareWith]

Arguments:
  user       - User identifier (e.g., alice, bob, charlie, diana)
  action     - HTTP method: GET (view), POST (edit), DELETE (delete), SHARE (share)
  document   - Document name (e.g., architecture-design.pdf)
  shareWith  - (Optional) User to share with (only for SHARE action)

Environment Variables:
  SERVER_URL - REST API base URL (default: http://localhost:3000)

Examples:
  node authz-client.js alice GET architecture-design.pdf
  node authz-client.js bob POST api-specification.md
  node authz-client.js charlie DELETE architecture-design.pdf
  node authz-client.js alice SHARE api-specification.md charlie
  `)
}

async function main() {
  const [user, action, document, shareWith] = process.argv.slice(2)

  if (!user || !action || !document) {
    showUsage()
    process.exit(1)
  }

  const actionUpper = action.toUpperCase()
  const validActions = ['GET', 'POST', 'DELETE', 'SHARE']
  
  if (!validActions.includes(actionUpper)) {
    console.error(`❌ Invalid action: ${action}`)
    console.error(`   Valid actions: ${validActions.join(', ')}`)
    process.exit(1)
  }

  if (actionUpper === 'SHARE' && !shareWith) {
    console.error('❌ SHARE action requires a shareWith argument')
    process.exit(1)
  }

  try {
    const token = generateToken(user)
    console.log(`🔑 Generated JWT for: ${user}`)
    console.log(`🎯 Target: ${actionUpper} /documents/${document}`)
    
    let result
    if (actionUpper === 'SHARE') {
      result = await makeShareRequest(document, token, shareWith)
    } else {
      result = await makeRequest(actionUpper, document, token)
    }
    
    printResult(user, actionUpper, document, result)
    
    // Exit with 0 if allowed, 1 if denied
    process.exit(result.data.allowed ? 0 : 1)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()
