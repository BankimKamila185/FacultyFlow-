import 'package:flutter/material.dart';
import '../../widgets/stat_card.dart';
import '../../core/theme/app_colors.dart';
import '../../layouts/adaptive_layout.dart';
import 'package:fl_chart/fl_chart.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDesktop = AdaptiveLayout.isDesktop(context);
    final isTablet = AdaptiveLayout.isTablet(context);

    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Dashboard',
              style: Theme.of(context).textTheme.displayLarge?.copyWith(fontSize: 32),
            ),
            const SizedBox(height: 8),
            Text(
              'Welcome back, Dr. Smith. Here is what is happening today.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 32),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: isDesktop ? 4 : (isTablet ? 2 : 1),
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 1.5,
              children: [
                const StatCard(
                  title: 'Pending Tasks',
                  value: '12',
                  icon: Icons.assignment_outlined,
                  trend: '+2 from yesterday',
                ),
                const StatCard(
                  title: 'Completed Tasks',
                  value: '45',
                  icon: Icons.task_alt_outlined,
                  color: AppColors.success,
                  trend: '+5 this week',
                ),
                const StatCard(
                  title: 'Delayed Tasks',
                  value: '3',
                  icon: Icons.warning_amber_outlined,
                  color: AppColors.error,
                  trend: '-1 from last week',
                ),
                const StatCard(
                  title: 'Workflow Progress',
                  value: '78%',
                  icon: Icons.trending_up_outlined,
                  color: AppColors.info,
                  trend: '+12%',
                ),
              ],
            ),
            const SizedBox(height: 32),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 2,
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Faculty Productivity',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 24),
                          SizedBox(
                            height: 300,
                            child: BarChart(
                              BarChartData(
                                alignment: BarChartAlignment.spaceAround,
                                maxY: 100,
                                barGroups: [
                                  _makeGroupData(0, 45),
                                  _makeGroupData(1, 75),
                                  _makeGroupData(2, 60),
                                  _makeGroupData(3, 90),
                                  _makeGroupData(4, 55),
                                ],
                                titlesData: FlTitlesData(
                                  show: true,
                                  bottomTitles: AxisTitles(
                                    sideTitles: SideTitles(
                                      showTitles: true,
                                      getTitlesWidget: (value, meta) {
                                        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
                                        return Text(days[value.toInt()]);
                                      },
                                    ),
                                  ),
                                  leftTitles: const AxisTitles(
                                    sideTitles: SideTitles(showTitles: false),
                                  ),
                                  topTitles: const AxisTitles(
                                    sideTitles: SideTitles(showTitles: false),
                                  ),
                                  rightTitles: const AxisTitles(
                                    sideTitles: SideTitles(showTitles: false),
                                  ),
                                ),
                                borderData: FlBorderData(show: false),
                                gridData: const FlGridData(show: false),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                if (isDesktop) const SizedBox(width: 24),
                if (isDesktop)
                  Expanded(
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Recent Notifications',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 16),
                            _buildNotificationItem(
                              'Task Assigned',
                              'New Exam Proposal task assigned to you.',
                              '10m ago',
                              Icons.assignment_outlined,
                            ),
                            _buildNotificationItem(
                              'Email Sent',
                              'Approval request sent to HOD.',
                              '1h ago',
                              Icons.email_outlined,
                            ),
                            _buildNotificationItem(
                              'Approval Received',
                              'Exam Report approved by Admin.',
                              '3h ago',
                              Icons.check_circle_outline,
                            ),
                            const SizedBox(height: 16),
                            TextButton(
                              onPressed: () {},
                              child: const Text('View all notifications'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 32),
            const Text(
              'Quick Actions (Stitch MCP)',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                _buildActionButton(
                  context,
                  'Generate Report',
                  Icons.auto_awesome,
                  () {},
                ),
                _buildActionButton(
                  context,
                  'Analyze Data',
                  Icons.analytics_outlined,
                  () {},
                ),
                _buildActionButton(
                  context,
                  'Auto-Tasks',
                  Icons.bolt,
                  () {},
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton(BuildContext context, String label, IconData icon, VoidCallback onTap) {
    return ElevatedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 18),
      label: Text(label),
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(180, 48),
      ),
    );
  }

  BarChartGroupData _makeGroupData(int x, double y) {
    return BarChartGroupData(
      x: x,
      barRods: [
        BarChartRodData(
          toY: y,
          color: AppColors.black,
          width: 16,
          borderRadius: BorderRadius.circular(4),
        ),
      ],
    );
  }

  Widget _buildNotificationItem(String title, String subtitle, String time, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.lightGray,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 18, color: AppColors.black),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(color: AppColors.mediumGray, fontSize: 12),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Text(
            time,
            style: const TextStyle(color: AppColors.mediumGray, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
