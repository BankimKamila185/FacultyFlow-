enum TaskStatus {
  assigned,
  proposalGenerated,
  emailSent,
  approvalReceived,
  completed,
}

class Task {
  final String id;
  final String title;
  final String description;
  final TaskStatus status;
  final String? assignedToId;
  final DateTime deadline;
  final DateTime createdAt;

  Task({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    this.assignedToId,
    required this.deadline,
    required this.createdAt,
  });

  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      id: json['id'],
      title: json['title'],
      description: json['description'] ?? '',
      status: _ParseStatus(json['status']),
      assignedToId: json['assignedToId'],
      deadline: DateTime.parse(json['deadline'] ?? DateTime.now().toIso8601String()),
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  static TaskStatus _ParseStatus(String status) {
    switch (status.toLowerCase()) {
      case 'assigned':
        return TaskStatus.assigned;
      case 'proposal_generated':
        return TaskStatus.proposalGenerated;
      case 'email_sent':
        return TaskStatus.emailSent;
      case 'approval_received':
        return TaskStatus.approvalReceived;
      case 'completed':
        return TaskStatus.completed;
      default:
        return TaskStatus.assigned;
    }
  }

  String get statusDisplay {
    switch (status) {
      case TaskStatus.assigned:
        return 'Assigned';
      case TaskStatus.proposalGenerated:
        return 'Proposal Generated';
      case TaskStatus.emailSent:
        return 'Email Sent';
      case TaskStatus.approvalReceived:
        return 'Approval Received';
      case TaskStatus.completed:
        return 'Completed';
    }
  }
}
