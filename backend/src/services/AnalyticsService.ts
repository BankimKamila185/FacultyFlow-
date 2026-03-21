import { FirestoreService } from './FirestoreService';

export class AnalyticsService {
    static async getDashboardMetrics(filter?: { userId?: string, email?: string, department?: string }) {
        try {
            const [allTasks, activeWorkflows] = await Promise.all([
                FirestoreService.getCollection('tasks'),
                FirestoreService.count('workflows', [{ field: 'status', operator: '==', value: 'ACTIVE' }]),
            ]);

            const tasks = allTasks as any[];
            let filteredTasks = tasks;

            if (filter?.userId || filter?.email) {
                const userId = filter.userId;
                const userEmail = filter.email?.toLowerCase();

                // Fetch task ids where the user is listed in taskResponsibles
                const myResponsibles = userEmail 
                    ? await FirestoreService.query('taskResponsibles', [{ field: 'email', operator: '==', value: userEmail }])
                    : [];
                const taskIdsFromResponsibles = myResponsibles.map((tr: any) => tr.taskId);

                filteredTasks = tasks.filter(t => 
                    t.assignedToId === userId || 
                    (userEmail && t.assignedToEmail?.toLowerCase() === userEmail) ||
                    taskIdsFromResponsibles.includes(t.id)
                );
            } else if (filter?.department) {
                // Determine which emails belong to this department
                const departments = await FirestoreService.getCollection('departments') as any[];
                const department = departments.find(d => d.name === filter.department);
                
                if (department) {
                    const deptEmails = (department.emails || '').split(',').map((e: string) => e.trim().toLowerCase());
                    filteredTasks = tasks.filter(t => {
                        const assignedEmail = t.assignedToEmail?.toLowerCase();
                        const responsibleEmail = t.responsibleEmail?.toLowerCase();
                        return deptEmails.includes(assignedEmail) || deptEmails.includes(responsibleEmail);
                    });
                }
            }

            const now = new Date();
            const getWeekWindow = (d: Date) => {
                const now = new Date(d);
                const day = now.getDay();
                const monday = new Date(now);
                monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
                monday.setHours(0, 0, 0, 0);

                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                sunday.setHours(23, 59, 59, 999);
                return { monday, sunday };
            };
            const { monday, sunday } = getWeekWindow(now);

            // Visibility: ALL PENDING/OVERDUE up to Sunday (Global Backlog)
            filteredTasks = filteredTasks.filter(t => {
                const deadline = t.deadline?.toDate ? t.deadline.toDate() : (t.deadline ? new Date(t.deadline) : null);
                return deadline && deadline <= sunday;
            });
            const counts = { pending: 0, inProgress: 0, inReview: 0, completed: 0, overdue: 0 };
            
            for (const t of filteredTasks) {
                const status = (t.status || '').toUpperCase();
                const deadline = t.deadline?.toDate ? t.deadline.toDate() : (t.deadline ? new Date(t.deadline) : null);
                const isOverdue = status !== 'COMPLETED' && deadline && deadline < now;

                if (isOverdue) {
                    counts.overdue++;
                } else {
                    switch (status) {
                        case 'PENDING':     
                            counts.pending++;
                            break;
                        case 'STARTED':
                        case 'IN_PROGRESS': 
                            counts.inProgress++;  
                            break;
                        case 'IN_REVIEW':   
                            counts.inReview++;    
                            break;
                        case 'COMPLETED':   
                            counts.completed++;   
                            break;
                        case 'OVERDUE':
                            counts.overdue++;
                            break;
                        default:
                            // Deep fix: If any other status exists and not COMPLETED/OVERDUE, count as pending
                            if (status) counts.pending++;
                            break;
                    }
                }
            }

            return {
                tasks: {
                    total: counts.pending + counts.inProgress + counts.inReview + counts.completed + counts.overdue,
                    ...counts,
                    delayed: counts.overdue,
                },
                workflows: { active: activeWorkflows },
            };
        } catch (error) {
            console.error('[AnalyticsService] Error fetching metrics:', error);
            return {
                tasks: { total: 0, pending: 0, inProgress: 0, inReview: 0, completed: 0, overdue: 0, delayed: 0 },
                workflows: { active: 0 },
            };
        }
    }

