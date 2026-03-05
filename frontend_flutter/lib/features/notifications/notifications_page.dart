import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'notification_provider.dart';
import '../../core/theme/app_colors.dart';

class NotificationsPage extends ConsumerWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () => ref.read(notificationsProvider.notifier).clearAll(),
            child: const Text('Clear All'),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: notifications.isEmpty
          ? const Center(child: Text('No notifications yet.'))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: notifications.length,
              separatorBuilder: (context, index) => const Divider(),
              itemBuilder: (context, index) {
                final notification = notifications[index];
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: notification.isRead 
                      ? AppColors.lightGray 
                      : AppColors.black.withOpacity(0.1),
                    child: Icon(
                      Icons.notifications_outlined,
                      color: notification.isRead ? AppColors.mediumGray : AppColors.black,
                      size: 20,
                    ),
                  ),
                  title: Text(
                    notification.title,
                    style: TextStyle(
                      fontWeight: notification.isRead ? FontWeight.normal : FontWeight.bold,
                    ),
                  ),
                  subtitle: Text(notification.message),
                  trailing: Text(
                    DateFormat('hh:mm a').format(notification.timestamp),
                    style: const TextStyle(fontSize: 10, color: AppColors.mediumGray),
                  ),
                  onTap: () => ref.read(notificationsProvider.notifier).markAsRead(notification.id),
                );
              },
            ),
    );
  }
}
