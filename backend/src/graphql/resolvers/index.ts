import { authResolvers } from './auth.resolver';

export const resolvers = {
    Query: {
        ...authResolvers.Query,
        healthCheck: () => 'Server is healthy!',
    },
    Mutation: {
        ...authResolvers.Mutation,
    }
};
