const electron = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');
const os = require('os');
const https = require('https');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
app.setName('Eviro');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.eviro.app');
}

let mainWindow;

const STORAGE_PATH = path.join(os.homedir(), '.notes-tasks-manager');
const NOTES_FILE = path.join(STORAGE_PATH, 'notes.json');
const TASKS_FILE = path.join(STORAGE_PATH, 'tasks.json');
const NOTE_FOLDERS_FILE = path.join(STORAGE_PATH, 'note-folders.json');
const TASK_FOLDERS_FILE = path.join(STORAGE_PATH, 'task-folders.json');
const SUBJECTS_FILE = path.join(STORAGE_PATH, 'subjects.json');
const TIMETABLE_FILE = path.join(STORAGE_PATH, 'timetable.json');
const GRADES_FILE = path.join(STORAGE_PATH, 'grades.json');
const STUDY_SESSIONS_FILE = path.join(STORAGE_PATH, 'study-sessions.json');
const ICLOUD_SETTINGS_FILE = path.join(STORAGE_PATH, 'icloud-settings.json');
const ICLOUD_EVENTS_FILE = path.join(STORAGE_PATH, 'icloud-events.json');
const PROFILES_FILE = path.join(STORAGE_PATH, 'profiles.json');

if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

const readData = (file) => {
  if (!fs.existsSync(file)) {
    return [];
  }
  const data = fs.readFileSync(file, 'utf8');
  return JSON.parse(data || '[]');
};

const writeData = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeNote = (note) => ({
  ...note,
  subjectId: note?.subjectId ?? null,
  folderId: note?.folderId ?? null,
});

const normalizeTask = (task) => ({
  ...task,
  subjectId: task?.subjectId ?? null,
  folderId: task?.folderId ?? null,
});

const normalizeFolder = (folder, idx = 0) => ({
  id: typeof folder?.id === 'string' && folder.id.trim() ? folder.id.trim() : `folder-${makeId()}-${idx}`,
  name: String(folder?.name || '').trim() || `Folder ${idx + 1}`,
  parentId: folder?.parentId || null,
});

const normalizeFolders = (folders) => (Array.isArray(folders) ? folders : []).map((f, idx) => normalizeFolder(f, idx));

const normalizeSubjectRecord = (subject, idx = 0) => {
  const normalized = {
    id: typeof subject?.id === 'string' && subject.id.trim() ? subject.id.trim() : `subject-${makeId()}-${idx}`,
    name: String(subject?.name || '').trim(),
    color: typeof subject?.color === 'string' ? subject.color.trim() : '',
    exams: Array.isArray(subject?.exams) ? subject.exams : [],
  };

  normalized.exams = normalized.exams.map((exam, examIdx) => ({
    ...exam,
    id: typeof exam?.id === 'string' && exam.id.trim() ? exam.id.trim() : `exam-${makeId()}-${examIdx}`,
    subjectId: exam?.subjectId || normalized.id,
  }));

  return normalized;
};

const normalizeSubjectsData = (subjects) =>
  (Array.isArray(subjects) ? subjects : []).map((subject, idx) => normalizeSubjectRecord(subject, idx)).filter((subject) => subject.name);

