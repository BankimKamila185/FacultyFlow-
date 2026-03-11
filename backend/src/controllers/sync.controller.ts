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
        if (!userEmail) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        let sheetUrl = DEFAULT_SHEET_URL;
        const user = await FirestoreService.findFirst('users', 'email', '==', userEmail.toLowerCase());
        if (user?.sheetUrl) sheetUrl = user.sheetUrl;

        console.log(`User ${userEmail} is syncing from: ${sheetUrl}`);
        
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

        console.log(`Parsed ${records.length} records. Fetching existing data...`);

        // 1. Fetch lookups
        const [existingWorkflows, existingUsers] = await Promise.all([
            FirestoreService.getCollection('workflows'),
            FirestoreService.getCollection('users')
        ]);

        const workflowMap = new Map(existingWorkflows.map((wf: any) => [`${wf.type.trim()}|${(wf.sprintName || '').trim()}`, wf]));
        const userMap = new Map(existingUsers.map((u: any) => [u.email.toLowerCase(), u]));

        let syncedTasks = 0;
        let notificationsCreated = 0;
        let currentSprintName = '';
        let currentSubEvent = '';

        for (const row of records) {
            const rowData = row as any;

            const rowSprint = rowData[''] || rowData['Sprint'] || '';
            if (rowSprint && rowSprint.trim()) currentSprintName = rowSprint.trim();

            const rowSubEvent = rowData['SUB EVENTS'];
            if (rowSubEvent && rowSubEvent.trim()) currentSubEvent = rowSubEvent.trim();

            const title = rowData['To Do'];
            if (!title || !title.trim()) continue;

            const subEvent = currentSubEvent;
            const startDateStr = rowData['Start Date (MM/DD/YYYY)'];
            const endDateStr = rowData['End date (MM/DD/YYYY)'];
            const statusStr = rowData['Status'];
            const responsibleTeam = rowData['To Do Responsible team'];

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

            const primaryEmail = responsibleEmails[0] || 'system@facultyflow.app';

            // Status mapping
            let status = 'PENDING';
            if (statusStr === 'Completed') status = 'COMPLETED';
            else if (statusStr === 'Started' || statusStr === 'In Progress') status = 'IN_PROGRESS';
            if (status !== 'COMPLETED' && title.toLowerCase().includes('review')) status = 'IN_REVIEW';

            let startDate: Date | null = null;
            if (startDateStr) {
                const d = new Date(startDateStr);
                if (!isNaN(d.getTime())) startDate = d;
            }
            let deadline: Date | null = null;
            if (endDateStr) {
                const d = new Date(endDateStr);
                if (!isNaN(d.getTime())) deadline = d;
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
                primaryUser = await FirestoreService.createDoc('users', { email: primaryEmail, name: primaryEmail.split('@')[0], role: 'FACULTY' });
                userMap.set(primaryEmail.toLowerCase(), primaryUser);
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
                    description: responsibleTeam || existingTask.description,
                    assignedToId: primaryUser.id,
                });
                taskId = updated.id;
            } else {
                const newTask = await FirestoreService.createDoc<any>('tasks', {
                    title: title.trim(),
                    status,
                    deadline,
                    startDate,
                    description: responsibleTeam || '',
                    workflowId,
                    assignedToId: primaryUser.id,
                    createdById: primaryUser.id,
                });
                taskId = newTask.id;

                await FirestoreService.createDoc('notifications', {
                    message: `New task assigned: "${title.trim()}"`,
                    type: 'IN_APP',
                    userId: primaryUser.id,
                    isRead: false
                });
                notificationsCreated++;
            }

            // Update Responsibles
            const existingResp = await FirestoreService.query('taskResponsibles', [{ field: 'taskId', operator: '==', value: taskId }]);
            await Promise.all(existingResp.map(r => FirestoreService.deleteDoc('taskResponsibles', r.id)));
            
            await Promise.all(responsibleEmails.map((email, i) => 
                FirestoreService.createDoc('taskResponsibles', {
                    taskId,
                    email: email.toLowerCase(),
                    role: `responsible_${i + 1}`
                })
            ));

            syncedTasks++;
        }

        res.json({
            success: true,
            message: `Successfully synced ${syncedTasks} tasks for ${userEmail}.`,
            data: { syncedTasks, notificationsCreated }
        });

    } catch (error: any) {
        console.error('Sync error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
