export type Role = 'FACULTY' | 'HOD' | 'ADMIN';

export type Permission =
    | 'task:read:own'
    | 'task:read:all'
    | 'task:read:department'
    | 'task:update:own'
    | 'task:update:any'
    | 'task:create'
    | 'task:delete'
    | 'task:assign'
    | 'task:nudge'
    | 'user:read:own'
    | 'user:read:all'
    | 'user:read:department'
    | 'user:update:own'
    | 'user:update:any'
    | 'user:role:update'
    | 'analytics:read:own'
    | 'analytics:read:all'
    | 'analytics:read:department'
    | 'sync:trigger'
    | 'report:download'
    | 'workflow:read'
    | 'workflow:manage'
    | 'notification:read:own'
    | 'ai:use'
    | 'ai:suggest'
    | 'inbox:read'
    | 'inbox:sync'
    | 'google:calendar'
    | 'google:drive'
    | 'google:sheets'
    | 'google:forms';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    FACULTY: [
        'task:read:own', 'task:update:own',
        'user:read:own', 'user:update:own',
        'analytics:read:own',
        'report:download',
        'notification:read:own',
        'ai:use',
        'inbox:read', 'inbox:sync',
        'google:calendar', 'google:drive', 'google:sheets', 'google:forms',
        'workflow:read',
    ],
    HOD: [
        'task:read:own', 'task:read:department',
        'task:update:own', 'task:update:any',
        'task:create', 'task:assign', 'task:nudge',
        'user:read:own', 'user:read:department', 'user:update:own',
        'analytics:read:own', 'analytics:read:department',
        'sync:trigger',
        'report:download',
        'workflow:read', 'workflow:manage',
        'notification:read:own',
        'ai:use', 'ai:suggest',
        'inbox:read', 'inbox:sync',
        'google:calendar', 'google:drive', 'google:sheets', 'google:forms',
    ],
    ADMIN: [
        'task:read:own', 'task:read:all', 'task:read:department',
        'task:update:own', 'task:update:any',
        'task:create', 'task:delete', 'task:assign', 'task:nudge',
        'user:read:own', 'user:read:all', 'user:read:department',
        'user:update:own', 'user:update:any', 'user:role:update',
        'analytics:read:own', 'analytics:read:all', 'analytics:read:department',
        'sync:trigger',
        'report:download',
        'workflow:read', 'workflow:manage',
        'notification:read:own',
        'ai:use', 'ai:suggest',
        'inbox:read', 'inbox:sync',
        'google:calendar', 'google:drive', 'google:sheets', 'google:forms',
    ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
    return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
    return permissions.some(p => hasPermission(role, p));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
    return permissions.every(p => hasPermission(role, p));
}
