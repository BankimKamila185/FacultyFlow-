import 'dart:convert';
import 'package:http/http.dart' as http;

class StitchService {
  final String stitchUrl = 'http://localhost:3001/mcp'; // Assuming Stitch MCP bridge address

  Future<Map<String, dynamic>> triggerTool(String toolName, Map<String, dynamic> arguments) async {
    final response = await http.post(
      Uri.parse('$stitchUrl/tools/$toolName'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(arguments),
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to trigger Stitch tool: $toolName');
    }
  }

  Future<void> generateAcademicReport(String departmentId) async {
    await triggerTool('generate_academic_report', {'departmentId': departmentId});
  }

  Future<void> analyzeSpreadsheet(String fileUrl) async {
    await triggerTool('analyze_spreadsheet', {'fileUrl': fileUrl});
  }

  Future<void> autoCreateTasks(String projectDescription) async {
    await triggerTool('create_tasks_from_text', {'text': projectDescription});
  }
}
