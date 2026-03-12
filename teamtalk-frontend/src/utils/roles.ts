import type { User, UserRole } from '@/types';

const ROLE_PRIORITY: UserRole[] = ['director', 'admin', 'manager', 'employee'];

export function normalizeRole(value?: string | null): UserRole | null {
  if (!value) return null;
  const role = value.toString().trim().toLowerCase() as UserRole;
  return ROLE_PRIORITY.includes(role) ? role : null;
}

export function normalizeRoles(values?: (string | UserRole)[] | null): UserRole[] {
  const set = new Set<UserRole>();
  (values ?? []).forEach((v) => {
    const r = normalizeRole(v as string);
    if (r) set.add(r);
  });
  if (set.size === 0) set.add('employee');
  return ROLE_PRIORITY.filter((r) => set.has(r));
}

export function getUserRoles(user?: User | null): UserRole[] {
  if (!user) return [];
  if (user.roles && user.roles.length > 0) return normalizeRoles(user.roles);
  const roles: (string | UserRole)[] = [user.role];
  if (user.secondaryRole) roles.push(user.secondaryRole);
  return normalizeRoles(roles);
}

export function getPrimaryRole(roles: UserRole[]): UserRole {
  return normalizeRoles(roles)[0] ?? 'employee';
}

export function hasRole(user: User | null | undefined, role: UserRole): boolean {
  return getUserRoles(user).includes(role);
}
