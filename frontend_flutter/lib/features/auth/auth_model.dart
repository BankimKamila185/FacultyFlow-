enum UserRole {
  faculty,
  hod,
  admin,
  operations,
}

class User {
  final String id;
  final String email;
  final String name;
  final UserRole role;
  final String? token;

  User({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    this.token,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      email: json['email'],
      name: json['name'],
      role: _parseRole(json['role']),
      token: json['token'],
    );
  }

  static UserRole _parseRole(String role) {
    switch (role.toLowerCase()) {
      case 'faculty':
        return UserRole.faculty;
      case 'hod':
        return UserRole.hod;
      case 'admin':
        return UserRole.admin;
      case 'operations':
        return UserRole.operations;
      default:
        return UserRole.faculty;
    }
  }
}
