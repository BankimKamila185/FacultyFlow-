import 'dart:convert';
import 'package:http/http.dart' as http;

enum DocumentType {
  examProposal,
  examReport,
}

class DocumentService {
  final String baseUrl = 'http://localhost:4000/api/documents';

  Future<void> generateDocument(DocumentType type, Map<String, dynamic> data) async {
    final endpoint = type == DocumentType.examProposal ? 'generate-proposal' : 'generate-report';
    
    final response = await http.post(
      Uri.parse('$baseUrl/$endpoint'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(data),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Failed to generate document');
    }
  }
}
