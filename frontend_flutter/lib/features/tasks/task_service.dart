import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:graphql_flutter/graphql_flutter.dart';
import 'task_model.dart';

class TaskService {
  final String baseUrl = 'http://localhost:4000/api'; // Adjust to your backend URL
  final String graphqlUrl = 'http://localhost:4000/graphql';

  // REST API Methods
  Future<List<Task>> getTasksRest() async {
    final response = await http.get(Uri.parse('$baseUrl/tasks'));
    if (response.statusCode == 200) {
      List<dynamic> data = json.decode(response.body);
      return data.map((json) => Task.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load tasks');
    }
  }

  Future<Task> createTaskRest(String title, String description) async {
    final response = await http.post(
      Uri.parse('$baseUrl/tasks'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'title': title, 'description': description}),
    );
    if (response.statusCode == 201) {
      return Task.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to create task');
    }
  }

  // GraphQL API Methods
  late GraphQLClient _gqlClient;

  TaskService() {
    final HttpLink httpLink = HttpLink(graphqlUrl);
    _gqlClient = GraphQLClient(
      link: httpLink,
      cache: GraphQLCache(),
    );
  }

  static const String getTasksQuery = r'''
    query GetTasks {
      tasks {
        id
        title
        description
        status
        assignedToId
        createdAt
        deadline
      }
    }
  ''';

  Future<List<Task>> getTasksGql() async {
    final QueryOptions options = QueryOptions(
      document: gql(getTasksQuery),
    );

    final QueryResult result = await _gqlClient.query(options);

    if (result.hasException) {
      throw result.exception!;
    }

    List<dynamic> data = result.data?['tasks'] ?? [];
    return data.map((json) => Task.fromJson(json)).toList();
  }
}
