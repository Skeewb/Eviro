import React, { useEffect, useMemo, useState } from 'react';
import './TimetableManager.css';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
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

const COLORS = ['#e5ef81', '#7bdde1', '#8a8f00', '#6adf65', '#f38983', '#8d4a4a', '#6e6ede', '#ff8b00', '#0a95d9'];

const toMinutes = (timeStr) => {
  if (!timeStr || !timeStr.includes(':')) return -1;
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + minute;
};

const periodFromTime = (timeStr) => {
  const minutes = toMinutes(timeStr);
  if (minutes < 0) return null;

  const exact = PERIOD_SLOTS.find((slot) => slot.start === timeStr);
  if (exact) return exact.key;

  const within = PERIOD_SLOTS.find((slot) => {
    const start = toMinutes(slot.start);
    const end = toMinutes(slot.end);
    return minutes >= start && minutes <= end;
  });

  return within ? within.key : null;
};

const subjectColor = (name) => {
  const str = String(name || 'Subject');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
};

const normalizeEntries = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((entry, idx) => {
      const day = (entry.day || '').trim();
      if (!DAY_ORDER.includes(day)) return null;

      const period = Number.isInteger(entry.period) ? entry.period : periodFromTime(entry.start);
      if (!Number.isInteger(period) || period < 0 || period > 11) return null;

      const subject = (entry.subject || entry.title || '').trim();
      if (!subject) return null;

      return {
        id: entry.id || `entry-${Date.now()}-${idx}`,
        day,
        period,
        subject,
        color: entry.color || subjectColor(subject),
      };
    })
    .filter(Boolean);
};

function TimetableManager({ timetable, subjects, onSave, onUpdateSubjectColor }) {
  const [entries, setEntries] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [draggingCell, setDraggingCell] = useState(null);

  useEffect(() => {
    setEntries(normalizeEntries(timetable));
    setDirty(false);
  }, [timetable]);

  const subjectPool = useMemo(
    () =>
      (subjects || []).map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color || subjectColor(s.name),
      })),
    [subjects]
  );

  const subjectColorMap = useMemo(() => {
    const map = {};
    subjectPool.forEach((s) => {
      map[s.name] = s.color;
    });
    return map;
  }, [subjectPool]);

  const entryMap = useMemo(() => {
    const map = {};
    entries.forEach((entry) => {
      map[`${entry.day}-${entry.period}`] = entry;
    });
    return map;
  }, [entries]);

  const getCellEntry = (day, period) => entryMap[`${day}-${period}`] || null;

  const setCellEntry = (day, period, payload) => {
    const targetKey = `${day}-${period}`;

    setEntries((prev) => {
      const next = [...prev];
      const targetIndex = next.findIndex((e) => `${e.day}-${e.period}` === targetKey);

      if (payload.kind === 'subject') {
        const newEntry = {
          id: `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          day,
          period,
          subject: payload.subject,
          color: payload.color || subjectColorMap[payload.subject] || subjectColor(payload.subject),
        };

        if (targetIndex >= 0) {
          next[targetIndex] = { ...next[targetIndex], subject: newEntry.subject, color: newEntry.color };
        } else {
          next.push(newEntry);
        }

        return next;
      }

      if (payload.kind === 'entry') {
        const sourceIndex = next.findIndex((e) => e.id === payload.id);
        if (sourceIndex === -1) return next;

        const source = next[sourceIndex];
        if (source.day === day && source.period === period) return next;

        if (targetIndex >= 0) {
          const target = next[targetIndex];
          next[sourceIndex] = { ...source, day: target.day, period: target.period };
          next[targetIndex] = { ...target, day: day, period: period };
        } else {
          next[sourceIndex] = { ...source, day, period };
        }

        return next;
      }

      return next;
    });

    setDirty(true);
  };

  const clearCell = (day, period) => {
    setEntries((prev) => prev.filter((entry) => !(entry.day === day && entry.period === period)));
    setDirty(true);
  };

  const clearAll = () => {
    setEntries([]);
    setDirty(true);
  };

  const save = () => {
    onSave(entries);
    setDirty(false);
  };

  const onDropCell = (event, day, period) => {
    event.preventDefault();
    setDraggingCell(null);

    const raw = event.dataTransfer.getData('text/plain');
    if (!raw) return;

    try {
      const payload = JSON.parse(raw);
      if (!payload || !payload.kind) return;
      setCellEntry(day, period, payload);
    } catch {
      // ignore malformed payload
    }
  };

  return (
    <div className="timetable-manager dragdrop">
      <div className="timetable-header">
        <div>
          <h2>Timetable</h2>
          <p>Drag subjects from the left into the weekly grid</p>
        </div>
        <div className="header-actions">
          <button className="secondary-btn" onClick={clearAll} type="button">Clear All</button>
          <button className="save-btn" onClick={save} disabled={!dirty} type="button">
            {dirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      <section className="drag-layout">
        <aside className="subject-pool">
          <h3>Subjects</h3>
          {subjectPool.length === 0 ? (
            <p className="empty-pool">No subjects yet. Add subjects in Grades first.</p>
          ) : (
            <div className="subject-chips">
              {subjectPool.map((subject) => (
                <div key={subject.name} className="subject-chip-row">
                  <button
                    className="subject-chip"
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        'text/plain',
                        JSON.stringify({ kind: 'subject', subject: subject.name, color: subject.color })
                      );
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    style={{ backgroundColor: subject.color }}
                  >
                    {subject.name}
                  </button>
                  <input
                    type="color"
                    className="subject-color-picker"
                    value={subject.color}
                    onChange={(event) => onUpdateSubjectColor(subject.id || subject.name, event.target.value)}
                    title={`Change color for ${subject.name}`}
                  />
                </div>
              ))}
            </div>
          )}
        </aside>

        <div className="week-grid-wrap">
          <div className="week-grid-scroll">
            <table className="week-grid">
              <thead>
                <tr>
                  <th>Period</th>
                  {DAY_ORDER.map((day) => (
                    <th key={day}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIOD_SLOTS.map((slot) => (
                  <tr key={slot.key}>
                    <td className="period-cell">
                      <strong>{slot.key}</strong>
                      <span>{slot.start}</span>
                      <span>{slot.end}</span>
                    </td>
                    {DAY_ORDER.map((day) => {
                      const entry = getCellEntry(day, slot.key);
                      const isDragTarget = draggingCell === `${day}-${slot.key}`;

                      return (
                        <td
                          key={`${day}-${slot.key}`}
                          className={`class-cell ${isDragTarget ? 'drag-target' : ''}`}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDraggingCell(`${day}-${slot.key}`);
                          }}
                          onDragLeave={() => setDraggingCell(null)}
                          onDrop={(event) => onDropCell(event, day, slot.key)}
                        >
                          {entry && (
                            <div
                              className="class-pill"
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'entry', id: entry.id }));
                                event.dataTransfer.effectAllowed = 'move';
                              }}
                              style={{ backgroundColor: subjectColorMap[entry.subject] || entry.color || '#dceef1' }}
                            >
                              <span>{entry.subject}</span>
                              <button
                                type="button"
                                className="cell-clear"
                                onClick={() => clearCell(day, slot.key)}
                                title="Clear this cell"
                              >
                                x
                              </button>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default TimetableManager;
