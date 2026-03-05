export const authTypeDefs = `#graphql
  type User {
    id: ID!
    email: String!
    name: String!
    role: String!
    googleId: String
    createdAt: String!
    updatedAt: String!
  }

  type AuthPayload {
    user: User!
    token: String!
  }

  type Query {
    currentUser: User
  }

  type Mutation {
    login(idToken: String!): AuthPayload!
  }
`;
