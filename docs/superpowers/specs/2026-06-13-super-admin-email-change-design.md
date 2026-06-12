# Super Admin Email Change

## Goal

Change the seeded and currently running platform super administrator email from
`super.admin@example.com` to `pardepaardtestemail1@gmail.com`.

## Scope

The existing super administrator keeps the same:

- Auth user ID: `8f3e44c2-0fb6-4f12-9d5b-8c1a0c72b001`
- Username: `super.admin`
- Password hash
- Company ID
- Roles and permissions
- User profile data

Only the email address changes.

## Seed Data

Update the auth-service seed user email and the user-service profile email.
Update the user-service seed's duplicate-detection predicate to use the new
email. Existing clean-slate and auth seed tests must assert the new address and
reject the old address.

## Running Databases

Update the row with the fixed super administrator UUID in both PostgreSQL
databases. Each database update runs transactionally and verifies that exactly
one matching row exists before or after the update.

The auth database is authoritative for login identity. The user-service
database must use the same email so cross-service account data remains
consistent.

## Verification

- Auth seed tests pass.
- Frontend clean-slate seed tests pass.
- Both running databases contain the new email for the fixed UUID.
- Neither running database contains the old email for that UUID.
- No username, role, password, company, or profile fields are modified.
