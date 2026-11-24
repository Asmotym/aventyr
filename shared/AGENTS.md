# Shared code

Keep this directory browser-safe and independent of `src/` and `server/`. Group contracts and pure calculations by domain: accounts, articles and rooms. Use type-only imports for types. Do not put database records, secrets, Node built-ins or server libraries here.

Check both frontend and backend consumers when changing a contract or calculation. Run the architecture check, relevant tests and both builds. See [backend rules](../docs/guides/backend.md#imports-and-contracts).
