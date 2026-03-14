import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Permission, Role, hasPermission, hasAnyPermission, ROLE_PERMISSIONS } from '../config/permissions';

export function authorize(...permissions: Permission[]): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ success: false, error: 'Unauthorized: not authenticated' });
        }
        const role = user.role as Role;
        if (!role) {
            return res.status(403).json({ success: false, error: 'Forbidden: user has no role assigned' });
        }
        if (!hasAnyPermission(role, permissions)) {
            return res.status(403).json({
                success: false,
                error: `Forbidden: role '${role}' does not have required permission`,
                required: permissions,
                yourRole: role,
            });
        }
        next();
    };
}

export function requireRole(...roles: Role[]): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ success: false, error: 'Unauthorized: not authenticated' });
        }
        const role = user.role as Role;
        if (!roles.includes(role)) {
            return res.status(403).json({
                success: false,
                error: `Forbidden: requires one of [${roles.join(', ')}]`,
                yourRole: role,
            });
        }
        next();
    };
}

export function isSelfOrAuthorized(permission: Permission): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({ success: false, error: 'Unauthorized: not authenticated' });
        }
        const paramId   = req.params.id || req.params.userId;
        const isSelf    = paramId && paramId === user.id;
        const isAllowed = hasPermission(user.role as Role, permission);
        if (!isSelf && !isAllowed) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: you can only access your own resources',
                yourRole: user.role,
            });
        }
        next();
    };
}

export const attachPermissions: RequestHandler = (req, res, next) => {
    const user = (req as any).user;
    if (user?.role) {
        (req as any).user.permissions = ROLE_PERMISSIONS[user.role as Role] || [];
    }
    next();
};