const stripXmlValue = (value) =>
  String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const findFirstTagValue = (xml, tagName) => {
  const match = String(xml || '').match(
    new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`, 'i')
  );
  return match ? stripXmlValue(match[1]) : '';
};

const findHrefForProperty = (xml, propertyTagName) => {
  const scopedMatch = String(xml || '').match(
    new RegExp(
      `<(?:[a-zA-Z0-9_-]+:)?${propertyTagName}[^>]*>[\\s\\S]*?<(?:[a-zA-Z0-9_-]+:)?href[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?href>[\\s\\S]*?<\\/(?:[a-zA-Z0-9_-]+:)?${propertyTagName}>`,
      'i'
    )
  );
  if (scopedMatch) return stripXmlValue(scopedMatch[1]);
  return '';
};

const findResponseBlocks = (xml) => {
  const matches = String(xml || '').match(/<(?:[a-zA-Z0-9_-]+:)?response\b[\s\S]*?<\/(?:[a-zA-Z0-9_-]+:)?response>/gi);
  return matches || [];
};

const formatCaldavUtc = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
};

const parseICSDate = (value) => {
  if (!value) return null;
  const input = String(value).trim();
  if (/^\d{8}$/.test(input)) {
    const year = Number(input.slice(0, 4));
    const month = Number(input.slice(4, 6)) - 1;
    const day = Number(input.slice(6, 8));
    return new Date(year, month, day, 0, 0, 0, 0);
  }
  if (/^\d{8}T\d{6}Z$/.test(input)) {
    const year = Number(input.slice(0, 4));
    const month = Number(input.slice(4, 6)) - 1;
    const day = Number(input.slice(6, 8));
    const hour = Number(input.slice(9, 11));
    const minute = Number(input.slice(11, 13));
    const second = Number(input.slice(13, 15));
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  if (/^\d{8}T\d{6}$/.test(input)) {
    const year = Number(input.slice(0, 4));
    const month = Number(input.slice(4, 6)) - 1;
    const day = Number(input.slice(6, 8));
    const hour = Number(input.slice(9, 11));
    const minute = Number(input.slice(11, 13));
    const second = Number(input.slice(13, 15));
    return new Date(year, month, day, hour, minute, second);
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseICSBlock = (icsText) => {
  const unfolded = String(icsText || '').replace(/\r?\n[ \t]/g, '');
  const eventBlocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
  return eventBlocks
    .map((block, idx) => {
      const uidMatch = block.match(/^UID:(.+)$/m);
      const summaryMatch = block.match(/^SUMMARY:(.+)$/m);
      const dtStartMatch = block.match(/^DTSTART(?:;[^:]*)?:(.+)$/m);
      const dtEndMatch = block.match(/^DTEND(?:;[^:]*)?:(.+)$/m);
      const descriptionMatch = block.match(/^DESCRIPTION:(.+)$/m);

      const startDate = parseICSDate(dtStartMatch ? dtStartMatch[1] : '');
      const endDate = parseICSDate(dtEndMatch ? dtEndMatch[1] : '') || (startDate ? new Date(startDate.getTime() + 60 * 60 * 1000) : null);
      if (!startDate) return null;

      return {
        id: stripXmlValue(uidMatch ? uidMatch[1] : `evt-${idx}-${makeId()}`),
        title: stripXmlValue(summaryMatch ? summaryMatch[1] : 'iCloud Event'),
        description: stripXmlValue(descriptionMatch ? descriptionMatch[1] : ''),
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : startDate.toISOString(),
      };
    })
    .filter(Boolean);
};

const davRequest = (method, rawUrl, { email, password, body = '', headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    const url = new URL(rawUrl);
    const request = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`,
          'User-Agent': 'Eviro-CalDAV/1.0',
          ...headers,
        },
      },
      (response) => {
        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          resolve({ statusCode: response.statusCode || 0, body: data, headers: response.headers });
        });
      }
    );
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });

const discoverCalendarHome = async (email, password) => {
  const principalProbe = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal />
  </d:prop>
</d:propfind>`;
  const principalResp = await davRequest('PROPFIND', 'https://caldav.icloud.com/', {
    email,
    password,
    body: principalProbe,
    headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
  });
  if (principalResp.statusCode === 401) {
    throw new Error('Authentication failed. Check Apple ID and app-specific password.');
  }
  if (![200, 207].includes(principalResp.statusCode)) {
    throw new Error(`CalDAV discovery failed (${principalResp.statusCode}).`);
  }
  const principalHref = findHrefForProperty(principalResp.body, 'current-user-principal') || findFirstTagValue(principalResp.body, 'href');
  if (!principalHref) throw new Error('Could not resolve iCloud principal URL.');
  const principalUrl = new URL(principalHref, 'https://caldav.icloud.com/').toString();

  const homeProbe = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set />
  </d:prop>
</d:propfind>`;
  const homeResp = await davRequest('PROPFIND', principalUrl, {
    email,
    password,
    body: homeProbe,
    headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
  });
  if ([200, 207].includes(homeResp.statusCode)) {
    const homeHref = findHrefForProperty(homeResp.body, 'calendar-home-set') || findFirstTagValue(homeResp.body, 'href');
    if (homeHref) {
      const resolved = new URL(homeHref, principalUrl).toString();
      return resolved.endsWith('/') ? resolved : `${resolved}/`;
    }
  }

  // Fallback: derive DSID from principal URL and construct standard iCloud calendar home path.
  const principalPathParts = new URL(principalUrl).pathname.split('/').filter(Boolean);
  const dsid = principalPathParts[0];
  if (dsid) return `https://caldav.icloud.com/${dsid}/calendars/`;
  throw new Error(`Could not resolve calendar home (${homeResp.statusCode}).`);
};

