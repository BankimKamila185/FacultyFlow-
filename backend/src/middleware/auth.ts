import { verifyToken } from '../utils/jwt';
import { FirestoreService } from '../services/FirestoreService';
import { RequestHandler } from 'express';

export interface TokenPayload {
    id: string;
    email: string;
    role: string;
    [key: string]: any;
}

const isFacultyEmail = (email: string) => {
    return email.toLowerCase().endsWith('@itm.edu') || email.toLowerCase().endsWith('@isu.ac.in');
};

export const authenticate: RequestHandler = async (req: any, res, next) => {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.auth_token) {
        token = req.cookies.auth_token;
    }


    if (!token) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const decoded = verifyToken(token) as TokenPayload;
        
        // 1. Try finding by ID
        let dbUser = await FirestoreService.getDoc('users', decoded.id);

        // 2. Fallback to Email if ID doesn't match
        if (!dbUser && decoded.email) {
            console.log(`[Auth] ID mismatch for ${decoded.email}. Attempting email-based fallback.`);
            dbUser = await FirestoreService.findFirst('users', 'email', '==', decoded.email.toLowerCase());
        }

        if (!dbUser) {
            console.error(`[Auth] Fatal: Could not resolve identity for ${decoded.email}`);
            return res.status(401).json({ success: false, error: 'User does not exist in registry' });
        }

        // Perspective Switching: Check if this user has a dev context set in DB
        if (dbUser.devModeContext) {
            try {
                const context = typeof dbUser.devModeContext === 'string' ? JSON.parse(dbUser.devModeContext) : dbUser.devModeContext;
                if (context && context.email) {
                    // Overwrite the request user identity with the mocked faculty member
                    const mockedUser = await FirestoreService.findFirst('users', 'email', '==', context.email.toLowerCase());

                    req.user = {
                        ...decoded,
                        id: mockedUser?.id || dbUser.id,
                        email: context.email.toLowerCase(),
                        name: context.name || context.email.split('@')[0],
                        role: mockedUser?.role || (isFacultyEmail(context.email) ? 'FACULTY' : decoded.role),
                        isMocked: true,
                        realUserId: dbUser.id
                    };
                    console.log(`[Auth] Perspective Switch: ${dbUser.email} -> ${req.user.email} (${req.user.role})`);
                    return next();
                }
            } catch (e) {
                console.error("Failed to parse devModeContext", e);
            }
        }

        // Ensure we use the FRESH dbUser ID, role, and email
        req.user = {
            ...decoded,
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role
        };
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
}
