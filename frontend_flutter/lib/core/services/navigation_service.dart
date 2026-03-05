import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final navigationProvider = StateProvider<int>((ref) => 0);

class NavigationItem {
  final String title;
  final IconData icon;
  final String route;

  const NavigationItem({
    required this.title,
    required this.icon,
    required this.route,
  });
}

const List<NavigationItem> navigationItems = [
  NavigationItem(title: 'Dashboard', icon: Icons.dashboard_outlined, route: '/dashboard'),
  NavigationItem(title: 'Tasks', icon: Icons.task_outlined, route: '/tasks'),
  NavigationItem(title: 'Workflow', icon: Icons.account_tree_outlined, route: '/workflow'),
  NavigationItem(title: 'Reports', icon: Icons.bar_chart_outlined, route: '/reports'),
  NavigationItem(title: 'Notifications', icon: Icons.notifications_outlined, route: '/notifications'),
  NavigationItem(title: 'Settings', icon: Icons.settings_outlined, route: '/settings'),
];