const listCalendars = async (calendarHomeUrl, email, password) => {
  const listProbe = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
  </d:prop>
</d:propfind>`;
  const calendarsResp = await davRequest('PROPFIND', calendarHomeUrl, {
    email,
    password,
    body: listProbe,
    headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
  });
  if (![200, 207].includes(calendarsResp.statusCode)) {
    throw new Error(`Could not list calendars (${calendarsResp.statusCode}).`);
  }
  return findResponseBlocks(calendarsResp.body)
    .filter((block) => /<(?:[a-zA-Z0-9_-]+:)?calendar\s*\/>/i.test(block))
    .map((block) => {
      const href = findFirstTagValue(block, 'href');
      const displayName = findFirstTagValue(block, 'displayname') || 'iCloud Calendar';
      return href ? { url: new URL(href, calendarHomeUrl).toString(), name: displayName } : null;
    })
    .filter(Boolean);
};

const fetchCalendarEvents = async (calendarUrl, email, password) => {
  const start = new Date();
  start.setMonth(start.getMonth() - 2);
  const end = new Date();
  end.setMonth(end.getMonth() + 12);
  const reportBody = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${formatCaldavUtc(start)}" end="${formatCaldavUtc(end)}" />
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

  const reportResp = await davRequest('REPORT', calendarUrl, {
    email,
    password,
    body: reportBody,
    headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
  });
  if (![200, 207].includes(reportResp.statusCode)) {
    throw new Error(`Calendar report failed (${reportResp.statusCode}).`);
  }
  const inlineEvents = [];
  const responseBlocks = findResponseBlocks(reportResp.body);
  responseBlocks.forEach((block) => {
    const calendarData = findFirstTagValue(block, 'calendar-data');
    if (!calendarData) return;
    inlineEvents.push(...parseICSBlock(calendarData));
  });
  if (inlineEvents.length) return inlineEvents;

  // Fallback: some servers return only href/etag; fetch each .ics object directly.
  const objectUrls = responseBlocks
    .map((block) => findFirstTagValue(block, 'href'))
    .filter((href) => href && /\.ics($|\?)/i.test(href))
    .map((href) => new URL(href, calendarUrl).toString());

  const fetchedEvents = [];
  for (const objectUrl of objectUrls) {
    const objectResp = await davRequest('GET', objectUrl, { email, password });
    if (objectResp.statusCode >= 200 && objectResp.statusCode < 300) {
      fetchedEvents.push(...parseICSBlock(objectResp.body));
    }
  }
  return fetchedEvents;
};

const syncICloudEventsInternal = async (email, password) => {
  const calendarHomeUrl = await discoverCalendarHome(email, password);
  const calendars = await listCalendars(calendarHomeUrl, email, password);
  if (!calendars.length) return [];
  const allEvents = [];
  for (const calendar of calendars) {
    const calendarEvents = await fetchCalendarEvents(calendar.url, email, password);
    allEvents.push(...calendarEvents.map((event) => ({ ...event, calendar: calendar.name })));
  }
  const deduped = [];
  const seen = new Set();
  allEvents.forEach((event) => {
    const key = `${event.id}-${event.startDate}-${event.endDate}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(event);
  });
  writeData(ICLOUD_EVENTS_FILE, deduped);
  return deduped;
};

ipcMain.handle('get-notes', () => {
  const notes = readData(NOTES_FILE);
  const normalized = notes.map(normalizeNote);
  if (JSON.stringify(notes) !== JSON.stringify(normalized)) {
    writeData(NOTES_FILE, normalized);
  }
  return normalized;
});
ipcMain.handle('save-note', (event, note) => {
  const notes = readData(NOTES_FILE);
  const normalizedNote = normalizeNote(note);
  const index = notes.findIndex((n) => n.id === normalizedNote.id);
  if (index === -1) {
    notes.push(normalizedNote);
  } else {
    notes[index] = normalizedNote;
  }
  writeData(NOTES_FILE, notes);
  return notes;
});
ipcMain.handle('delete-note', (event, id) => {
  let notes = readData(NOTES_FILE);
  notes = notes.filter((n) => n.id !== id);
  writeData(NOTES_FILE, notes);
  return notes;
});

