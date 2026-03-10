import { verifyToken } from '../utils/jwt';
import { prisma } from '../models/prisma';

export interface AuthenticatedRequest extends Request {
    user?: any;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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
        const decoded = verifyToken(token);
        
        // Perspective Switching: Check if this user has a dev context set in DB
        const dbUser = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { devModeContext: true, id: true, email: true, name: true, role: true }
        });

        if (dbUser?.devModeContext) {
            try {
                const context = JSON.parse(dbUser.devModeContext);
                if (context && context.email) {
                    // Overwrite the request user identity with the mocked faculty member
                    // We also need to find the actual database ID for the mocked email to ensure filters work
                    const mockedUser = await prisma.user.findUnique({
                        where: { email: context.email.toLowerCase() }
                    });

                    req.user = {
                        ...decoded,
                        id: mockedUser?.id || decoded.id, // Fallback to current ID if mocked user doesn't exist in DB yet
                        email: context.email,
                        name: context.name || context.email.split('@')[0],
                        isMocked: true,
                        realUserId: decoded.id
                    };
                    return next();
                }
            } catch (e) {
                console.error("Failed to parse devModeContext", e);
            }
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
}
