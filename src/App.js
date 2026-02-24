import React, { useState, useEffect, useMemo, useRef } from 'react';
import Peer from 'peerjs';
import './App.css';
import NotesList from './components/NotesList';
import TasksList from './components/TasksList';
import TasksCalendar from './components/TasksCalendar';
import GradesList from './components/GradesList';
import Editor from './components/Editor';
import GradeEditor from './components/GradeEditor';
import SplashScreen from './components/SplashScreen';
import TimetableManager from './components/TimetableManager';
import SubjectPage from './components/SubjectPage';
import ProfileModal from './components/ProfileModal';
import ProfileIcon from './components/ProfileIcon';
import { getSubjectByIdFromList } from './utils/subjects';
import WorkloadHeatmap from './components/WorkloadHeatmap';
import {
  getDailyWorkload,
  getStudyRecommendations,
  getStudyStats,
  normalizeGradeRecords,
  resolveRange,
} from './utils/academicIntelligence';
import { parseImportedNoteFile } from './utils/oneNoteImport';

const PERIOD_SLOTS = [
  { key: 0, start: '07:30', end: '08:15' },
  { key: 1, start: '08:15', end: '09:00' },
  { key: 2, start: '09:05', end: '09:50' },
  { key: 3, start: '10:05', end: '10:50' },
  { key: 4, start: '10:55', end: '11:40' },
  { key: 5, start: '11:55', end: '12:40' },
  { key: 6, start: '12:40', end: '13:25' },
  { key: 7, start: '13:25', end: '14:10' },
  { key: 8, start: '14:10', end: '14:55' },
  { key: 9, start: '15:00', end: '15:45' },
  { key: 10, start: '16:00', end: '16:45' },
  { key: 11, start: '16:45', end: '17:30' },
];