ipcMain.handle('get-tasks', () => {
  const tasks = readData(TASKS_FILE);
  const normalized = tasks.map(normalizeTask);
  if (JSON.stringify(tasks) !== JSON.stringify(normalized)) {
    writeData(TASKS_FILE, normalized);
  }
  return normalized;
});
ipcMain.handle('save-task', (event, task) => {
  const tasks = readData(TASKS_FILE);
  const normalizedTask = normalizeTask(task);
  const index = tasks.findIndex((t) => t.id === normalizedTask.id);
  if (index === -1) {
    tasks.push(normalizedTask);
  } else {
    tasks[index] = normalizedTask;
  }
  writeData(TASKS_FILE, tasks);
  return tasks;
});
ipcMain.handle('delete-task', (event, id) => {
  let tasks = readData(TASKS_FILE);
  tasks = tasks.filter((t) => t.id !== id);
  writeData(TASKS_FILE, tasks);
  return tasks;
});

const upsertFolder = (file, payload) => {
  const folders = normalizeFolders(readData(file));
  const entry = normalizeFolder(payload);
  const index = folders.findIndex((folder) => folder.id === entry.id);
  if (index >= 0) folders[index] = entry;
  else folders.push(entry);
  writeData(file, folders);
  return folders;
};

const deleteFolderWithChildren = (file, folderId) => {
  const folders = normalizeFolders(readData(file));
  const idsToDelete = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    folders.forEach((folder) => {
      if (folder.parentId && idsToDelete.has(folder.parentId) && !idsToDelete.has(folder.id)) {
        idsToDelete.add(folder.id);
        changed = true;
      }
    });
  }
  const next = folders.filter((folder) => !idsToDelete.has(folder.id));
  writeData(file, next);
  return { folders: next, deletedIds: Array.from(idsToDelete) };
};

ipcMain.handle('get-note-folders', () => {
  const folders = normalizeFolders(readData(NOTE_FOLDERS_FILE));
  writeData(NOTE_FOLDERS_FILE, folders);
  return folders;
});
ipcMain.handle('save-note-folder', (event, folder) => upsertFolder(NOTE_FOLDERS_FILE, folder));
ipcMain.handle('delete-note-folder', (event, folderId) => {
  const { folders, deletedIds } = deleteFolderWithChildren(NOTE_FOLDERS_FILE, folderId);
  const notes = readData(NOTES_FILE).map(normalizeNote).map((note) => (deletedIds.includes(note.folderId) ? { ...note, folderId: null } : note));
  writeData(NOTES_FILE, notes);
  return { folders, notes };
});

ipcMain.handle('get-task-folders', () => {
  const folders = normalizeFolders(readData(TASK_FOLDERS_FILE));
  writeData(TASK_FOLDERS_FILE, folders);
  return folders;
});
ipcMain.handle('save-task-folder', (event, folder) => upsertFolder(TASK_FOLDERS_FILE, folder));
ipcMain.handle('delete-task-folder', (event, folderId) => {
  const { folders, deletedIds } = deleteFolderWithChildren(TASK_FOLDERS_FILE, folderId);
  const tasks = readData(TASKS_FILE).map(normalizeTask).map((task) => (deletedIds.includes(task.folderId) ? { ...task, folderId: null } : task));
  writeData(TASKS_FILE, tasks);
  return { folders, tasks };
});

