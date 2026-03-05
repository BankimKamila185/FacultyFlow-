import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'task_model.dart';
import 'task_service.dart';

final taskServiceProvider = Provider((ref) => TaskService());

final tasksProvider = StateNotifierProvider<TasksNotifier, AsyncValue<List<Task>>>((ref) {
  return TasksNotifier(ref.read(taskServiceProvider));
});

class TasksNotifier extends StateNotifier<AsyncValue<List<Task>>> {
  final TaskService _service;

  TasksNotifier(this._service) : super(const AsyncValue.loading()) {
    loadTasks();
  }

  Future<void> loadTasks() async {
    state = const AsyncValue.loading();
    try {
      final tasks = await _service.getTasksRest();
      state = AsyncValue.data(tasks);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> addTask(String title, String description) async {
    try {
      final newTask = await _service.createTaskRest(title, description);
      state.whenData((tasks) {
        state = AsyncValue.data([...tasks, newTask]);
      });
    } catch (e, stack) {
      // Handle error
    }
  }
}
