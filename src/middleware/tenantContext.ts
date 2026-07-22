import { Request, Response, NextFunction } from "express"

/**
 * The verified tenant is injected by Oathkeeper as X-Tenant-Id, derived from the
 * JWT claim. CRS must trust ONLY this header for tenant identity and never the
 * request body. An empty X-Tenant-Id (the known Part A gap: a valid token whose
 * client has no tenant_id) is a REJECTION -- never a blank match, wildcard, or
 * default.
 */

export class TenantHeaderError extends Error {
  constructor(message = "X-Tenant-Id header is missing or empty") {
    super(message)
    this.name = "TenantHeaderError"
  }
}

/**
 * Returns the trimmed tenant id from the (already verified) X-Tenant-Id header.
 * Throws TenantHeaderError if the header is absent or empty/whitespace.
 */
export function requireTenantId(rawHeader: unknown): string {
  const value = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
  const tenantId = typeof value === "string" ? value.trim() : ""
  if (!tenantId) {
    throw new TenantHeaderError()
  }
  return tenantId
}

/** Express guard: 401 when X-Tenant-Id is missing or empty, else sets req.tenantId. */
export function tenantHeaderGuard(req: Request, res: Response, next: NextFunction) {
  try {
    req.tenantId = requireTenantId(req.headers["x-tenant-id"])
    return next()
  } catch {
    return res.status(401).json({
      message: "X-Tenant-Id header is missing or empty; a verified tenant is required"
    })
  }
}

/**
 * Enforces that a resource actually belongs to the caller's verified tenant.
 * Throws a "forbidden" error (mapped to 403) on any mismatch, closing the
 * cross-tenant gap at CRS itself.
 */
export function assertTenantMatches(resourceTenantId: string | null | undefined, verifiedTenantId: string) {
  if (!resourceTenantId || resourceTenantId !== verifiedTenantId) {
    throw new Error(
      `forbidden: resource tenant '${resourceTenantId ?? ""}' does not match verified tenant '${verifiedTenantId}'`
    )
  }
}
