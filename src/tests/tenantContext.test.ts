import test from "node:test"
import assert from "node:assert/strict"
import {
  requireTenantId,
  assertTenantMatches,
  tenantHeaderGuard,
  TenantHeaderError
} from "../middleware/tenantContext"

// --- requireTenantId: empty/missing is a rejection --------------------------

test("requireTenantId accepts a non-empty header and trims it", () => {
  assert.equal(requireTenantId("TENANT-APOLLO"), "TENANT-APOLLO")
  assert.equal(requireTenantId("  TENANT-APOLLO  "), "TENANT-APOLLO")
  assert.equal(requireTenantId(["TENANT-APOLLO"]), "TENANT-APOLLO")
})

test("requireTenantId rejects missing header", () => {
  assert.throws(() => requireTenantId(undefined), TenantHeaderError)
})

test("requireTenantId rejects EMPTY string (the Part A gap) and whitespace", () => {
  assert.throws(() => requireTenantId(""), TenantHeaderError)
  assert.throws(() => requireTenantId("   "), TenantHeaderError)
})

// --- tenantHeaderGuard: empty X-Tenant-Id -> 401, does NOT call next --------

function fakeRes() {
  return {
    statusCode: 0 as number,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    }
  }
}

test("guard returns 401 and does not proceed when X-Tenant-Id is empty", () => {
  const req: any = { headers: { "x-tenant-id": "" } }
  const res = fakeRes()
  let nextCalled = false
  tenantHeaderGuard(req as any, res as any, () => {
    nextCalled = true
  })
  assert.equal(res.statusCode, 401)
  assert.equal(nextCalled, false)
  assert.equal(req.tenantId, undefined)
})

test("guard returns 401 when X-Tenant-Id is absent", () => {
  const req: any = { headers: {} }
  const res = fakeRes()
  let nextCalled = false
  tenantHeaderGuard(req as any, res as any, () => {
    nextCalled = true
  })
  assert.equal(res.statusCode, 401)
  assert.equal(nextCalled, false)
})

test("guard proceeds and sets req.tenantId when X-Tenant-Id is present", () => {
  const req: any = { headers: { "x-tenant-id": "TENANT-APOLLO" } }
  const res = fakeRes()
  let nextCalled = false
  tenantHeaderGuard(req as any, res as any, () => {
    nextCalled = true
  })
  assert.equal(nextCalled, true)
  assert.equal(req.tenantId, "TENANT-APOLLO")
  assert.equal(res.statusCode, 0)
})

// --- assertTenantMatches: cross-tenant access is forbidden ------------------

test("assertTenantMatches passes when tenants are equal", () => {
  assert.doesNotThrow(() => assertTenantMatches("TENANT-APOLLO", "TENANT-APOLLO"))
})

test("assertTenantMatches throws forbidden on cross-tenant or empty resource tenant", () => {
  assert.throws(() => assertTenantMatches("TENANT-MANIPAL", "TENANT-APOLLO"), /forbidden/)
  assert.throws(() => assertTenantMatches(null, "TENANT-APOLLO"), /forbidden/)
  assert.throws(() => assertTenantMatches("", "TENANT-APOLLO"), /forbidden/)
})
