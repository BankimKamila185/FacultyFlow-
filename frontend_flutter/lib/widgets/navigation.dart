import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/services/navigation_service.dart';
import '../core/theme/app_colors.dart';

class SideNavigation extends ConsumerWidget {
  const SideNavigation({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedIndex = ref.watch(navigationProvider);

    return Container(
      width: 250,
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        border: Border(
          right: BorderSide(
            color: Theme.of(context).dividerColor.withOpacity(0.1),
          ),
        ),
      ),
      child: Column(
        children: [
          const SizedBox(height: 24),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              children: [
                Icon(Icons.auto_graph, size: 32),
                SizedBox(width: 12),
                Text(
                  'FacultyFlow',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          Expanded(
            child: ListView.builder(
              itemCount: navigationItems.length,
              itemBuilder: (context, index) {
                final item = navigationItems[index];
                final isSelected = selectedIndex == index;

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  child: ListTile(
                    selected: isSelected,
                    leading: Icon(item.icon),
                    title: Text(item.title),
                    onTap: () => ref.read(navigationProvider.notifier).state = index,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    selectedTileColor: Theme.of(context).brightness == Brightness.light
                        ? AppColors.lightGray
                        : Colors.white.withOpacity(0.1),
                    selectedColor: Theme.of(context).brightness == Brightness.light
                        ? AppColors.black
                        : AppColors.white,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class BottomNavigation extends ConsumerWidget {
  const BottomNavigation({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedIndex = ref.watch(navigationProvider);

    return NavigationBar(
      selectedIndex: selectedIndex,
      onDestinationSelected: (index) =>
          ref.read(navigationProvider.notifier).state = index,
      destinations: navigationItems
          .map((item) => NavigationDestination(
                icon: Icon(item.icon),
                label: item.title,
              ))
          .toList(),
    );
  }
}
