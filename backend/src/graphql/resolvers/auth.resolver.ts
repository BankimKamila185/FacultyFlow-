import { AuthService } from '../../services/AuthService';

export const authResolvers = {
    Query: {
        currentUser: async (_: any, __: any, context: any) => {
            if (!context.user) return null;
            return context.prisma.user.findUnique({
                where: { id: context.user.id }
            });
        }
    },
    Mutation: {
        login: async (_: any, { idToken }: { idToken: string }) => {
            const { user, token } = await AuthService.loginWithGoogle(idToken);
            return { user, token };
        }
    }
};
