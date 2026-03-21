import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export class LocalDataService {
    private static DATA_PATH = path.join(process.cwd(), 'data');
    private static users: any[] = [];
    private static tasks: any[] = [];
    private static taskResponsibles: any[] = [];
    private static workflows: any[] = [];
    private static departments: any[] = [];
    private static initialized = false;

    static async initialize() {
        if (this.initialized) return;

        try {
            // 1. Load Departments and Build Email-to-Department Map
            const deptPath = path.join(this.DATA_PATH, 'departments.csv');
            const emailToDept = new Map<string, string>();
            const headEmails = new Set<string>();
            
            if (fs.existsSync(deptPath)) {
                const csv = fs.readFileSync(deptPath, 'utf8');
                const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
                this.departments = records.map((r: any, idx: number) => {
                    const deptName = r['Department / Team Name'] || r['l'] || '';
                    if (deptName) {
                        const emailFields = [
                            'Department Mail', 'Head Email', 
                            'Member 1 Email', 'Member 2 Email', 
                            'Member 3 Email', 'Member 4 Email'
                        ];
                        emailFields.forEach(field => {
                            const email = (r[field] || '').trim().toLowerCase();
                            if (email) emailToDept.set(email, deptName.trim());
                        });

                        const headEmail = (r['Head Email'] || '').trim().toLowerCase();
                        if (headEmail) headEmails.add(headEmail);
                    }
                    return {
                        id: `dept_${idx}`,
                        name: deptName.trim(),
                        headEmail: (r['Head Email'] || '').toLowerCase().trim(),
                        ...r
                    };
                }).filter((d: any) => d.name);
            }

            // 2. Load Tasks and Users from academic_calendar.json
            const jsonPath = '/Users/bankimkamila/Downloads/academic_calendar.json';
            if (fs.existsSync(jsonPath)) {
                const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                const userEmails = new Set<string>();
                
                // Flatten all semester tasks into one array
                const allRecords: any[] = [];
                Object.keys(jsonData).forEach(semesterKey => {
                    if (Array.isArray(jsonData[semesterKey])) {
                        allRecords.push(...jsonData[semesterKey]);
                    }
                });

                let currentSprintName = '';
                let currentSubEvent = '';

                this.tasks = allRecords.map((r: any, idx: number) => {
                    const rowSprint = r['Unnamed: 0'] || r['Sprint'] || '';
                    if (rowSprint && rowSprint.trim()) currentSprintName = rowSprint.trim();

                    const rowSubEvent = r['SUB EVENTS'];
                    if (rowSubEvent && rowSubEvent.trim()) currentSubEvent = rowSubEvent.trim();

                    const title = r['To Do'] || '';
                    const taskId = `task_${idx}`;
                    
                    // Extract emails to build user registry
                    const emails = [
                        r['Responsible Person 1 Email Id'],
                        r['Responsible Person 2 Email Id'],
                        r['Responsible Person 3 Email Id'],
                        r['Responsible Person 4 Email Id'],
                        r['Responsible Person 5 Email Id'],
                        r['BU Head Person Email Id'],
                        r['Operations Person Email Id Layer 1'],
                        r['Operations Person Email Id Layer 2'],
                    ].map(e => (e || '').trim().toLowerCase()).filter(Boolean);

                    emails.forEach(e => {
                        userEmails.add(e);
                        this.taskResponsibles.push({
                            id: `tr_${this.taskResponsibles.length}`,
                            taskId: taskId,
                            email: e,
                            role: 'responsible'
                        });
                    });

                    const parseDate = (dStr: string) => {
                        if (!dStr || dStr.includes('#VALUE!') || dStr.trim() === '' || typeof dStr !== 'string') return null;
                        
                        const normalized = dStr.toLowerCase();
                        if (normalized.includes('every saturday') || normalized.includes('weekly check')) {
                            const now = new Date();
                            const result = new Date(now);
                            result.setHours(23, 59, 59, 999);
                            const day = result.getDay();
                            const daysUntilSaturday = (6 - day + 7) % 7;
                            result.setDate(result.getDate() + daysUntilSaturday);
                            return result.toISOString();
                        }

                        const d = new Date(dStr);
                        return isNaN(d.getTime()) ? null : d.toISOString();
                    };

                    return {
                        id: taskId,
                        title: title.trim(),
                        sprintName: currentSprintName,
                        subEvent: currentSubEvent,
                        status: (() => {
                            const s = (r['Status'] || 'PENDING').trim().toUpperCase();
                            return s === 'STARTED' ? 'IN_PROGRESS' : s;
                        })(),
                        assignedToEmail: emails[0] || 'system@university.edu',
                        allResponsibles: emails,
                        department: (r['To Do Responsible team'] || '').trim(),
                        deadline: parseDate(r['End date (MM/DD/YYYY)'] || r['End date']),
                        startDate: parseDate(r['Start Date (MM/DD/YYYY)'] || r['Start Date']),
                    };
                }).filter(t => t.title);

                // Build User Registry from discovered emails
                this.users = Array.from(userEmails).map((email, idx) => {
                    const userId = `user_${idx}`;
                    const emailLower = email.toLowerCase();
                    const userTasks = this.tasks.filter(t => t.allResponsibles?.includes(emailLower));
                    
                    // 🚨 Fixed Department Mapping: CSV mapping first, then fallback to cleaned task metadata
                    let dept = emailToDept.get(emailLower) || '';
                    if (!dept && userTasks.length > 0) {
                        dept = userTasks[0].department.split('+')[0].split('/')[0].trim();
                    }
                    
                    let role = 'FACULTY';
                    
                    // Priority 1: ADMIN (BU Head or explicitly admin prefix)
                    if (emailLower.startsWith('admin') || allRecords.some((r: any) => 
                        (r['BU Head Person Email Id'] || '').trim().toLowerCase() === emailLower
                    )) {
                        role = 'ADMIN';
                    } 
                    // Priority 2: OPS_MANAGER (Explicitly listed in Ops Layers)
                    else if (allRecords.some((r: any) => {
                        const op1 = (r['Operations Person Email Id Layer 1'] || '').trim().toLowerCase();
                        const op2 = (r['Operations Person Email Id Layer 2'] || '').trim().toLowerCase();
                        return op1 === emailLower || op2 === emailLower;
                    })) {
                        role = 'OPS_MANAGER';
                    } 
                    // Priority 3: HOD (Head Email in departments.csv)
                    else if (headEmails.has(emailLower)) {
                        role = 'HOD';
                    }

                    // Critical connection: Update tasks with the mocked userId
                    this.tasks.forEach(task => {
                        if (task.assignedToEmail === emailLower) {
                            task.assignedToId = userId;
                        }
                    });

                    return {
                        id: userId,
                        email: email,
                        name: email.split('@')[0],
                        role: role,
                        department: dept
                    };
                });

                // Ensure Dev Admin exists
                if (!this.users.find(u => u.email === 'admin@itm.edu')) {
                    this.users.push({
                        id: 'mock-admin-id',
                        email: 'admin@itm.edu',
                        name: 'Dev Admin',
                        role: 'ADMIN',
                        department: 'Administration'
                    });
                }

                this.initialized = true;
                console.log(`[LocalDataService] Initialized: ${this.users.length} users, ${this.tasks.length} tasks, ${this.departments.length} departments.`);
            } else {
                console.error(`[LocalDataService] JSON file not found: ${jsonPath}`);
            }
        } catch (error) {
            console.error('[LocalDataService] Initialization failed:', error);
        }
    }

    static async getCollection(name: string) {
        await this.initialize();
        if (name === 'users') return this.users;
        if (name === 'tasks') return this.tasks;
        if (name === 'taskResponsibles') return this.taskResponsibles;
        if (name === 'departments') return this.departments;
        if (name === 'workflows') return this.workflows;
        return [];
    }

    static async getDoc(name: string, id: string) {
        await this.initialize();
        const coll = await this.getCollection(name);
        return coll.find((item: any) => item.id === id) || null;
    }

    static async findFirst(name: string, field: string, operator: string, value: any) {
        await this.initialize();
        const coll = await this.getCollection(name);
        return coll.find((item: any) => {
            if (operator === '==') return item[field] === value;
            return false;
        }) || null;
    }

    static async query(name: string, constraints: any[]) {
        await this.initialize();
        let coll = await this.getCollection(name);
        for (const c of constraints) {
            coll = coll.filter((item: any) => {
                let itemValue = item[c.field];
                let filterValue = c.value;

                if (c.operator === '==') {
                    // Special case for task assignment queries
                    if (c.field === 'assignedToId' && itemValue !== filterValue) {
                        return item['assignedToEmail'] === filterValue;
                    }
                    return itemValue === filterValue;
                }
                if (c.operator === 'in') return Array.isArray(c.value) && c.value.includes(itemValue);
                return true;
            });
        }
        return coll;
    }
}
