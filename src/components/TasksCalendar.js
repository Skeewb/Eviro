import React, { useState, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './TasksCalendar.css';
import { getAllTasksWithRecurring } from '../utils/recurrenceUtils';
import DayTimeline from './DayTimeline';

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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function TasksCalendar({
  tasks,
  timetable,
  subjects,
  onTaskSelect,
  onClassSelect,
  onExamSelect,
  onOpenSubject,
}) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('month');

  const toLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const buildDateTime = (date, hhmm) => {
    const [hours, minutes] = String(hhmm || '00:00')
      .split(':')
      .map((item) => Number(item) || 0);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
  };

  const subjectColorMap = useMemo(() => {
    const map = {};
    (subjects || []).forEach((subject) => {
      if (subject?.name) map[subject.name] = subject.color;
    });
    return map;
  }, [subjects]);

  const subjectIdByName = useMemo(() => {
    const map = {};
    (subjects || []).forEach((subject) => {
      if (subject?.name) map[subject.name] = subject.id;
    });
    return map;
  }, [subjects]);

  const subjectById = useMemo(() => {
    const map = {};
    (subjects || []).forEach((subject) => {
      if (subject?.id) map[subject.id] = subject;
    });
    return map;
  }, [subjects]);

  // Calculate date range for recurring tasks (current month +/- 3 months for performance)
  const dateRange = useMemo(() => {
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 3, 1);
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 4, 0);
    return { start, end };
  }, [selectedDate]);

  // Get all tasks including recurring instances
  const allTasksWithRecurring = useMemo(
    () => getAllTasksWithRecurring(tasks, dateRange.start, dateRange.end),
    [tasks, dateRange]
  );

  const allTasksForDate = (date) => {
    const dateStr = toLocalDateString(date);
    return allTasksWithRecurring.filter((task) => task.dueDate === dateStr);
  };

  // Unified daily event timeline from separate sources (timetable, tasks, exams)
  const getEventsForDate = (date) => {
    const dateKey = toLocalDateString(date);
    const weekday = DAY_NAMES[date.getDay()];

    const classEvents = (timetable || [])
      .filter((entry) => entry?.day === weekday)
      .map((entry, idx) => {
        const slot = PERIOD_SLOTS.find((period) => period.key === Number(entry?.period));
        if (!slot) return null;

        const sourceId = entry.id || `${entry.day}-${entry.period}-${entry.subject}-${idx}`;
        const subject = entry.subject || 'Class';
        const linkedSubjectId = subjectIdByName[subject] || null;

        return {
          id: `class-${dateKey}-${sourceId}`,
          title: subject,
          startTime: buildDateTime(date, slot.start),
          endTime: buildDateTime(date, slot.end),
          type: 'class',
          subjectId: linkedSubjectId,
          color: subjectColorMap[subject] || entry.color,
          sourceId,
        };
      })
      .filter(Boolean);

    const taskEvents = allTasksForDate(date).map((task, idx) => {
      const isAllDay = task.isAllDay || false;
      let start, end;
      
      if (isAllDay) {
        // All-day events use the start of the day
        start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
        end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 0);
      } else {
        // Regular events use the specified time or default to 17:00
        const timeStr = task.dueTime || '17:00';
        start = buildDateTime(date, timeStr);
        end = new Date(start.getTime() + 45 * 60 * 1000);
      }
      
      const sourceId = task.isRecurringInstance ? task.parentId || task.id : task.id;

      return {
        id: `task-${dateKey}-${sourceId}-${idx}`,
        title: task.title || 'Task',
        startTime: start,
        endTime: end,
        type: 'task',
        isAllDay: isAllDay,
        subjectId: task.subjectId || null,
        color: task.subjectId ? subjectById[task.subjectId]?.color : undefined,
        sourceId,
      };
    });

    const examEvents = (subjects || []).flatMap((subject) =>
      (subject.exams || [])
        .map((exam, idx) => {
          if (!exam?.date || exam.date !== dateKey) return null;
          const start = buildDateTime(date, '09:00');
          const end = buildDateTime(date, '10:30');
          const sourceId = `${subject.id || subject.name}-${idx}`;
          return {
            id: `exam-${dateKey}-${sourceId}`,
            title: exam.name || `${subject.name} Exam`,
            startTime: start,
            endTime: end,
            type: 'exam',
            subjectId: subject.id,
            color: subject.color,
            sourceId,
          };
        })
        .filter(Boolean)
    );

    return [...classEvents, ...taskEvents, ...examEvents].sort((a, b) => a.startTime - b.startTime);
  };

  const tasksForSelectedDate = allTasksForDate(selectedDate);
  const eventsForSelectedDate = getEventsForDate(selectedDate);

  // Add visual indicator to dates with tasks
  const tileContent = ({ date }) => {
    const count = getEventsForDate(date).length;
    if (count === 0) return null;
    return (
      <div className="task-indicator">
        <span className="task-count">{count}</span>
      </div>
    );
  };

  return (
    <div className="tasks-calendar">
      <div className="calendar-container">
        <Calendar
          onChange={setSelectedDate}
          value={selectedDate}
          tileContent={tileContent}
          tileClassName={({ date }) => {
            const count = getEventsForDate(date).length;
            return count > 0 ? 'has-tasks' : '';
          }}
        />
      </div>

      <div className="calendar-tasks">
        <div className="calendar-tasks-header">
          <div className="calendar-header-top">
            <h2>
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h2>
            <div className="calendar-view-toggle">
              <button
                type="button"
                className={calendarView === 'month' ? 'active' : ''}
                onClick={() => setCalendarView('month')}
              >
                Month View
              </button>
              <button
                type="button"
                className={calendarView === 'day' ? 'active' : ''}
                onClick={() => setCalendarView('day')}
              >
                Day View
              </button>
            </div>
          </div>
        </div>

        {calendarView === 'day' ? (
          <DayTimeline
            date={selectedDate}
            events={eventsForSelectedDate}
            onOpenEvent={(event) => {
              if (event.type === 'task' && onTaskSelect) onTaskSelect(event.sourceId);
              if (event.type === 'class' && onClassSelect) onClassSelect(event.sourceId);
              if (event.type === 'exam' && onExamSelect) onExamSelect(event);
            }}
          />
        ) : tasksForSelectedDate.length === 0 ? (
          <div className="no-tasks">No tasks for this date</div>
        ) : (
          <div className="tasks-list">
            {tasksForSelectedDate.map((task) => (
              <div
                key={task.isRecurringInstance ? `${task.parentId}-${task.dueDate}` : task.id}
                className={`task-item ${task.completed ? 'completed' : ''}`}
                onClick={() => onTaskSelect(task.isRecurringInstance ? task.parentId || task.id : task.id)}
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={(e) => e.stopPropagation()}
                  className="task-checkbox"
                />
                <div className="task-info">
                  <div className="task-title">
                    {task.title}
                    {task.isRecurringInstance && (
                      <span className="recurring-badge">(recurring)</span>
                    )}
                  </div>
                  <div className="task-time-info">
                    {task.isAllDay ? (
                      <span className="task-time-badge all-day">All Day</span>
                    ) : task.dueTime ? (
                      <span className="task-time-badge">{task.dueTime}</span>
                    ) : null}
                  </div>
                  {task.subjectId && subjectById[task.subjectId] && (
                    <button
                      type="button"
                      className="calendar-subject-chip"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSubject(task.subjectId);
                      }}
                    >
                      <span className="calendar-subject-dot" style={{ backgroundColor: subjectById[task.subjectId].color || '#8098c9' }} />
                      {subjectById[task.subjectId].name}
                    </button>
                  )}
                  {task.description && (
                    <div className="task-description">{task.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TasksCalendar;