ipcMain.handle('get-icloud-settings', () => {
  if (!fs.existsSync(ICLOUD_SETTINGS_FILE)) {
    return { email: '', connected: false };
  }
  try {
    const data = fs.readFileSync(ICLOUD_SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    return {
      email: settings.email || '',
      connected: !!settings.connected,
      connectedAt: settings.connectedAt || null,
      lastSyncedAt: settings.lastSyncedAt || null,
      lastSyncStatus: settings.lastSyncStatus || '',
    };
  } catch {
    return { email: '', connected: false };
  }
});

ipcMain.handle('connect-icloud', async (event, { email, password }) => {
  try {
    if (!email || !password) {
      return { success: false, error: 'Email and app-specific password are required.' };
    }
    await discoverCalendarHome(email, password);
    const settings = {
      email,
      password,
      connected: true,
      connectedAt: new Date().toISOString(),
      lastSyncedAt: null,
      lastSyncStatus: '',
    };
    writeData(ICLOUD_SETTINGS_FILE, settings);
    return { success: true, message: 'Connected to iCloud' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disconnect-icloud', async () => {
  try {
    if (fs.existsSync(ICLOUD_SETTINGS_FILE)) {
      fs.unlinkSync(ICLOUD_SETTINGS_FILE);
    }
    if (fs.existsSync(ICLOUD_EVENTS_FILE)) {
      fs.unlinkSync(ICLOUD_EVENTS_FILE);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-icloud-events', () => {
  if (!fs.existsSync(ICLOUD_EVENTS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(ICLOUD_EVENTS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch {
    return [];
  }
});

ipcMain.handle('sync-icloud-events', async () => {
  if (!fs.existsSync(ICLOUD_SETTINGS_FILE)) {
    return { success: false, connected: false, error: 'Not connected to iCloud.' };
  }
  try {
    const settings = JSON.parse(fs.readFileSync(ICLOUD_SETTINGS_FILE, 'utf8') || '{}');
    if (!settings.email || !settings.password) {
      return { success: false, connected: false, error: 'Missing iCloud credentials. Reconnect iCloud.' };
    }
    const events = await syncICloudEventsInternal(settings.email, settings.password);
    settings.lastSyncedAt = new Date().toISOString();
    settings.lastSyncStatus = `Synced ${events.length} event(s)`;
    writeData(ICLOUD_SETTINGS_FILE, settings);
    return {
      success: true,
      connected: true,
      events,
      lastSyncedAt: settings.lastSyncedAt,
      message: settings.lastSyncStatus,
    };
  } catch (error) {
    return { success: false, connected: true, error: error.message || 'Sync failed.' };
  }
});

ipcMain.handle('get-subjects', () => {
  const subjects = readData(SUBJECTS_FILE);
  const normalized = normalizeSubjectsData(subjects);
  if (JSON.stringify(subjects) !== JSON.stringify(normalized)) {
    writeData(SUBJECTS_FILE, normalized);
  }
  return normalized;
});
ipcMain.handle('save-exam', (event, payload) => {
  const { subject, subjectId, name, grade, date, type, weight } = payload || {};
  const subjects = normalizeSubjectsData(readData(SUBJECTS_FILE));
  let subjectObj =
    subjects.find((s) => s.id === subjectId) ||
    subjects.find((s) => s.name === String(subject || '').trim());

  if (!subjectObj) {
    subjectObj = {
      id: `subject-${makeId()}`,
      name: String(subject || '').trim(),
      color: '',
      exams: [],
    };
    if (!subjectObj.name) return subjects;
    subjects.push(subjectObj);
  }

  subjectObj.exams.push({
    id: `exam-${makeId()}`,
    subjectId: subjectObj.id,
    name,
    grade,
    date,
    type,
    weight,
  });
  writeData(SUBJECTS_FILE, subjects);
  return subjects;
});

ipcMain.handle('create-subject', (event, { name, color }) => {
  const subjectName = String(name || '').trim();
  if (!subjectName) return readData(SUBJECTS_FILE);

  const subjects = normalizeSubjectsData(readData(SUBJECTS_FILE));
  const existing = subjects.find((s) => s.name === subjectName);
  if (existing) {
    if (typeof color === 'string' && color.trim()) {
      existing.color = color.trim();
      writeData(SUBJECTS_FILE, subjects);
    }
    return subjects;
  }

  subjects.push({
    id: `subject-${makeId()}`,
    name: subjectName,
    color: typeof color === 'string' ? color.trim() : '',
    exams: [],
  });
  writeData(SUBJECTS_FILE, subjects);
  return subjects;
});

ipcMain.handle('update-subject-color', (event, { subjectName, color }) => {
  const subjects = normalizeSubjectsData(readData(SUBJECTS_FILE));
  const subject = subjects.find((s) => s.name === subjectName || s.id === subjectName);
  if (!subject) return subjects;
  subject.color = typeof color === 'string' ? color.trim() : '';
  writeData(SUBJECTS_FILE, subjects);
  return subjects;
});

ipcMain.handle('delete-exam', (event, { subjectName, subjectId, examIdx, examId }) => {
  const subjects = normalizeSubjectsData(readData(SUBJECTS_FILE));
  const subject = subjects.find((s) => s.id === subjectId || s.name === subjectName);

  if (subject && subject.exams) {
    if (examId) {
      subject.exams = subject.exams.filter((exam) => exam.id !== examId);
    } else {
      subject.exams.splice(examIdx, 1);
    }
  }

  writeData(SUBJECTS_FILE, subjects);
  return subjects;
});

ipcMain.handle('delete-subject', (event, subjectNameOrId) => {
  let subjects = normalizeSubjectsData(readData(SUBJECTS_FILE));
  subjects = subjects.filter((s) => s.name !== subjectNameOrId && s.id !== subjectNameOrId);
  writeData(SUBJECTS_FILE, subjects);
  return subjects;
});

ipcMain.handle('get-timetable', () => readData(TIMETABLE_FILE));
ipcMain.handle('save-timetable', (event, timetable) => {
  writeData(TIMETABLE_FILE, Array.isArray(timetable) ? timetable : []);
  return readData(TIMETABLE_FILE);
});

ipcMain.handle('get-grades', () => readData(GRADES_FILE));
ipcMain.handle('save-grade', (event, grade) => {
  const grades = readData(GRADES_FILE);
  const entry = {
    ...grade,
    id: grade?.id || `grade-${makeId()}`,
    subjectId: grade?.subjectId || null,
    value: Number(grade?.value ?? grade?.grade ?? 0),
    weight: Number(grade?.weight ?? 1) || 1,
    date: grade?.date || new Date().toISOString().split('T')[0],
  };
  const index = grades.findIndex((item) => item.id === entry.id);
  if (index >= 0) grades[index] = entry;
  else grades.push(entry);
  writeData(GRADES_FILE, grades);
  return grades;
});

ipcMain.handle('get-study-sessions', () => readData(STUDY_SESSIONS_FILE));
ipcMain.handle('save-study-session', (event, session) => {
  const sessions = readData(STUDY_SESSIONS_FILE);
  const entry = {
    ...session,
    id: session?.id || `study-${makeId()}`,
    subjectId: session?.subjectId || null,
    durationMinutes: Number(session?.durationMinutes ?? 0),
    date: session?.date || new Date().toISOString().split('T')[0],
  };
  const index = sessions.findIndex((item) => item.id === entry.id);
  if (index >= 0) sessions[index] = entry;
  else sessions.push(entry);
  writeData(STUDY_SESSIONS_FILE, sessions);
  return sessions;
});

// Profile management
ipcMain.handle('get-profile', (event, userId) => {
  const profiles = readData(PROFILES_FILE);
  const profile = profiles.find((p) => p.userId === userId);
  if (profile) return profile;
  return { userId, displayName: null, nameSet: false, createdAt: new Date().toISOString() };
});

ipcMain.handle('set-profile-name', (event, { userId, displayName }) => {
  const profiles = readData(PROFILES_FILE);
  const profile = profiles.find((p) => p.userId === userId);
  
  if (profile && profile.nameSet) {
    return { success: false, error: 'Profile name can only be set once' };
  }
  
  const entry = profile || { userId, createdAt: new Date().toISOString() };
  entry.displayName = String(displayName || '').trim() || userId;
  entry.nameSet = true;
  entry.updatedAt = new Date().toISOString();
  
  const index = profiles.findIndex((p) => p.userId === userId);
  if (index >= 0) profiles[index] = entry;
  else profiles.push(entry);
  
  writeData(PROFILES_FILE, profiles);
  return { success: true, profile: entry };
});

ipcMain.handle('get-all-profiles', () => {
  return readData(PROFILES_FILE);
});

ipcMain.handle('admin-change-profile-name', (event, { adminId, targetUserId, displayName }) => {
  const ADMIN_IDS = ['eviro-0hj6tqby', 'eviro-hmg2dum8'];
  if (!ADMIN_IDS.includes(adminId)) {
    return { success: false, error: 'Unauthorized' };
  }
  
  const profiles = readData(PROFILES_FILE);
  const profile = profiles.find((p) => p.userId === targetUserId);
  
  if (!profile) {
    return { success: false, error: 'User profile not found' };
  }
  
  profile.displayName = String(displayName || '').trim() || targetUserId;
  profile.updatedAt = new Date().toISOString();
  
  writeData(PROFILES_FILE, profiles);
  return { success: true, profile };
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window-toggle-maximize', () => {
  if (!mainWindow) {
    return { isMaximized: false };
  }

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return { isMaximized: false };
  }

  mainWindow.maximize();
  return { isMaximized: true };
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('window-is-maximized', () => {
  if (!mainWindow) {
    return false;
  }
  return mainWindow.isMaximized();
});

const createWindow = () => {
  mainWindow = new BrowserWindow({
    title: 'Eviro',
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#e7eef2',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
