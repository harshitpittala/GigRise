"""Base middleware structure (PROJECT_SETUP.md §4).

Only request-ID injection is implemented at Phase 0.2. Rate limiting and
RBAC permission checks (also named in PROJECT_SETUP.md §4's description of
this folder) are deferred — both depend on identity/permission concepts
that don't exist until Phase 1+ (AUTHENTICATION.md), and adding them now
would mean writing authentication logic this phase explicitly excludes.
"""