const DAY_TO_INDEX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const TabIcon = ({ name }) => {
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'home') return <svg {...common}><path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
  if (name === 'notes') return <svg {...common}><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4" /><path d="M10 12h6M10 16h6" /></svg>;
  if (name === 'tasks') return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 12l3 3 5-6" /></svg>;
  if (name === 'calendar') return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
  if (name === 'timetable') return <svg {...common}><path d="M4 5h16v14H4z" /><path d="M8 5v14M16 5v14M4 10h16M4 15h16" /></svg>;
  return <svg {...common}><path d="M4 8h16" /><path d="M6 8v10h12V8" /><path d="M9 8V6h6v2" /></svg>;
};

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedId, setSelectedId] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [noteFolders, setNoteFolders] = useState([]);
  const [taskFolders, setTaskFolders] = useState([]);
  const [selectedNoteFolderId, setSelectedNoteFolderId] = useState(null);
  const [selectedTaskFolderId, setSelectedTaskFolderId] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [grades, setGrades] = useState([]);
  const [studySessions, setStudySessions] = useState([]);
  const [studyRecommendations, setStudyRecommendations] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [gradeEditorVersion, setGradeEditorVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [logoVisible, setLogoVisible] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [studyPreset, setStudyPreset] = useState(25 * 60);
  const [studySeconds, setStudySeconds] = useState(25 * 60);
  const [studyRunning, setStudyRunning] = useState(false);
  const [customStudyMinutes, setCustomStudyMinutes] = useState('25');
  const [isEditingStudyTime, setIsEditingStudyTime] = useState(false);
  const [studyGoalMinutes, setStudyGoalMinutes] = useState(240);
  const [isEditingStudyGoal, setIsEditingStudyGoal] = useState(false);
  const [customGoalMinutes, setCustomGoalMinutes] = useState('240');
  const [timeTheme, setTimeTheme] = useState('day');
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState(null);
  const [profileNameSet, setProfileNameSet] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [allProfiles, setAllProfiles] = useState([]);
  const [shareStatus, setShareStatus] = useState('offline');
  const [shareTargetId, setShareTargetId] = useState('');
  const [incomingShareRequest, setIncomingShareRequest] = useState(null);
  const goalInputRef = useRef(null);
  const searchWrapRef = useRef(null);
  const searchInputRef = useRef(null);
  const studyTimeInputRef = useRef(null);
  const peerRef = useRef(null);
  const incomingConnRef = useRef(null);

  const makeUserId = () => `eviro-${Math.random().toString(36).slice(2, 10)}`;
  const buildSharedNote = (incoming) => {
    const now = new Date().toISOString();
    return {
      id: `shared-${Date.now()}`,
      title: incoming.title ? `[Shared] ${incoming.title}` : '[Shared] Note',
      content: incoming.content || '',
      tags: Array.isArray(incoming.tags) ? incoming.tags : ['shared'],
      noteColor: incoming.noteColor || '#e8f3f7',
      images: Array.isArray(incoming.images) ? incoming.images : [],
      noteBlocks: Array.isArray(incoming.noteBlocks) ? incoming.noteBlocks : [],
      noteCanvasSize: incoming.noteCanvasSize || { width: 1200, height: 900 },
      subjectId: null,
      folderId: null,
      createdAt: now,
      updatedAt: now,
    };
  };

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatLocalDate = (dateStr) => {
    const parsedDate = parseLocalDate(dateStr);
    if (!parsedDate) return '';
    return parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getSubjectById = (subjectId) => getSubjectByIdFromList(subjects, subjectId);
  const allExams = useMemo(
    () =>
      subjects.flatMap((subject) =>
        (subject.exams || []).map((exam) => ({
          ...exam,
          subjectId: exam.subjectId || subject.id,
          title: exam.name || `${subject.name} Exam`,
        }))
      ),
    [subjects]
  );
  const normalizedGrades = useMemo(() => normalizeGradeRecords(grades, subjects), [grades, subjects]);

  const getRelativeDateLabel = (dateStr) => {
    const parsedDate = parseLocalDate(dateStr);
    if (!parsedDate) return '';

    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetOnly = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
    const diffDays = Math.round((targetOnly - todayOnly) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays > 1 && diffDays < 7) {
      return targetOnly.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return formatLocalDate(dateStr);
  };

  useEffect(() => {
    const MIN_SPLASH_MS = 1400;
    let cancelled = false;

    const loadData = async () => {
      const minDelay = new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS));
      const loadFromDisk = (async () => {
        if (window.electron && window.electron.ipcRenderer) {
          const [
            notesData,
            tasksData,
            subjectsData,
            timetableData,
            gradesData,
            studySessionsData,
            noteFoldersData,
            taskFoldersData,
            maximized,
          ] = await Promise.all([
            window.electron.ipcRenderer.invoke('get-notes'),
            window.electron.ipcRenderer.invoke('get-tasks'),
            window.electron.ipcRenderer.invoke('get-subjects'),
            window.electron.ipcRenderer.invoke('get-timetable'),
            window.electron.ipcRenderer.invoke('get-grades'),
            window.electron.ipcRenderer.invoke('get-study-sessions'),
            window.electron.ipcRenderer.invoke('get-note-folders'),
            window.electron.ipcRenderer.invoke('get-task-folders'),
            window.electron.ipcRenderer.invoke('window-is-maximized'),
          ]);
          const normalizedSubjects = (Array.isArray(subjectsData) ? subjectsData : [])
            .map((subject, idx) => {
              const resolvedSubjectId = subject.id || `subject-${idx}-${Date.now()}`;
              return {
                id: resolvedSubjectId,
                name: subject.name || '',
                color: subject.color || '',
                exams: (subject.exams || []).map((exam, examIdx) => ({
                  ...exam,
                  id: exam.id || `exam-${idx}-${examIdx}-${Date.now()}`,
                  subjectId: exam.subjectId || resolvedSubjectId,
                })),
              };
            })
            .filter((subject) => subject.name);
          setNotes((Array.isArray(notesData) ? notesData : []).map((note) => ({ ...note, subjectId: note.subjectId ?? null, folderId: note.folderId ?? null })));
          setTasks((Array.isArray(tasksData) ? tasksData : []).map((task) => ({ ...task, subjectId: task.subjectId ?? null, folderId: task.folderId ?? null })));
          setNoteFolders(Array.isArray(noteFoldersData) ? noteFoldersData : []);
          setTaskFolders(Array.isArray(taskFoldersData) ? taskFoldersData : []);
          setSubjects(normalizedSubjects);
          setTimetable(Array.isArray(timetableData) ? timetableData : []);
          setGrades(Array.isArray(gradesData) ? gradesData : []);
          setStudySessions(Array.isArray(studySessionsData) ? studySessionsData : []);
          setIsMaximized(!!maximized);
        }
      })();

      try {
        await Promise.all([minDelay, loadFromDisk]);
      } catch {
        // Keep startup resilient even if data load fails.
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const bootSplash = document.getElementById('boot-splash');
    if (!bootSplash) return;
    bootSplash.classList.add('boot-splash-hide');
    const timerId = setTimeout(() => {
      bootSplash.remove();
    }, 260);
    return () => clearTimeout(timerId);
  }, [isLoading]);

  useEffect(() => {
    if (!studyRunning) return undefined;
    const intervalId = setInterval(() => {
      setStudySeconds((prev) => {
        if (prev <= 1) {
          setStudyRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [studyRunning]);

  useEffect(() => {
    const updateTheme = () => {
      const hour = new Date().getHours();
      if (hour >= 22 || hour < 6) setTimeTheme('night');
      else if (hour >= 18) setTimeTheme('evening');
      else if (hour >= 6 && hour < 12) setTimeTheme('morning');
      else setTimeTheme('day');
    };
    updateTheme();
    const interval = setInterval(updateTheme, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const storedId = localStorage.getItem('eviro-user-id');
    const resolved = storedId || makeUserId();
    if (!storedId) localStorage.setItem('eviro-user-id', resolved);
    setUserId(resolved);
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('get-profile', userId).then((profile) => {
        if (profile) {
          setDisplayName(profile.displayName || null);
          setProfileNameSet(profile.nameSet || false);
        }
      });
      window.electron.ipcRenderer.invoke('get-all-profiles').then((profiles) => {
        if (Array.isArray(profiles)) {
          setAllProfiles(profiles);
        }
      });
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    const peer = new Peer(userId);
    peerRef.current = peer;
    peer.on('open', () => setShareStatus('online'));
    peer.on('error', (err) => {
      setShareStatus('error');
      console.error('Peer error:', err);
    });
    peer.on('disconnected', () => setShareStatus('offline'));
    peer.on('connection', (conn) => {
      conn.on('data', (payload) => {
        if (!payload) return;
        if (payload.type === 'share-request') {
          incomingConnRef.current = conn;
          setIncomingShareRequest({
            from: payload.from || conn.peer || 'unknown',
            note: payload.note || {},
          });
        } else if (payload.type === 'profile-update') {
          setAllProfiles((prevProfiles) => {
            const idx = prevProfiles.findIndex((p) => p.userId === payload.userId);
            if (idx !== -1) {
              const updated = [...prevProfiles];
              updated[idx] = { ...updated[idx], displayName: payload.displayName };
              return updated;
            }
            return prevProfiles;
          });
        }
      });
    });
    return () => {
      try {
        peer.destroy();
      } catch {
        // noop
      }
      peerRef.current = null;
    };
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isEditingStudyTime) return;
    studyTimeInputRef.current?.focus();
    studyTimeInputRef.current?.select();
  }, [isEditingStudyTime]);

  useEffect(() => {
    if (!isEditingStudyGoal) return;
    goalInputRef.current?.focus();
    goalInputRef.current?.select();
  }, [isEditingStudyGoal]);

  const handleSaveNote = (note) => {
    if (window.electron && window.electron.ipcRenderer) {
      const noteToSave = { ...note, subjectId: note?.subjectId ?? null, folderId: note?.folderId ?? null, updatedAt: new Date().toISOString() };
      window.electron.ipcRenderer.invoke('save-note', noteToSave).then((updated) => {
        setNotes((Array.isArray(updated) ? updated : []).map((entry) => ({ ...entry, subjectId: entry.subjectId ?? null, folderId: entry.folderId ?? null })));
        setSelectedId(noteToSave.id);
      });
    }
  };

  const handleDeleteNote = (id) => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('delete-note', id).then((updated) => {
        setNotes(updated);
        if (selectedId === id) setSelectedId(null);
      });
    }
  };

  const handleSaveTask = (task) => {
    if (window.electron && window.electron.ipcRenderer) {
      const taskToSave = { ...task, subjectId: task?.subjectId ?? null, folderId: task?.folderId ?? null, updatedAt: new Date().toISOString() };
      window.electron.ipcRenderer.invoke('save-task', taskToSave).then((updated) => {
        setTasks((Array.isArray(updated) ? updated : []).map((entry) => ({ ...entry, subjectId: entry.subjectId ?? null, folderId: entry.folderId ?? null })));
        setSelectedId(taskToSave.id);
      });
    }
  };

  const handleSaveNoteFolder = (folder) => {
    const normalized = {
      id: folder?.id || `folder-${Date.now()}`,
      name: String(folder?.name || '').trim() || 'New Folder',
      parentId: folder?.parentId || null,
    };
    setNoteFolders((prev) => {
      const idx = prev.findIndex((entry) => entry.id === normalized.id);
      if (idx < 0) return [...prev, normalized];
      const copy = [...prev];
      copy[idx] = normalized;
      return copy;
    });
    if (!window.electron?.ipcRenderer) return;
    window.electron.ipcRenderer.invoke('save-note-folder', normalized).then((updated) => {
      setNoteFolders(Array.isArray(updated) ? updated : []);
    }).catch(() => {});
  };

  const handleSaveTaskFolder = (folder) => {
    const normalized = {
      id: folder?.id || `folder-${Date.now()}`,
      name: String(folder?.name || '').trim() || 'New Folder',
      parentId: folder?.parentId || null,
    };
    setTaskFolders((prev) => {
      const idx = prev.findIndex((entry) => entry.id === normalized.id);
      if (idx < 0) return [...prev, normalized];
      const copy = [...prev];
      copy[idx] = normalized;
      return copy;
    });
    if (!window.electron?.ipcRenderer) return;
    window.electron.ipcRenderer.invoke('save-task-folder', normalized).then((updated) => {
      setTaskFolders(Array.isArray(updated) ? updated : []);
    }).catch(() => {});
  };

  const handleDeleteNoteFolder = (folderId) => {
    if (!window.electron?.ipcRenderer) return;
    window.electron.ipcRenderer.invoke('delete-note-folder', folderId).then((updated) => {
      const nextFolders = Array.isArray(updated?.folders) ? updated.folders : [];
      setNoteFolders(nextFolders);
      setNotes((Array.isArray(updated?.notes) ? updated.notes : []).map((entry) => ({ ...entry, subjectId: entry.subjectId ?? null, folderId: entry.folderId ?? null })));
      if (selectedNoteFolderId && !nextFolders.some((folder) => folder.id === selectedNoteFolderId)) setSelectedNoteFolderId(null);
    });
  };

  const handleDeleteTaskFolder = (folderId) => {
    if (!window.electron?.ipcRenderer) return;
    window.electron.ipcRenderer.invoke('delete-task-folder', folderId).then((updated) => {
      const nextFolders = Array.isArray(updated?.folders) ? updated.folders : [];
      setTaskFolders(nextFolders);
      setTasks((Array.isArray(updated?.tasks) ? updated.tasks : []).map((entry) => ({ ...entry, subjectId: entry.subjectId ?? null, folderId: entry.folderId ?? null })));
      if (selectedTaskFolderId && !nextFolders.some((folder) => folder.id === selectedTaskFolderId)) setSelectedTaskFolderId(null);
    });
  };

  const handleDeleteTask = (id) => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('delete-task', id).then((updated) => {
        setTasks(updated);
        if (selectedId === id) setSelectedId(null);
      });
    }
  };

  const handleToggleTask = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    handleSaveTask({ ...task, completed: !task.completed });
  };

  const handleSaveExam = (examData) => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('save-exam', examData).then((updated) => {
        setSubjects(updated);
        const targetSubject =
          updated.find((subject) => subject.id === examData.subjectId) ||
          updated.find((subject) => subject.name === examData.subject);
        setSelectedSubjectId(targetSubject?.id || null);
        if (targetSubject?.id && Number.isFinite(Number(examData.grade))) {
          window.electron.ipcRenderer
            .invoke('save-grade', {
              subjectId: targetSubject.id,
              value: Number(examData.grade),
              weight: Number(examData.weight) || 1,
              date: examData.date,
            })
            .then((gradeRows) => setGrades(Array.isArray(gradeRows) ? gradeRows : []));
        }
      });
    }
  };

  const handleCreateSubject = (subjectName) => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('create-subject', { name: subjectName }).then((updated) => {
        setSubjects(updated);
        const created = updated.find((subject) => subject.name === subjectName);
        if (created) {
          setSelectedSubjectId(created.id);
          setActiveTab('subject');
        } else {
          setActiveTab('grades');
        }
      });
    }
  };

  const handleUpdateSubjectColor = (subjectId, color) => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('update-subject-color', { subjectName: subjectId, color }).then((updated) => {
        setSubjects(updated);
      });
    }
  };

  const handleDeleteExam = (subjectId, examIdx, examId) => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('delete-exam', { subjectId, examIdx, examId }).then((updated) => {
        setSubjects(updated);
      });
    }
  };

  const handleDeleteSubject = (subjectId) => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('delete-subject', subjectId).then((updated) => {
        setSubjects(updated);
        setSelectedSubjectId(null);
      });
    }
  };

  const handleNewExam = () => {
    setSelectedSubjectId(null);
    setGradeEditorVersion((prev) => prev + 1);
  };

  const handleNewNote = () => {
    const newNote = {
      id: Date.now().toString(),
      title: 'Untitled Note',
      content: '',
      subjectId: null,
      folderId: selectedNoteFolderId,
      createdAt: new Date().toISOString(),
    };
    setNotes((prev) => [newNote, ...prev]);
    setSelectedId(newNote.id);
  };

  const handleImportOneNoteFile = async (file) => {
    if (!file) return;
    const now = new Date().toISOString();
    const importId = `import-${Date.now()}`;
    const baseTitle = String(file.name || 'Imported file').replace(/\.[^.]+$/, '') || 'Imported Note';
    const pendingNote = {
      id: importId,
      title: `${baseTitle} (importing...)`,
      content: 'Import in progress...',
      tags: ['imported'],
      noteColor: '#e8f3f7',
      images: [],
      noteBlocks: [
        {
          id: `txt-${Date.now()}`,
          type: 'text',
          x: 24,
          y: 24,
          width: 620,
          height: 220,
          text: 'Import in progress...',
          textColor: '#1f2f4a',
          fontSize: 16,
          src: '',
        },
      ],
      noteCanvasSize: { width: 1200, height: 900 },
      subjectId: null,
      folderId: selectedNoteFolderId,
      createdAt: now,
      updatedAt: now,
    };
    handleSaveNote(pendingNote);
    setActiveTab('notes');
    setSelectedId(importId);

    try {
      const parsed = await parseImportedNoteFile(file);
      const importedNote = {
        ...pendingNote,
        id: importId,
        title: parsed.title || 'Imported Note',
        content: parsed.content || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : ['imported'],
        noteBlocks: Array.isArray(parsed.pageImages) && parsed.pageImages.length
          ? parsed.pageImages.map((page, idx) => ({
              id: `img-${Date.now()}-${idx}`,
              type: 'image',
              x: 40,
              y: 40 + idx * (page.height + 36),
              width: page.width,
              height: page.height,
              text: '',
              textColor: '#1f2f4a',
              fontSize: 16,
              src: page.src,
            }))
          : [
              {
                id: `txt-${Date.now()}`,
                type: 'text',
                x: 24,
                y: 24,
                width: 620,
                height: 360,
                text: parsed.content || '',
                textColor: '#1f2f4a',
                fontSize: 16,
                src: '',
              },
            ],
        noteCanvasSize: Array.isArray(parsed.pageImages) && parsed.pageImages.length
          ? {
              width: Math.max(1200, Math.max(...parsed.pageImages.map((page) => page.width + 80))),
              height: Math.max(
                900,
                parsed.pageImages.reduce((sum, page) => sum + page.height, 0) + (parsed.pageImages.length - 1) * 36 + 120
              ),
            }
          : pendingNote.noteCanvasSize,
        updatedAt: new Date().toISOString(),
      };
      handleSaveNote(importedNote);
      setActiveTab('notes');
    } catch (error) {
      const message = error?.message || 'Unknown parse error';
      const failedNote = {
        ...pendingNote,
        id: importId,
        title: `${baseTitle} (import failed)`,
        content: `Could not import this file as editable text.\n\nReason: ${message}\n\nTry another PDF or a text-based format.`,
        noteBlocks: [
          {
            id: `txt-${Date.now()}`,
            type: 'text',
            x: 24,
            y: 24,
            width: 700,
            height: 280,
            text: `Could not import this file as editable text.\n\nReason: ${message}\n\nTry another PDF or a text-based format.`,
            textColor: '#1f2f4a',
            fontSize: 16,
            src: '',
          },
        ],
        updatedAt: new Date().toISOString(),
      };
      handleSaveNote(failedNote);
    }
  };

  const handleNewTask = () => {
    const newTask = {
      id: Date.now().toString(),
      title: 'New Task',
      description: '',
      completed: false,
      subjectId: null,
      folderId: selectedTaskFolderId,
      dueDate: '',
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
    setSelectedId(newTask.id);
  };

  const handleSaveTimetable = (entries) => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('save-timetable', entries).then((updated) => {
        setTimetable(Array.isArray(updated) ? updated : []);
      });
    }
  };

  const handleLogStudySession = (subjectId, durationMinutes) => {
    if (!subjectId || !window.electron?.ipcRenderer) return;
    window.electron.ipcRenderer
      .invoke('save-study-session', {
        subjectId,
        durationMinutes: Number(durationMinutes) || 0,
        date: getDateKey(new Date()),
      })
      .then((rows) => setStudySessions(Array.isArray(rows) ? rows : []));
  };

  const generateStudyRecommendations = () => {
    const next = getStudyRecommendations({
      subjects,
      tasks,
      exams: allExams,
      grades: normalizedGrades,
      today: new Date(),
    });
    setStudyRecommendations(next);
  };

  const tabs = useMemo(
    () => [
      { id: 'home', icon: 'home', label: 'Home' },
      { id: 'notes', icon: 'notes', label: 'Notes' },
      { id: 'tasks', icon: 'tasks', label: 'Tasks' },
      { id: 'calendar', icon: 'calendar', label: 'Calendar' },
      { id: 'timetable', icon: 'timetable', label: 'Timetable' },
      { id: 'grades', icon: 'grades', label: 'Grades' },
    ],
    []
  );

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedId(null);
    if (tabId !== 'grades' && tabId !== 'subject') setSelectedSubjectId(null);
  };

  useEffect(() => {
    const handleGlobalShortcuts = (event) => {
      const targetTag = event.target?.tagName?.toLowerCase();
      const isTypingTarget = ['input', 'textarea', 'select'].includes(targetTag);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !isTypingTarget && /^[1-6]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const tab = tabs[index];
        if (tab) {
          event.preventDefault();
          handleTabChange(tab.id);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        handleTabChange('notes');
        handleNewNote();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        handleTabChange('tasks');
        handleNewTask();
        return;
      }

      if (event.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [tabs]);

  const handleWindowAction = async (action) => {
    if (!window.electron || !window.electron.ipcRenderer) return;
    const result = await window.electron.ipcRenderer.invoke(action);
    if (action === 'window-toggle-maximize') setIsMaximized(!!result?.isMaximized);
  };

  const getFolderSubtreeIds = (folders, rootId) => {
    if (!rootId) return null;
    const ids = new Set([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of folders) {
        if (folder?.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
          ids.add(folder.id);
          changed = true;
        }
      }
    }
    return ids;
  };

  const noteFolderScope = useMemo(
    () => getFolderSubtreeIds(noteFolders, selectedNoteFolderId),
    [noteFolders, selectedNoteFolderId]
  );
  const taskFolderScope = useMemo(
    () => getFolderSubtreeIds(taskFolders, selectedTaskFolderId),
    [taskFolders, selectedTaskFolderId]
  );

  const filteredNotes = useMemo(() => {
    if (!noteFolderScope) return notes;
    return notes.filter((note) => note.folderId && noteFolderScope.has(note.folderId));
  }, [notes, noteFolderScope]);

  const filteredTasks = useMemo(() => {
    if (!taskFolderScope) return tasks;
    return tasks.filter((task) => task.folderId && taskFolderScope.has(task.folderId));
  }, [tasks, taskFolderScope]);

  const currentList = activeTab === 'notes' ? filteredNotes : activeTab === 'tasks' ? filteredTasks : [];
  const selectedItem = currentList.find((item) => item.id === selectedId);
  const todayDateStr = getDateKey(new Date());

  const todayTasks = useMemo(() => tasks.filter((task) => task.dueDate === todayDateStr), [tasks, todayDateStr]);

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.dueDate && task.dueDate >= todayDateStr && !task.completed)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 3),
    [tasks, todayDateStr]
  );

  const recentNotes = useMemo(
    () =>
      [...notes]
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime()
        )
        .slice(0, 3),
    [notes]
  );

  const weeklyStudyRange = useMemo(() => resolveRange('last7days'), []);
  const previousWeeklyRange = useMemo(() => {
    const end = new Date(weeklyStudyRange.start.getTime() - 1);
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { start, end };
  }, [weeklyStudyRange]);

  const weeklySubjectStats = useMemo(
    () =>
      subjects.map((subject) => ({
        subject,
        current: getStudyStats(subject.id, weeklyStudyRange, studySessions),
        previous: getStudyStats(subject.id, previousWeeklyRange, studySessions),
      })),
    [subjects, studySessions, weeklyStudyRange, previousWeeklyRange]
  );

  const totalStudyThisWeek = useMemo(
    () => weeklySubjectStats.reduce((sum, item) => sum + item.current.totalMinutes, 0),
    [weeklySubjectStats]
  );
  const mostStudied = useMemo(
    () => [...weeklySubjectStats].sort((a, b) => b.current.totalMinutes - a.current.totalMinutes)[0] || null,
    [weeklySubjectStats]
  );

  const next28DayWorkload = useMemo(() => {
    const start = new Date();
    const end = new Date(start.getTime() + 27 * 24 * 60 * 60 * 1000);
    return getDailyWorkload({ startDate: start, endDate: end, tasks, exams: allExams, timetable });
  }, [tasks, allExams, timetable]);

  const next7DayPressure = useMemo(() => {
    const next7 = next28DayWorkload.slice(0, 7);
    if (!next7.length) return 0;
    return Math.round(next7.reduce((sum, day) => sum + day.workload, 0) / next7.length);
  }, [next28DayWorkload]);

  const nextClass = useMemo(() => {
    if (!Array.isArray(timetable) || timetable.length === 0) return null;
    const now = new Date();
    const todayDay = now.getDay();

    const candidates = timetable
      .map((entry) => {
        if (!entry?.subject || entry.period === undefined || !entry.day) return null;
        const dayIndex = DAY_TO_INDEX[entry.day];
        const slot = PERIOD_SLOTS.find((item) => item.key === Number(entry.period));
        if (dayIndex === undefined || !slot) return null;

        let diff = dayIndex - todayDay;
        if (diff < 0) diff += 7;

        const startsAt = new Date(now);
        startsAt.setDate(now.getDate() + diff);
        const [hh, mm] = slot.start.split(':').map(Number);
        startsAt.setHours(hh, mm, 0, 0);

        if (startsAt < now) startsAt.setDate(startsAt.getDate() + 7);

        return {
          subject: entry.subject,
          day: entry.day,
          period: entry.period,
          start: slot.start,
          end: slot.end,
          startsAt: startsAt.getTime(),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.startsAt - b.startsAt);

    return candidates[0] || null;
  }, [timetable]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const byText = (value) => String(value || '').toLowerCase().includes(query);
    const results = [];

    notes.forEach((note) => {
      if (byText(note.title) || byText(note.content) || (note.tags || []).some((tag) => byText(tag))) {
        results.push({
          id: `note-${note.id}`,
          type: 'Note',
          title: note.title || 'Untitled note',
          subtitle: (note.content || '').slice(0, 90),
          onOpen: () => {
            handleTabChange('notes');
            setSelectedId(note.id);
          },
        });
      }
    });

    tasks.forEach((task) => {
      if (byText(task.title) || byText(task.description) || byText(task.dueDate)) {
        results.push({
          id: `task-${task.id}`,
          type: 'Task',
          title: task.title || 'Untitled task',
          subtitle: task.dueDate ? `Due ${task.dueDate}` : task.description || '',
          onOpen: () => {
            handleTabChange('tasks');
            setSelectedId(task.id);
          },
        });
      }
    });

    subjects.forEach((subject) => {
      if (byText(subject.name)) {
        results.push({
          id: `subject-${subject.id}`,
          type: 'Subject',
          title: subject.name,
          subtitle: `${subject.exams?.length || 0} exams`,
          onOpen: () => {
            setSelectedSubjectId(subject.id);
            setActiveTab('subject');
          },
        });
      }

      (subject.exams || []).forEach((exam, idx) => {
        if (byText(exam.name) || byText(exam.type) || byText(exam.date)) {
          results.push({
            id: `exam-${subject.id}-${exam.id || idx}`,
            type: 'Exam',
            title: exam.name || subject.name,
            subtitle: `${subject.name} - grade ${exam.grade}`,
            onOpen: () => {
              setSelectedSubjectId(subject.id);
              setActiveTab('grades');
            },
          });
        }
      });
    });

    timetable.forEach((entry, idx) => {
      if (byText(entry.subject) || byText(entry.day) || byText(entry.period)) {
        results.push({
          id: `tt-${idx}`,
          type: 'Timetable',
          title: entry.subject || 'Timetable block',
          subtitle: `${entry.day || ''} - period ${entry.period ?? '-'}`,
          onOpen: () => handleTabChange('timetable'),
        });
      }
    });

    return results.slice(0, 80);
  }, [searchQuery, notes, tasks, subjects, timetable]);

  const openSearchResult = (result) => {
    result.onOpen();
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const formatTimer = (seconds) => {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const formatMinutes = (minutes) => {
    const value = Number(minutes) || 0;
    if (value < 60) return `${value}m`;
    const h = Math.floor(value / 60);
    const m = value % 60;
    return `${h}h ${m}m`;
  };

  const handleSelectPreset = (minutes) => {
    const next = minutes * 60;
    setStudyPreset(next);
    setStudySeconds(next);
    setStudyRunning(false);
    setCustomStudyMinutes(String(minutes));
    setIsEditingStudyTime(false);
  };;

  const handleApplyCustomStudy = () => {
    const parsed = Number(customStudyMinutes);
    if (!Number.isFinite(parsed)) return;
    const minutes = Math.max(1, Math.min(120, Math.round(parsed)));
    const next = minutes * 60;
    setCustomStudyMinutes(String(minutes));
    setStudyPreset(next);
    setStudySeconds(next);
    setStudyRunning(false);
  };

  const beginStudyTimeEdit = () => {
    const currentMinutes = Math.max(1, Math.round(studySeconds / 60));
    setCustomStudyMinutes(String(currentMinutes));
    setStudyRunning(false);
    setIsEditingStudyTime(true);
  };

  const commitStudyTimeEdit = () => {
    handleApplyCustomStudy();
    setIsEditingStudyTime(false);
  };

  const cancelStudyTimeEdit = () => {
    setCustomStudyMinutes(String(Math.max(1, Math.round(studySeconds / 60))));
    setIsEditingStudyTime(false);
  };

  const beginStudyGoalEdit = () => {
    setCustomGoalMinutes(String(studyGoalMinutes));
    setIsEditingStudyGoal(true);
  };

  const commitStudyGoalEdit = () => {
    const parsed = Number(customGoalMinutes);
    if (!Number.isFinite(parsed)) return;
    const minutes = Math.max(30, Math.min(1440, Math.round(parsed)));
    setCustomGoalMinutes(String(minutes));
    setStudyGoalMinutes(minutes);
    setIsEditingStudyGoal(false);
  };

  const cancelStudyGoalEdit = () => {
    setCustomGoalMinutes(String(studyGoalMinutes));
    setIsEditingStudyGoal(false);
  };

  const handleOpenCalendarTask = (taskId) => {
    setSelectedId(taskId);
    setActiveTab('tasks');
  };

  const handleOpenCalendarClass = () => {
    setSelectedId(null);
    setActiveTab('timetable');
  };

  const handleOpenCalendarExam = (event) => {
    setSelectedId(null);
    setSelectedSubjectId(event?.subjectId || null);
    setActiveTab('grades');
  };

  const handleOpenSubjectPage = (subjectId) => {
    if (!subjectId) return;
    setSelectedId(null);
    setSelectedSubjectId(subjectId);
    setActiveTab('subject');
  };

  const handleShareNote = (noteId) => {
    const note = notes.find((entry) => entry.id === noteId);
    if (!note) return;
    setShareStatus('prepare');
    if (!peerRef.current) {
      window.alert('Sharing is not ready yet. Wait a moment and try again.');
      return;
    }
    const targetIds = String(shareTargetId || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    
    if (targetIds.length === 0) {
      window.alert('Enter one or more target user IDs (separated by commas) in the sidebar first.');
      setShareStatus('online');
      return;
    }
    
    const shareData = {
      type: 'share-request',
      from: userId,
      note: {
        title: note.title,
        content: note.content,
        tags: note.tags || [],
        noteColor: note.noteColor || '#e8f3f7',
        images: note.images || [],
        noteBlocks: note.noteBlocks || [],
        noteCanvasSize: note.noteCanvasSize || { width: 1200, height: 900 },
      },
    };
    
    let successCount = 0;
    let errorCount = 0;
    let pendingCount = targetIds.length;
    
    setShareStatus('connecting');
    
    targetIds.forEach((targetId) => {
      const conn = peerRef.current.connect(targetId, { reliable: true });
      
      conn.on('open', () => {
        conn.send(shareData);
        setShareStatus('awaiting-approval');
      });
      
      conn.on('data', (payload) => {
        if (!payload || payload.type !== 'share-response') return;
        if (payload.accepted) {
          successCount++;
        } else {
          errorCount++;
        }
        pendingCount--;
        if (pendingCount === 0) {
          const message = `Sent to ${successCount} user${successCount !== 1 ? 's' : ''}${errorCount > 0 ? ` (${errorCount} rejected)` : ''}`;
          setShareStatus('accepted');
          setTimeout(() => setShareStatus('online'), 1600);
        }
        conn.close();
      });
      
      conn.on('error', (err) => {
        errorCount++;
        pendingCount--;
        console.error('Connection error:', err);
        if (pendingCount === 0) {
          const message = `Sent to ${successCount} user${successCount !== 1 ? 's' : ''}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`;
          setShareStatus('online');
        }
      });
    });
  };

  const handleRespondToShareRequest = (accepted) => {
    const conn = incomingConnRef.current;
    const request = incomingShareRequest;
    if (conn) {
      try {
        conn.send({ type: 'share-response', accepted: !!accepted });
      } catch {
        // noop
      }
    }
    if (accepted && request?.note) {
      const sharedNote = buildSharedNote(request.note);
      handleSaveNote(sharedNote);
      setActiveTab('notes');
      setSelectedId(sharedNote.id);
    }
    setIncomingShareRequest(null);
    incomingConnRef.current = null;
  };

  const handleSetProfileName = (displayNameValue) => {
    if (!displayNameValue || !userId) return;
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('set-profile-name', {
        userId,
        displayName: displayNameValue,
      }).then(() => {
        setDisplayName(displayNameValue);
        setProfileNameSet(true);
        setIsProfileModalOpen(false);
      });
    }
  };

  const handleAdminChangeProfileName = (targetUserId, newDisplayName) => {
    if (!userId || !newDisplayName) return;
    const adminIds = ['eviro-0hj6tqby', 'eviro-hmg2dum8'];
    if (!adminIds.includes(userId)) {
      window.alert('Only admin users can change other profiles.');
      return;
    }
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('admin-change-profile-name', {
        adminId: userId,
        userId: targetUserId,
        displayName: newDisplayName,
      }).then(() => {
        setAllProfiles((prevProfiles) => {
          const idx = prevProfiles.findIndex((p) => p.userId === targetUserId);
          if (idx !== -1) {
            const updated = [...prevProfiles];
            updated[idx] = { ...updated[idx], displayName: newDisplayName };
            return updated;
          }
          return prevProfiles;
        });
        if (peerRef.current && peerRef.current.open) {
          const peers = peerRef.current._connections || {};
          Object.values(peers).forEach((conns) => {
            if (Array.isArray(conns)) {
              conns.forEach((conn) => {
                try {
                  conn.send({
                    type: 'profile-update',
                    userId: targetUserId,
                    displayName: newDisplayName,
                  });
                } catch {
                  // noop
                }
              });
            }
          });
        }
      });
    }
  };

  useEffect(() => {
    if (activeTab === 'notes' && selectedId) {
      setIsSidebarCollapsed(true);
    }
  }, [activeTab, selectedId]);

  if (isLoading) {
    return <SplashScreen />;
  }

  const completedTaskCount = tasks.filter((task) => task.completed).length;
  const taskCompletionPct = tasks.length ? Math.round((completedTaskCount / tasks.length) * 100) : 0;
  const studyGoalPct = Math.min(100, Math.round((totalStudyThisWeek / studyGoalMinutes) * 100));
  const pressurePct = Math.min(100, Math.round((next7DayPressure / 180) * 100));
  const metricCards = [
    { key: 'tasks', label: 'Task Completion', valueLabel: `${taskCompletionPct}%`, pct: taskCompletionPct, type: 'ring' },
    { key: 'study', label: 'Weekly Study Goal', valueLabel: `${Math.min(totalStudyThisWeek, studyGoalMinutes)}m/${studyGoalMinutes}m`, pct: studyGoalPct, type: 'ring', clickable: true },
    { key: 'pressure', label: 'Next 7 Days Load', valueLabel: `${next7DayPressure} avg`, pct: pressurePct, type: 'bar' },
  ];

  return (
    <div className={`app-shell theme-${timeTheme}`}>
      <div className="window-chrome">
        <div className="window-drag-zone" />
        <div className="top-search-wrap no-drag" ref={searchWrapRef}>
          <div className="search-input-wrapper">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setIsSearchOpen(true);
              }}
              className="top-search-input"
              placeholder="Search"
            />
          </div>
          {isSearchOpen && (
            <div className="top-search-panel">
              <div className="search-results">
                {searchQuery.trim() && searchResults.length === 0 ? (
                  <div className="search-empty">No matches found. Try different keywords.</div>
                ) : searchQuery.trim() ? (
                  searchResults.map((result) => (
                    <button key={result.id} className="search-result-item" onClick={() => openSearchResult(result)}>
                      <span className="search-type">{result.type}</span>
                      <div className="search-main">
                        <strong>{result.title}</strong>
                        <small>{result.subtitle}</small>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="search-empty">Type to search everything. Use Ctrl/Cmd + 1..6 to switch tabs.</div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="window-controls no-drag">
          <button onClick={() => handleWindowAction('window-minimize')} title="Minimize">-</button>
          <button onClick={() => handleWindowAction('window-toggle-maximize')} title="Maximize">{isMaximized ? 'o' : '+'}</button>
          <button className="window-close" onClick={() => handleWindowAction('window-close')} title="Close">x</button>
        </div>
      </div>

      {incomingShareRequest && (
        <div className="share-request-overlay">
          <div className="share-request-modal">
            <h3>Incoming Share Request</h3>
            <p>Someone wants to send you a note.</p>
            <p><strong>From:</strong> {incomingShareRequest.from}</p>
            <p><strong>Title:</strong> {incomingShareRequest.note?.title || 'Shared Note'}</p>
            <div className="share-request-actions">
              <button type="button" className="accept-btn" onClick={() => handleRespondToShareRequest(true)}>Accept</button>
              <button type="button" className="reject-btn" onClick={() => handleRespondToShareRequest(false)}>Reject</button>
            </div>
          </div>
        </div>
      )}

      <div className={`app ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="brand-panel">
            {logoVisible ? (
              <img
                src={`${process.env.PUBLIC_URL}/app-logo-pure.png`}
                alt="App logo"
                className="brand-logo"
                onError={() => setLogoVisible(false)}
              />
            ) : (
              <div className="brand-mark">NT</div>
            )}
            <div className="brand-copy">
              <h1>Workspace</h1>
              <p>Notes, tasks, calendar, grades</p>
            </div>
            <ProfileIcon
              userId={userId}
              displayName={displayName}
              isAdmin={['eviro-0hj6tqby', 'eviro-hmg2dum8'].includes(userId)}
              onClick={() => setIsProfileModalOpen(true)}
            />
          </div>

          <nav className="tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <span className="tab-symbol"><TabIcon name={tab.icon} /></span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="list-container">
            {activeTab === 'home' ? (
              <div className="home-sidebar">
                <h3>Welcome back</h3>
                <p>Use Home for overview, then jump into notes, tasks, calendar, or grades.</p>
              </div>
            ) : activeTab === 'timetable' ? (
              <div className="home-sidebar">
                <h3>Timetable</h3>
                <p>Add custom schedule blocks for classes, work, sports, or anything else.</p>
              </div>
            ) : activeTab === 'notes' ? (
              <NotesList
                notes={filteredNotes}
                folders={noteFolders}
                selectedFolderId={selectedNoteFolderId}
                onSelectFolder={setSelectedNoteFolderId}
                onSaveFolder={handleSaveNoteFolder}
                onDeleteFolder={handleDeleteNoteFolder}
                getSubjectById={getSubjectById}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={handleDeleteNote}
                onNew={handleNewNote}
                onImportOneNote={handleImportOneNoteFile}
                onShareNote={handleShareNote}
                onOpenSubject={handleOpenSubjectPage}
              />
            ) : activeTab === 'tasks' ? (
              <TasksList
                tasks={filteredTasks}
                folders={taskFolders}
                selectedFolderId={selectedTaskFolderId}
                onSelectFolder={setSelectedTaskFolderId}
                onSaveFolder={handleSaveTaskFolder}
                onDeleteFolder={handleDeleteTaskFolder}
                getSubjectById={getSubjectById}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={handleDeleteTask}
                onNew={handleNewTask}
                onToggle={handleToggleTask}
                onOpenSubject={handleOpenSubjectPage}
              />
            ) : activeTab === 'grades' || activeTab === 'subject' ? (
              <GradesList
                subjects={subjects}
                selectedSubjectId={selectedSubjectId}
                onSelectSubject={setSelectedSubjectId}
                onDeleteExam={handleDeleteExam}
                onDeleteSubject={handleDeleteSubject}
                onNew={handleNewExam}
                onCreateSubject={handleCreateSubject}
                onOpenSubjectPage={handleOpenSubjectPage}
              />
            ) : null}
          </div>

          <div className="sidebar-footer">
            <div className="share-identity">
              <span>Your ID: {userId || '...'}</span>
              <button type="button" onClick={() => navigator.clipboard?.writeText(userId || '')} disabled={!userId}>
                Copy
              </button>
              <input
                type="text"
                value={shareTargetId}
                onChange={(e) => setShareTargetId(e.target.value)}
                placeholder="User ID(s), comma separated"
              />
              <em>{shareStatus}</em>
            </div>
            <div className="app-brand-footer">
              <img
                src={`${process.env.PUBLIC_URL}/app-logo-pure.png`}
                alt="Eviro logo"
                className="app-brand-logo"
              />
              <span className="app-brand-name">Eviro</span>
              <span className="app-credits">By: Ben W. and Darian T.</span>
            </div>
          </div>
        </aside>

        <main className={`editor-container view-${activeTab}`}>
          {isSidebarCollapsed && (
            <button
              type="button"
              className="sidebar-restore-btn"
              onClick={() => setIsSidebarCollapsed(false)}
              title="Show Sidebar"
              aria-label="Show Sidebar"
            >
              {'<'}
            </button>
          )}
          {activeTab === 'home' ? (
            <section className="home-view">
              <h2>Home</h2>
              <p className="home-subtitle">Welcome back. Here is your dashboard.</p>

              <div className="home-grid">
                <article className="widget widget-wide">
                  <div className="widget-header">
                    <h3>Today</h3>
                    <button type="button" onClick={() => handleTabChange('tasks')}>Open</button>
                  </div>

                  {todayTasks.length === 0 ? (
                    <p className="widget-empty">No tasks due today.</p>
                  ) : (
                    <ul className="widget-list">
                      {todayTasks.slice(0, 3).map((task) => (
                        <li key={task.id}>
                          <span>{task.title}</span>
                          <em>{task.completed ? 'done' : 'pending'}</em>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="widget-footer">
                    <span>{todayTasks.filter((task) => !task.completed).length} tasks due today</span>
                  </div>
                </article>

                <article className="widget widget-wide">
                  <div className="widget-header">
                    <h3>Upcoming Deadlines</h3>
                    <button type="button" onClick={() => handleTabChange('calendar')}>Calendar</button>
                  </div>

                  {upcomingTasks.length === 0 ? (
                    <p className="widget-empty">No upcoming deadlines.</p>
                  ) : (
                    <ul className="widget-list">
                      {upcomingTasks.map((task) => (
                        <li key={task.id}>
                          <span>{task.title}</span>
                          <em>{getRelativeDateLabel(task.dueDate)}</em>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="widget widget-half">
                  <div className="widget-header">
                    <h3>Next Class</h3>
                    <button type="button" onClick={() => handleTabChange('timetable')}>Timetable</button>
                  </div>
                  {nextClass ? (
                    <div className="next-class-main">
                      <strong>{nextClass.subject}</strong>
                      <p>{nextClass.start} - {nextClass.end}</p>
                    </div>
                  ) : (
                    <p className="widget-empty">No class scheduled yet.</p>
                  )}
                </article>

                <article className="widget widget-half">
                  <div className="widget-header">
                    <h3>Study Timer</h3>
                    <div className="study-timer-controls">
                      <button type="button" title="Start/Pause" onClick={() => setStudyRunning((prev) => !prev)}>
                        {studyRunning ? '⏸' : '▶'}
                      </button>
                      <button type="button" title="Reset" onClick={() => { setStudyRunning(false); setStudySeconds(studyPreset); }}>⟲</button>
                    </div>
                  </div>
                  <div className="study-timer-display">
                    {isEditingStudyTime ? (
                      <input
                        ref={studyTimeInputRef}
                        className="study-time-input"
                        type="number"
                        min="1"
                        max="180"
                        value={customStudyMinutes}
                        onChange={(event) => setCustomStudyMinutes(event.target.value)}
                        onBlur={commitStudyTimeEdit}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitStudyTimeEdit();
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelStudyTimeEdit();
                          }
                        }}
                      />
                    ) : (
                      <button type="button" className="study-time" onClick={beginStudyTimeEdit} title="Click to edit minutes">
                        {formatTimer(studySeconds)}
                      </button>
                    )}
                    <button
                      type="button"
                      className="log-session-btn"
                      title="Log current session"
                      onClick={() => {
                        const suggestedSubjectId = mostStudied?.subject?.id;
                        if (suggestedSubjectId) {
                          handleLogStudySession(suggestedSubjectId, Math.max(1, Math.round(studySeconds / 60)));
                        }
                      }}
                    >
                      Log
                    </button>
                  </div>
                </article>

                <article className="widget widget-half">
                  <div className="widget-header">
                    <h3>Study Insights</h3>
                    <span>Last 7 days</span>
                  </div>
                  <div className="subject-insights">
                    <p>Weekly study time: <strong>{formatMinutes(totalStudyThisWeek)}</strong></p>
                    <p>
                      Most studied:
                      <strong>{mostStudied?.subject?.name || ' - '}</strong>
                    </p>
                    {mostStudied && (
                      <p>
                        Sessions: <strong>{mostStudied.current.sessionCount}</strong> | Last studied:{' '}
                        <strong>{mostStudied.current.lastStudiedAt ? mostStudied.current.lastStudiedAt.toLocaleDateString() : 'Never'}</strong>
                      </p>
                    )}
                  </div>
                </article>

                <article className="widget widget-pressure">
                  <div className="widget-header">
                    <h3>Upcoming Pressure Indicator</h3>
                    <span>{next7DayPressure} avg workload</span>
                  </div>
                  <WorkloadHeatmap days={next28DayWorkload.slice(0, 28)} />
                </article>

                <article className="widget widget-notes-recent">
                  <div className="widget-header">
                    <h3>Recent Notes</h3>
                    <button type="button" onClick={() => handleTabChange('notes')}>See all</button>
                  </div>
                  {recentNotes.length === 0 ? (
                    <p className="widget-empty">No notes yet.</p>
                  ) : (
                    <ul className="widget-list">
                      {recentNotes.map((note) => (
                        <li key={note.id}>
                          <span>{note.title || 'Untitled note'}</span>
                          <em>{formatLocalDate((note.updatedAt || note.createdAt || '').split('T')[0])}</em>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                {isEditingStudyGoal && (
                  <div className="goal-edit-overlay" onClick={() => setIsEditingStudyGoal(false)}>
                    <div className="goal-edit-panel" onClick={(e) => e.stopPropagation()}>
                      <h4>Set Weekly Study Goal</h4>
                      <input
                        ref={goalInputRef}
                        className="goal-input"
                        type="number"
                        min="30"
                        max="1440"
                        value={customGoalMinutes}
                        onChange={(event) => setCustomGoalMinutes(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitStudyGoalEdit();
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelStudyGoalEdit();
                          }
                        }}
                      />
                      <p className="goal-hint">Minutes per week (30-1440)</p>
                      <div className="goal-buttons">
                        <button type="button" onClick={commitStudyGoalEdit}>Save</button>
                        <button type="button" onClick={cancelStudyGoalEdit}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="home-cards">
                  {metricCards.map((card) => (
                    <div
                      key={card.key}
                      className={`home-card visual ${card.clickable ? 'clickable' : ''}`}
                      onClick={card.clickable ? beginStudyGoalEdit : undefined}
                      role={card.clickable ? 'button' : undefined}
                      tabIndex={card.clickable ? 0 : undefined}
                    >
                      <span className="home-card-label">{card.label}</span>
                      <div className="home-card-visual">
                        {card.type === 'ring' ? (
                          <>
                            <svg className="ring" viewBox="0 0 40 40">
                              <circle className="ring-bg" cx="20" cy="20" r="16" />
                              <circle
                                className="ring-fg"
                                cx="20"
                                cy="20"
                                r="16"
                                pathLength="100"
                                style={{ strokeDasharray: `${Math.round((card.pct / 100) * 100)} 100` }}
                              />
                            </svg>
                            <strong>{card.valueLabel}</strong>
                          </>
                        ) : (
                          <>
                            <div className="mini-bar"><span style={{ width: `${card.pct}%` }} /></div>
                            <div className="pressure-card-number">{card.valueLabel.split(' ')[0]}</div>
                            <div className="pressure-card-label">{card.valueLabel.split(' ').slice(1).join(' ')}</div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : activeTab === 'calendar' ? (
            <TasksCalendar
              tasks={tasks}
              timetable={timetable}
              subjects={subjects}
              onTaskSelect={handleOpenCalendarTask}
              onClassSelect={handleOpenCalendarClass}
              onExamSelect={handleOpenCalendarExam}
              onOpenSubject={handleOpenSubjectPage}
            />
          ) : activeTab === 'subject' ? (
            <SubjectPage
              subject={getSubjectById(selectedSubjectId)}
              notes={notes}
              tasks={tasks}
              grades={normalizedGrades}
              studySessions={studySessions}
              onOpenNote={(noteId) => {
                setSelectedId(noteId);
                setActiveTab('notes');
              }}
              onOpenTask={(taskId) => {
                setSelectedId(taskId);
                setActiveTab('tasks');
              }}
            />
          ) : activeTab === 'timetable' ? (
            <TimetableManager
              timetable={timetable}
              subjects={subjects}
              onSave={handleSaveTimetable}
              onUpdateSubjectColor={handleUpdateSubjectColor}
            />
          ) : activeTab === 'grades' ? (
            <GradeEditor
              key={`grade-editor-${selectedSubjectId || 'new'}-${gradeEditorVersion}`}
              subject={getSubjectById(selectedSubjectId)}
              subjects={subjects}
              onSave={handleSaveExam}
              onDelete={handleDeleteExam}
            />
          ) : selectedItem ? (
            <Editor
              item={selectedItem}
              type={activeTab}
              subjects={subjects}
              folders={activeTab === 'notes' ? noteFolders : taskFolders}
              getSubjectById={getSubjectById}
              onOpenSubject={handleOpenSubjectPage}
              onSave={activeTab === 'notes' ? handleSaveNote : handleSaveTask}
              onDelete={activeTab === 'notes' ? handleDeleteNote : handleDeleteTask}
            />
          ) : (
            <div className="empty-state">
              <p>Select or create a {activeTab === 'notes' ? 'note' : activeTab === 'tasks' ? 'task' : 'record'}</p>
            </div>
          )}
        </main>
      </div>

      {isProfileModalOpen && (
        <ProfileModal
          userId={userId}
          displayName={displayName}
          nameSet={profileNameSet}
          isAdmin={['eviro-0hj6tqby', 'eviro-hmg2dum8'].includes(userId)}
          allProfiles={allProfiles}
          onClose={() => setIsProfileModalOpen(false)}
          onSetName={handleSetProfileName}
          onAdminChangeName={handleAdminChangeProfileName}
        />
      )}
    </div>
  );
}

export default App;
