/**
 * Ory Keto Permission Tests
 * Tests various permission scenarios using the Keto REST API
 */

const KETO_URL = 'http://localhost:4466';

/**
 * Check if a subject has a specific permission
 * @param {string} namespace - The namespace (e.g., 'Document', 'Folder')
 * @param {string} object - The object ID
 * @param {string} relation - The relation to check (e.g., 'view', 'edit')
 * @param {string} subjectNamespace - The subject's namespace (e.g., 'User')
 * @param {string} subjectObject - The subject's ID
 * @returns {Promise<boolean>} Whether the permission is allowed
 */
async function checkPermission(namespace, object, relation, subjectNamespace, subjectObject) {
  const url = `${KETO_URL}/relation-tuples/check`;
  
  const body = {
    namespace,
    object,
    relation,
    subject_set: {
      namespace: subjectNamespace,
      object: subjectObject
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return data.allowed === true;
  } catch (error) {
    console.error(`Error checking permission:`, error.message);
    throw error;
  }
}

/**
 * Run a permission test and display the result
 */
async function runTest(description, namespace, object, relation, subject, expectedResult = null, subjectNamespace = 'User') {
  const result = await checkPermission(namespace, object, relation, subjectNamespace, subject);
  const status = result ? '✅ ALLOWED' : '❌ DENIED';
  const expectedStr = expectedResult !== null 
    ? (result === expectedResult ? '' : ` (Expected: ${expectedResult ? 'ALLOWED' : 'DENIED'})`)
    : '';
  
  console.log(`${status}${expectedStr} - ${description}`);
  console.log(`  ${subjectNamespace}:${subject} -> ${relation} -> ${namespace}:${object}`);
  console.log();
  
  return result;
}

/**
 * Run a permission test for a Group subject
 */
async function runGroupTest(description, namespace, object, relation, group, expectedResult = null) {
  return runTest(description, namespace, object, relation, group, expectedResult, 'Group');
}

/**
 * Main test suite
 */
async function runTests() {
  console.log('='.repeat(70));
  console.log('Ory Keto Permission Tests');
  console.log('='.repeat(70));
  console.log();

  try {
    // Test 1: Check if alice can view a document in engineering folder
    await runTest(
      'Alice views architecture design document',
      'Document',
      'architecture-design.pdf',
      'view',
      'alice',
      true
    );

    // Test 2: Check if bob can edit a document he owns
    await runTest(
      'Bob edits API specification (document he owns)',
      'Document',
      'api-specification.md',
      'edit',
      'bob',
      true
    );

    // Test 3: Check if charlie can view engineering docs (should be denied)
    await runTest(
      'Charlie views engineering folder (should be denied)',
      'Folder',
      'engineering-docs',
      'view',
      'charlie',
      false
    );

    // Test 4: Check if diana (executive) can view anything
    await runTest(
      'Diana (executive) views architecture design document',
      'Document',
      'architecture-design.pdf',
      'view',
      'diana',
      true
    );

    // Group Permission Tests
    console.log('-'.repeat(70));
    console.log('GROUP PERMISSION TESTS');
    console.log('Note: These tests check permissions granted through group membership \n\t NOT Permissions granted directly to a Group');
    console.log('-'.repeat(70));
    console.log();

    // Test 5: Bob can edit engineering-docs through engineering group membership
    await runTest(
      'Bob edits engineering folder (via engineering group)',
      'Folder',
      'engineering-docs',
      'edit',
      'bob',
      true
    );

    // Test 6: Alice can view engineering folder through group membership
    await runTest(
      'Alice views engineering folder (via engineering group)',
      'Folder',
      'engineering-docs',
      'view',
      'alice',
      true
    );

    // Test 7: Charlie can edit marketing-docs through marketing group membership
    await runTest(
      'Charlie edits marketing folder (via marketing group)',
      'Folder',
      'marketing-docs',
      'edit',
      'charlie',
      true
    );

    // Test 8: Diana can view company-root through executives group membership
    await runTest(
      'Diana views company root (via executives group)',
      'Folder',
      'company-root',
      'view',
      'diana',
      true
    );

    // Test 9: Charlie cannot edit engineering docs (not in engineering group)
    await runTest(
      'Charlie edits engineering folder (denied - wrong group)',
      'Folder',
      'engineering-docs',
      'edit',
      'charlie',
      false
    );

    // Test 10: Alice can view marketing docs through inherited parent permissions
    await runTest(
      'Alice views marketing folder (denied - no access)',
      'Folder',
      'marketing-docs',
      'view',
      'alice',
      false
    );

    // Group-as-Subject Tests
    console.log('-'.repeat(70));
    console.log('GROUP AS SUBJECT TESTS');
    console.log('Note: Groups can now have direct permissions \n These will all be DENIED if running the PERMISSIONS_TYPE=user-only-permission example');
    console.log('-'.repeat(70));
    console.log();

    // Test 11: Engineering group has direct edit permission on engineering-docs
    await runGroupTest(
      'Engineering group entity edits engineering folder (direct permission)',
      'Folder',
      'engineering-docs',
      'edit',
      'engineering',
      true
    );

    // Test 12: Engineering group has direct view permission on engineering-docs
    await runGroupTest(
      'Engineering group entity views engineering folder (direct permission)',
      'Folder',
      'engineering-docs',
      'view',
      'engineering',
      true
    );

    // Test 13: Marketing group has direct view permission on marketing-docs
    await runGroupTest(
      'Marketing group entity views marketing folder (direct permission)',
      'Folder',
      'marketing-docs',
      'view',
      'marketing',
      true
    );

    // Test 14: Marketing group has direct edit permission on marketing-docs
    await runGroupTest(
      'Marketing group entity edits marketing folder (direct permission)',
      'Folder',
      'marketing-docs',
      'edit',
      'marketing',
      true
    );

    // Test 15: Engineering group does not have permission on marketing docs
    await runGroupTest(
      'Engineering group entity edits marketing folder (denied - no permission)',
      'Folder',
      'marketing-docs',
      'edit',
      'engineering',
      false
    );

    // Test 16: Marketing group does not have permission on engineering docs
    await runGroupTest(
      'Marketing group entity views engineering folder (denied - no permission)',
      'Folder',
      'engineering-docs',
      'view',
      'marketing',
      false
    );

    // Test 17: Engineering group has direct view permission on documents
    await runGroupTest(
      'Engineering group entity views architecture document (direct permission)',
      'Document',
      'architecture-design.pdf',
      'view',
      'engineering',
      true
    );

    console.log('='.repeat(70));
    console.log('All tests completed successfully!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('Test suite failed:', error.message);
    console.error('Make sure Keto is running: docker compose up -d');
    process.exit(1);
  }
}

// Run tests
runTests();
