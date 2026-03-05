import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/services/socket_service.dart';

class NotificationModel {
  final String id;
  final String title;
  final String message;
  final DateTime timestamp;
  final bool isRead;

  NotificationModel({
    required this.id,
    required this.title,
    required this.message,
    required this.timestamp,
    this.isRead = false,
  });
}

final notificationsProvider = StateNotifierProvider<NotificationNotifier, List<NotificationModel>>((ref) {
  final socketService = ref.read(socketServiceProvider);
  return NotificationNotifier(socketService);
});

class NotificationNotifier extends StateNotifier<List<NotificationModel>> {
  final SocketService _socketService;

  NotificationNotifier(this._socketService) : super([]) {
    _init();
  }

  void _init() {
    _socketService.connect();
    _socketService.onNotification((data) {
      final newNotification = NotificationModel(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        title: data['title'] ?? 'New Notification',
        message: data['message'] ?? '',
        timestamp: DateTime.now(),
      );
      state = [newNotification, ...state];
    });
  }

  void markAsRead(String id) {
    state = [
      for (final n in state)
        if (n.id == id)
          NotificationModel(
            id: n.id,
            title: n.title,
            message: n.message,
            timestamp: n.timestamp,
            isRead: true,
          )
        else
          n,
    ];
  }

  void clearAll() {
    state = [];
  }
}
