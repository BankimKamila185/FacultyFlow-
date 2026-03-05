import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_provider.dart';
import 'layouts/adaptive_layout.dart';
import 'widgets/navigation.dart';
import 'features/dashboard/dashboard_page.dart';
import 'features/tasks/tasks_page.dart';
import 'features/workflow/workflow_page.dart';
import 'features/reports/document_generator_page.dart';
import 'features/notifications/notifications_page.dart';
import 'features/auth/login_page.dart';
import 'features/auth/auth_provider.dart';
import 'core/services/navigation_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: FacultyFlowApp(),
    ),
  );
}

class FacultyFlowApp extends ConsumerWidget {
  const FacultyFlowApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeProvider);
    final authState = ref.watch(authProvider);

    return MaterialApp(
      title: 'FacultyFlow',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      home: authState.user == null ? const LoginPage() : const MainShell(),
    );
  }
}

class MainShell extends ConsumerWidget {
  const MainShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedIndex = ref.watch(navigationProvider);

    return AdaptiveLayout(
      appBar: AppBar(
        title: const Text('FacultyFlow'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
          Consumer(
            builder: (context, ref, child) {
              return IconButton(
                icon: Icon(
                  ref.watch(themeProvider) == ThemeMode.light
                      ? Icons.dark_mode_outlined
                      : Icons.light_mode_outlined,
                ),
                onPressed: () => ref.read(themeProvider.notifier).toggleTheme(),
              );
            },
          ),
          const SizedBox(width: 8),
          _buildUserAvatar(ref),
          const SizedBox(width: 16),
        ],
      ),
      sideBar: const SideNavigation(),
      bottomNav: const BottomNavigation(),
      body: _buildPage(selectedIndex),
    );
  }

  Widget _buildUserAvatar(WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    return PopupMenuButton(
      icon: CircleAvatar(
        radius: 16,
        backgroundImage: user?.email != null 
          ? NetworkImage('https://i.pravatar.cc/150?u=${user!.email}')
          : null,
      ),
      itemBuilder: (context) => [
        PopupMenuItem(
          child: Text(user?.name ?? 'User'),
        ),
        PopupMenuItem(
          onTap: () => ref.read(authProvider.notifier).logout(),
          child: const Text('Logout'),
        ),
      ],
    );
  }

  Widget _buildPage(int index) {
    switch (index) {
      case 0:
        return const DashboardPage();
      case 1:
        return const TasksPage();
      case 2:
        return const WorkflowPage();
      case 3:
        return const DocumentGeneratorPage();
      case 4:
        return const NotificationsPage();
      default:
        return const Center(
          child: Text('Under Construction'),
        );
    }
  }
}
