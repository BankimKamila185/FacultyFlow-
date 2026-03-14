export const taskTypeDefs = `#graphql
  type Task {
    id: ID!
    title: String!
    description: String
    status: String!
    deadline: String
    startDate: String
    taskCompletionDate: String
    responsibleTeam: String
    workflowId: String
    assignedToId: String!
    createdById: String!
    createdAt: String!
    updatedAt: String!
    assignedTo: User
    createdBy: User
  }

  extend type Query {
    tasks(status: String, assignedToId: String): [Task!]!
    task(id: ID!): Task
  }

  extend type Mutation {
    createTask(
      title: String!
      description: String
      deadline: String
      assignedToId: String!
      workflowId: String
    ): Task!
    
    updateTaskStatus(id: ID!, status: String!): Task!
    assignTask(id: ID!, assignedToId: String!): Task!
    deleteTask(id: ID!): Boolean!
  }
`;
