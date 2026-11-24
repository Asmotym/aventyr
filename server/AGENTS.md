# Server work

Read [the backend guide](../docs/guides/backend.md) and the owning feature guide before changing behavior.

Keep HTTP routes thin and feature behavior local. Infrastructure must not import features or application composition. Browser-safe contracts/calculations live in top-level `shared/`; database records and secrets remain server-only. Preserve acyclic runtime imports.

Preserve HTTP/action/WebSocket contracts, permissions, transaction/lock ordering, stored snapshots and migration compatibility. Add regression tests before behavior changes. Check references and Git history before removing code. Run relevant tests and type/build checks; schema, concurrency and socket changes also require isolated MySQL integration coverage. Update the owning documentation with the change.
