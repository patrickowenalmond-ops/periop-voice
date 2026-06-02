/**
 * Augments Clerk's session claims type with the custom claims this app's JWT
 * template exposes. This is the documented Clerk pattern for typing custom
 * claims and has no runtime effect — it only informs the type checker so
 * `auth.sessionClaims.userId`, `.email`, etc. resolve correctly.
 */
declare global {
  interface CustomJwtSessionClaims {
    userId?: string;
    email?: string;
    given_name?: string;
    family_name?: string;
    firstName?: string;
    lastName?: string;
  }
}

export {};
