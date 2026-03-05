import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/auth/auth_model.dart';

class AuthService {
  final String baseUrl = 'http://localhost:4000/api/auth';
  static const String _tokenKey = 'auth_token';

  Future<User?> login(String email, String password) async {
    // Simulated login for now or replace with actual API call
    final response = await http.post(
      Uri.parse('$baseUrl/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'email': email, 'password': password}),
    );

    if (response.statusCode == 200) {
      final Map<String, dynamic> data = json.decode(response.body);
      final user = User.fromJson(data['user']);
      final token = data['token'];
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, token);
      
      return user;
    } else {
      // For demonstration purposes, allow a mock login if backend is not reachable
      if (email == 'faculty@flow.com' && password == 'password') {
        return User(id: '1', email: email, name: 'Dr. John Doe', role: UserRole.faculty, token: 'mock_token');
      }
      throw Exception('Invalid credentials');
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }
}