    static async getFacultyProductivity(filter?: { userId?: string }) {
        const userConstraints: any[] = [];
        if (filter?.userId) {
            userConstraints.push({ field: 'id', operator: '==', value: filter.userId });
        } else {
            userConstraints.push({ field: 'role', operator: '==', value: 'FACULTY' });
        }

        const [users, allTasks] = await Promise.all([
            FirestoreService.query('users', userConstraints),
            FirestoreService.getCollection('tasks')
        ]);

        const taskMap: Record<string, any[]> = {};
        for (const task of allTasks) {
            if (!taskMap[task.assignedToId]) taskMap[task.assignedToId] = [];
            taskMap[task.assignedToId].push(task);
        }

        return users.map((user: any) => {
            const userTasks = taskMap[user.id] || [];
            const totalTasks = userTasks.length;
            const activeTasks = userTasks.filter(t => t.status !== 'COMPLETED').length;

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                totalTasks,
                activeTasks,
                completionRate: totalTasks > 0 
                    ? Math.round(((totalTasks - activeTasks) / totalTasks) * 100) 
                    : 0
            };
        });
    }

    static async getTaskTrends(filter?: { userId?: string, email?: string }) {
        const constraints: any[] = [];
        if (filter?.userId) {
            constraints.push({ field: 'assignedToId', operator: '==', value: filter.userId });
        }

        const tasks = await FirestoreService.query('tasks', constraints);

        const trends: Record<string, Record<string, number>> = {};
        for (const task of tasks) {
            const createdAt = task.createdAt?.toDate ? task.createdAt.toDate() : (task.createdAt ? new Date(task.createdAt) : new Date());
            const month = createdAt.toISOString().substring(0, 7); // YYYY-MM
            if (!trends[month]) trends[month] = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0 };
            trends[month][task.status] = (trends[month][task.status] || 0) + 1;
        }

        return trends;
    }

    static async getDeadlineCompliance(filter?: { userId?: string, email?: string }) {
        const tasks = await FirestoreService.query('tasks', [
            ...(filter?.userId ? [{ field: 'assignedToId', operator: '==', value: filter.userId } as any] : []),
            { field: 'status', operator: '==', value: 'COMPLETED' }
        ]);

        let onTime = 0;
        let late = 0;

        for (const task of tasks) {
            const deadline = task.deadline?.toDate ? task.deadline.toDate() : (task.deadline ? new Date(task.deadline) : null);
            const updatedAt = task.updatedAt?.toDate ? task.updatedAt.toDate() : (task.updatedAt ? new Date(task.updatedAt) : new Date());

            if (deadline) {
                if (updatedAt <= deadline) {
                    onTime++;
                } else {
                    late++;
                }
            }
        }

        const total = onTime + late;
        return {
            onTime,
            late,
            complianceRate: total > 0 ? (onTime / total) * 100 : 0
        };
    }

    static async getWorkflowBreakdown(filter?: { userId?: string, email?: string }) {
        const [workflows, allTasks] = await Promise.all([
            FirestoreService.getCollection('workflows'),
            FirestoreService.getCollection('tasks')
        ]);

        const workflowTaskMap: Record<string, number> = {};
        for (const task of allTasks) {
            if (task.workflowId) {
                if (filter?.userId && task.assignedToId !== filter.userId) continue;
                workflowTaskMap[task.workflowId] = (workflowTaskMap[task.workflowId] || 0) + 1;
            }
        }

        return workflows.map((wf: any) => ({
            id: wf.id,
            type: wf.type,
            sprintName: wf.sprintName,
            status: wf.status,
            taskCount: workflowTaskMap[wf.id] || 0
        }));
    }

    static async getDepartmentSummaries() {
        const now = new Date();
        const [departments, users, tasks] = await Promise.all([
            FirestoreService.getCollection('departments'),
            FirestoreService.getCollection('users'),
            FirestoreService.getCollection('tasks')
        ]);

        const deptMap = new Map<string, any>();
        
        // Initialize map with departments from departments.csv
        departments.forEach((dept: any) => {
            deptMap.set(dept.name.toLowerCase(), {
                name: dept.name,
                headEmail: dept.headEmail,
                facultyCount: 0,
                tasks: [],
                stats: { total: 0, completed: 0, pending: 0, overdue: 0, inProgress: 0, workloadDays: 0 }
            });
        });

        // Add "Other" department if not exists
        if (!deptMap.has('other')) {
            deptMap.set('other', { name: 'Other', facultyCount: 0, tasks: [], stats: { total: 0, completed: 0, pending: 0, overdue: 0, inProgress: 0, workloadDays: 0 } });
        }

        // Count faculty per department
        const emailToDept = new Map<string, string>();
        users.forEach((user: any) => {
            const userDept = (user.department || 'Other').toLowerCase();
            const deptObj = deptMap.get(userDept) || deptMap.get('other');
            if (deptObj) {
                deptObj.facultyCount++;
                emailToDept.set(user.email.toLowerCase(), deptObj.name.toLowerCase());
            }
        });

        const getWeekWindow = (d: Date) => {
            const now = new Date(d);
            const day = now.getDay();
            const mon = new Date(now);
            mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
            mon.setHours(0, 0, 0, 0);

            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);
            sun.setHours(23, 59, 59, 999);
            return { monday: mon, sunday: sun };
        };
        const { monday, sunday } = getWeekWindow(now);

        // Link tasks to departments via assignees or responsibles
        // Visibility: ALL PENDING/OVERDUE up to Sunday (Global Backlog)
        tasks.filter((task: any) => {
            const deadline = task.deadline?.toDate ? task.deadline.toDate() : (task.deadline ? new Date(task.deadline) : null);
            return deadline && deadline <= sunday;
        }).forEach((task: any) => {
            const taskDeptName = (task.department || '').split('+')[0].split('/')[0].trim().toLowerCase();
            let targetDept = deptMap.get(taskDeptName);

            if (!targetDept) {
                // Fallback: Check if any responsible person's department matches
                const responsibles = task.allResponsibles || [];
                for (const email of responsibles) {
                    const mappedDept = emailToDept.get(email.toLowerCase());
                    if (mappedDept) {
                        targetDept = deptMap.get(mappedDept);
                        break;
                    }
                }
            }

            if (!targetDept) targetDept = deptMap.get('other');

            const s = targetDept.stats;
            const status = (task.status || '').toUpperCase();
            const deadline = task.deadline?.toDate ? task.deadline.toDate() : (task.deadline ? new Date(task.deadline) : null);
            const isOverdue = status !== 'COMPLETED' && deadline && deadline < now;
            
            s.total++;
            if (isOverdue) {
                s.overdue++;
                s.pending++; 
            } else {
                if (status === 'COMPLETED') s.completed++;
                else if (status === 'STARTED' || status === 'IN_PROGRESS' || status === 'IN_REVIEW') s.inProgress++;
                else if (status === 'OVERDUE') {
                    s.overdue++;
                    s.pending++;
                } else {
                    // Default to pending for any other status
                    s.pending++;
                }
            }
            
            // Workload calculation: ONLY count unfinished tasks (Pending, In Progress, In Review)
            if (status !== 'COMPLETED') {
                s.workloadDays += 1; 
            }

            // Add basic task info for modal view
            targetDept.tasks.push({
                id: task.id,
                title: task.title,
                status: task.status,
                deadline: task.deadline,
                assignedToEmail: task.assignedToEmail
            });
        });

        return Array.from(deptMap.values()).map(d => ({
            ...d,
            completionRate: d.stats.total > 0 ? Math.round((d.stats.completed / d.stats.total) * 100) : 0
        }));
    }
}
