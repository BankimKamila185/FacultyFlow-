import { authTypeDefs } from './auth';
import { taskTypeDefs } from './tasks';

export const typeDefs = `#graphql
  ${authTypeDefs}
  ${taskTypeDefs}

  extend type Query {
    healthCheck: String!
  }
`;
