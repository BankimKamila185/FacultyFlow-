import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../tasks/task_model.dart';
import '../tasks/task_provider.dart';
import '../../core/theme/app_colors.dart';

class WorkflowPage extends ConsumerWidget {
  const WorkflowPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasksAsync = ref.watch(tasksProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Workflow Board'),
      ),
      body: tasksAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Error: $err')),
        data: (tasks) {
          return SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildKanbanColumn(context, 'Assigned', tasks.where((t) => t.status == TaskStatus.assigned).toList()),
                _buildKanbanColumn(context, 'Proposal Generated', tasks.where((t) => t.status == TaskStatus.proposalGenerated).toList()),
                _buildKanbanColumn(context, 'Email Sent', tasks.where((t) => t.status == TaskStatus.emailSent).toList()),
                _buildKanbanColumn(context, 'Approval Received', tasks.where((t) => t.status == TaskStatus.approvalReceived).toList()),
                _buildKanbanColumn(context, 'Completed', tasks.where((t) => t.status == TaskStatus.completed).toList()),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildKanbanColumn(BuildContext context, String title, List<Task> tasks) {
    return Container(
      width: 300,
      margin: const EdgeInsets.only(right: 16),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.light
            ? AppColors.lightGray.withOpacity(0.5)
            : Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.black.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${tasks.length}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: tasks.length,
              itemBuilder: (context, index) {
                final task = tasks[index];
                return _buildKanbanCard(context, task);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKanbanCard(BuildContext context, Task task) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              task.title,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 8),
            Text(
              task.description,
              style: TextStyle(color: AppColors.mediumGray, fontSize: 12),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const CircleAvatar(
                  radius: 10,
                  backgroundColor: AppColors.lightGray,
                  child: Icon(Icons.person, size: 12, color: AppColors.black),
                ),
                Icon(Icons.more_horiz, size: 16, color: AppColors.mediumGray),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
