// Single source of truth for profiles.role/profiles.status values — never
// compare against the raw "admin"/"active"/etc. string literals directly,
// import these instead so a typo is a type error, not a silent no-op.
export const USER_ROLE = { ADMIN: "admin", OFFICER: "officer" } as const;
export const PROFILE_STATUS = { PENDING: "pending", ACTIVE: "active", DISABLED: "disabled" } as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];
export type ProfileStatus = (typeof PROFILE_STATUS)[keyof typeof PROFILE_STATUS];
