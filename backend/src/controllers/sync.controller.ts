import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import { FirestoreService } from '../services/FirestoreService';

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1tKxwemxRO9HWpYwkuS98Ey8EGiRjHO5QszI4R0zWFF0/export?format=csv&gid=1903243312';

export const updateSheetUrl = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        const { sheetUrl } = req.body;

        if (!userEmail) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
        if (!sheetUrl) { res.status(400).json({ success: false, message: 'sheetUrl is required' }); return; }

        const user = await FirestoreService.findFirst('users', 'email', '==', userEmail.toLowerCase());
        if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }

        await FirestoreService.updateDoc('users', user.id, { sheetUrl });

        res.json({ success: true, message: 'Sheet URL updated successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const syncGoogleSheetsData = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        const { preview, shouldNotify = false } = req.body || {};

        if (!userEmail) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        let sheetUrl = DEFAULT_SHEET_URL;
        const user = await FirestoreService.findFirst('users', 'email', '==', userEmail.toLowerCase());
        if (user?.sheetUrl) sheetUrl = user.sheetUrl;

        console.log(`User ${userEmail} is syncing from: ${sheetUrl} (Preview: ${!!preview})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); 

        let response;
        try {
            response = await fetch(sheetUrl, { signal: controller.signal });
        } catch (fetchError: any) {
            if (fetchError.name === 'AbortError') {
                throw new Error('Sync timed out after 60 seconds.');
            }
            throw fetchError;
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch sheet: ${response.statusText} (${response.status})`);
        }

        const csvString = await response.text();
        const records = parse(csvString, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        console.log(`Parsed ${records.length} records. Firestore Check...`);

        // Preliminary check for Firestore connectivity only if not previewing or if we need check anyway
        if (!preview) {
            try {
                await FirestoreService.getCollection('users');
            } catch (fiError: any) {
                if (fiError.message.includes('NOT_FOUND') || fiError.message.includes('not found')) {
                    throw new Error('Firestore database not found or not initialized in your Firebase project. Please click "Create database" in the Firebase console.');
                }
                throw fiError;
            }
        }

        // 1. Fetch lookups (only if not preview)
        let workflowMap = new Map();
        let userMap = new Map();

        if (!preview) {
            const [existingWorkflows, existingUsers] = await Promise.all([
                FirestoreService.getCollection('workflows'),
                FirestoreService.getCollection('users')
            ]);
            workflowMap = new Map(existingWorkflows.map((wf: any) => [`${(wf.type || '').trim()}|${(wf.sprintName || '').trim()}`, wf]));
            userMap = new Map(existingUsers.map((u: any) => [u.email.toLowerCase(), u]));
        }

        let syncedTasks = 0;
        let notificationsCreated = 0;
        let currentSprintName = '';
        let currentSubEvent = '';
        const previewData: any[] = [];
        const syncedResponsibles = new Map<string, string[]>();

        for (const row of records) {
            const rowData = row as any;

            // Header mapping based on user request
            const rowSprint = rowData[''] || rowData['Sprint'] || '';
            if (rowSprint && rowSprint.trim()) currentSprintName = rowSprint.trim();

            const rowSubEvent = rowData['SUB EVENTS'];
            if (rowSubEvent && rowSubEvent.trim()) currentSubEvent = rowSubEvent.trim();

            // Requested Headers mapping
            const title = rowData['To Do'];
            if (!title || !title.trim()) continue;

            const subEvent = currentSubEvent;
            const startDateStr = rowData['Start Date'] || rowData['Start Date (MM/DD/YYYY)'];
            const endDateStr = rowData['End date'] || rowData['End date (MM/DD/YYYY)'];
            const statusStr = rowData['status'] || rowData['Status'];
            const taskCompletionDateStr = rowData['Task Completion Date'];
            const responsibleTeam = rowData['To Do Responsible team'];

            // Flexible email extraction
            const responsibleEmails: string[] = [
                rowData['Responsible Person 1 Email Id'],
                rowData['Responsible Person 2 Email Id'],
                rowData['Responsible Person 3 Email Id'],
                rowData['Responsible Person 4 Email Id'],
                rowData['Responsible Person 5 Email Id'],
                rowData['BU Head Person Email Id'],
                rowData['Operations Person Email Id Layer 1'],
                rowData['Operations Person Email Id Layer 2'],
            ].map(e => (e || '').trim().toLowerCase()).filter(Boolean);

            const primaryEmail = responsibleEmails[0] || 'system@university.edu';

            // Status mapping
            let status = 'PENDING';
            const sNormalized = (statusStr || '').toLowerCase().trim();
            if (sNormalized === 'completed') status = 'COMPLETED';
            else if (sNormalized === 'started' || sNormalized === 'in progress') status = 'IN_PROGRESS';
            
            if (status !== 'COMPLETED' && title.toLowerCase().includes('review')) status = 'IN_REVIEW';

            const getNextSaturday = (now: Date) => {
                const result = new Date(now);
                result.setHours(23, 59, 59, 999);
                const day = result.getDay(); // 0 (Sun) to 6 (Sat)
                const daysUntilSaturday = (6 - day + 7) % 7;
                result.setDate(result.getDate() + daysUntilSaturday);
                return result;
            };

            const parseRecurringDate = (dateStr: string | null, now: Date) => {
                if (!dateStr) return null;
                const normalized = dateStr.toLowerCase();
                if (normalized.includes('every saturday') || normalized.includes('weekly check')) {
                    return getNextSaturday(now);
                }
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? null : d;
            };

            const nowForSync = new Date();
            let startDate: Date | null = parseRecurringDate(startDateStr, nowForSync);
            
            let deadline: Date | null = parseRecurringDate(endDateStr, nowForSync);
            if (deadline && !endDateStr.toLowerCase().includes('saturday')) {
                 // Regular date clamping logic
                 if (deadline < nowForSync && status !== 'COMPLETED') {
                    deadline = nowForSync;
                    console.log(`[Sync] Clamping past deadline to today for task: ${title}`);
                 }
            }
            let taskCompletionDate: Date | null = null;
            if (taskCompletionDateStr) {
                const d = new Date(taskCompletionDateStr);
                if (!isNaN(d.getTime())) taskCompletionDate = d;
            }

            if (preview) {
                previewData.push({
                    title: title.trim(),
                    sprintName: currentSprintName,
                    subEvent: subEvent,
                    status,
                    startDate,
                    deadline,
                    taskCompletionDate,
                    primaryEmail,
                    responsibleTeam,
                    allResponsibles: responsibleEmails
                });
                syncedTasks++;
                continue;
            }

            // Handle Workflow
            let workflowId: string | null = null;
            if (subEvent && subEvent.trim()) {
                const trimmedType = subEvent.trim();
                const trimmedSprint = (currentSprintName || '').trim();
                const wfKey = `${trimmedType}|${trimmedSprint}`;
                
                let workflow = workflowMap.get(wfKey);
                if (!workflow) {
                    workflow = await FirestoreService.createDoc('workflows', {
                        type: trimmedType,
                        sprintName: trimmedSprint || null,
                        status: status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE'
                    });
                    workflowMap.set(wfKey, workflow);
                }
                workflowId = workflow.id;
            }

            // Handle Primary User
            let primaryUser = userMap.get(primaryEmail.toLowerCase());
            if (!primaryUser) {
                primaryUser = await FirestoreService.createDoc('users', { 
                    email: primaryEmail, 
                    name: primaryEmail.split('@')[0], 
                    role: 'FACULTY',
                    department: responsibleTeam || null
                });
                userMap.set(primaryEmail.toLowerCase(), primaryUser);
            } else if (!primaryUser.department && responsibleTeam) {
                await FirestoreService.updateDoc('users', primaryUser.id, { department: responsibleTeam });
                primaryUser.department = responsibleTeam;
            }

            // Find Task
            const existingTasks = await FirestoreService.query('tasks', [
                { field: 'title', operator: '==', value: title.trim() },
                { field: 'workflowId', operator: '==', value: workflowId }
            ]);
            const existingTask = existingTasks[0];

            let taskId: string;
            if (existingTask) {
                const updated = await FirestoreService.updateDoc<any>('tasks', existingTask.id, {
                    status,
                    deadline,
                    startDate,
                    taskCompletionDate,
                    description: responsibleTeam || existingTask.description,
                    assignedToId: primaryUser.id,
                    department: responsibleTeam || existingTask.department,
                    responsibleTeam: responsibleTeam || existingTask.responsibleTeam
                });
                taskId = updated.id;
            } else {
                const newTask = await FirestoreService.createDoc<any>('tasks', {
                    title: title.trim(),
                    status,
                    deadline,
                    startDate,
                    taskCompletionDate,
                    description: responsibleTeam || '',
                    workflowId,
                    assignedToId: primaryUser.id,
                    createdById: primaryUser.id,
                    department: responsibleTeam || null,
                    responsibleTeam: responsibleTeam || null
                });
                taskId = newTask.id;

                await FirestoreService.createDoc('notifications', {
                    message: `New task assigned: "${title.trim()}"`,
                    type: 'IN_APP',
                    userId: primaryUser.id,
                    isRead: false
                });

                // Send Assignment Email
                if (shouldNotify) {
                    try {
                        const { sendTaskAssignedEmail } = await import('../services/MailService');
                        await sendTaskAssignedEmail({
                            toEmail: primaryUser.email,
                            toName: primaryUser.name || 'Faculty Member',
                            taskTitle: title.trim(),
                            taskId: newTask.id,
                            sprintName: currentSprintName,
                            subEvent: subEvent,
                            deadline: deadline,
                            responsibleTeam: responsibleTeam
                        });
                    } catch (emailErr) {
                        console.error('Failed to send assignment email during sync:', emailErr);
                    }
                }

                notificationsCreated++;
            }

            // Update Responsibles (OPTIMIZED: Collect for bulk processing)
            syncedResponsibles.set(taskId, responsibleEmails);

            syncedTasks++;
        }

        // --- NEW: Bulk Update Responsibles ---
        if (!preview && syncedResponsibles.size > 0) {
            const taskIds = Array.from(syncedResponsibles.keys());
            console.log(`Bulk updating responsibles for ${taskIds.length} tasks...`);
            for (let i = 0; i < taskIds.length; i += 10) {
                const chunkIds = taskIds.slice(i, i + 10);
                
                // 1. Fetch all existing in one query
                const existing = await FirestoreService.query('taskResponsibles', [
                    { field: 'taskId', operator: 'in', value: chunkIds }
                ]);
                
                // 2. Delete all existing
                await Promise.all(existing.map(r => FirestoreService.deleteDoc('taskResponsibles', r.id)));
                
                // 3. Create new ones
                const creations: Promise<any>[] = [];
                for (const taskId of chunkIds) {
                    const emails = syncedResponsibles.get(taskId) || [];
                    for (let idx = 0; idx < emails.length; idx++) {
                        creations.push(FirestoreService.createDoc('taskResponsibles', {
                            taskId,
                            email: emails[idx].toLowerCase(),
                            role: `responsible_${idx + 1}`
                        }));
                    }
                }
                await Promise.all(creations);
            }
        }

        // --- NEW: Sync Department List (GID: 16651627) ---
        if (!preview) {
            console.log("Syncing Department List...");
            const deptSheetUrl = sheetUrl.replace(/gid=[0-9]+/, 'gid=16651627');
            try {
                const deptResponse = await fetch(deptSheetUrl);
                if (deptResponse.ok) {
                    const deptCsvString = await deptResponse.text();
                    const deptRecords = parse(deptCsvString, {
                        columns: true,
                        skip_empty_lines: true,
                        trim: true
                    });

                    for (const deptRow of deptRecords) {
                        const dr = deptRow as any;
                        const deptName = dr['l'] || dr['Department / Team Name'] || dr['To Do Responsible team'];
                        if (!deptName || !deptName.trim()) continue;

                        const deptMail = dr['Department Mail'] || dr['mail'] || '';
                        const headName = dr['Head Name'] || '';
                        const headEmail = (dr['Head Email'] || dr['Department head'] || '').trim().toLowerCase();
                        
                        // Extract members
                        const members = [
                            { name: dr['Member 1 Name'], email: (dr['Member 1 Email'] || '').trim().toLowerCase() },
                            { name: dr['Member 2 Name'], email: (dr['Member 2 Email'] || '').trim().toLowerCase() },
                            { name: dr['Member 3 Name'], email: (dr['Member 3 Email'] || '').trim().toLowerCase() },
                            { name: dr['Member 4 Name'], email: (dr['Member 4 Email'] || '').trim().toLowerCase() },
                        ].filter(m => m.email);

                        // Update or Create Department
                        const existingDepts = await FirestoreService.query('departments', [{ field: 'name', operator: '==', value: deptName.trim() }]);
                        const deptData = {
                            name: deptName.trim(),
                            email: deptMail,
                            headName: headName,
                            headEmail: headEmail,
                            members: members
                        };

                        if (existingDepts.length > 0) {
                            await FirestoreService.updateDoc('departments', existingDepts[0].id, deptData);
                        } else {
                            await FirestoreService.createDoc('departments', deptData);
                        }

                        // Sync Users from Dept List (Head and Members)
                        const usersToSync = [
                            { email: headEmail, name: headName || 'Dept Head' },
                            ...members
                        ].filter(u => u.email);

                        for (const uInfo of usersToSync) {
                            let user = userMap.get(uInfo.email);
                            if (user) {
                                if (user.department !== deptName.trim() || user.name !== uInfo.name) {
                                    await FirestoreService.updateDoc('users', user.id, { 
                                        department: deptName.trim(),
                                        name: uInfo.name || user.name
                                    });
                                    user.department = deptName.trim();
                                    user.name = uInfo.name || user.name;
                                }
                            } else {
                                const newUser = await FirestoreService.createDoc('users', {
                                    email: uInfo.email,
                                    name: uInfo.name || uInfo.email.split('@')[0],
                                    role: 'FACULTY',
                                    department: deptName.trim()
                                });
                                userMap.set(uInfo.email, newUser);
                            }
                        }
                    }
                }
            } catch (deptError) {
                console.error('Error syncing departments:', deptError);
            }
        }

        res.json({
            success: true,
            message: preview 
                ? `Preview generated for ${syncedTasks} tasks.`
                : `Successfully synced ${syncedTasks} tasks for ${userEmail}.`,
            data: preview ? previewData : { syncedTasks, notificationsCreated }
        });

    } catch (error: any) {
        console.error('Sync error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

import { ReminderService } from '../services/ReminderService';

export const sendReminders = async (req: Request, res: Response): Promise<void> => {
    try {
        const userEmail = (req as any).user?.email;
        if (!userEmail) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        console.log(`[SyncController] Manual reminder trigger by ${userEmail}`);
        
        // Trigger the background process
        ReminderService.sendPendingTaskReminders();

        res.json({ 
            success: true, 
            message: 'Bulk reminder process started in the background. Check terminal for logs.' 
        });
    } catch (error: any) {
        console.error('Manual reminder error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
