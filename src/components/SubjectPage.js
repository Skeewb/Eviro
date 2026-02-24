import React, { useMemo, useState } from 'react';
import './SubjectPage.css';
import { calculateWeightedAverage } from '../utils/subjects';
import {
  getStudyStats,
  predictGrade,
  requiredGradeForTarget,
  resolveRange,
} from '../utils/academicIntelligence';

function SubjectPage({ subject, notes, tasks, grades, studySessions, onOpenNote, onOpenTask }) {
  const [hypotheticalScore, setHypotheticalScore] = useState('2.0');
  const [hypotheticalWeight, setHypotheticalWeight] = useState('1');
  const [targetAverage, setTargetAverage] = useState('2.0');
  const [upcomingWeight, setUpcomingWeight] = useState('1');
  const subjectNotes = useMemo(
    () => (notes || []).filter((note) => note.subjectId === subject?.id),
    [notes, subject?.id]
  );
  const subjectTasks = useMemo(
    () => (tasks || []).filter((task) => task.subjectId === subject?.id),
    [tasks, subject?.id]
  );
  const subjectExams = subject?.exams || [];
  const average = calculateWeightedAverage(subjectExams);
  const weeklyRange = resolveRange('last7days');
  const previousWeeklyRange = {
    start: new Date(weeklyRange.start.getTime() - 7 * 24 * 60 * 60 * 1000),
    end: new Date(weeklyRange.start.getTime() - 1),
  };
  const studyStats = getStudyStats(subject?.id, weeklyRange, studySessions);
  const previousStudyStats = getStudyStats(subject?.id, previousWeeklyRange, studySessions);
  const trendMinutes = studyStats.totalMinutes - previousStudyStats.totalMinutes;
  const { currentAverage, predictedAverage } = predictGrade(
    subject?.id,
    Number(hypotheticalScore),
    Number(hypotheticalWeight),
    grades || []
  );
  const neededForTarget = requiredGradeForTarget(
    subject?.id,
    Number(targetAverage),
    Number(upcomingWeight),
    grades || []
  );

  if (!subject) {
    return (
      <div className="subject-page-empty">
        <p>Subject not found.</p>
      </div>
    );
  }

  return (
    <div className="subject-page">
      <header className="subject-page-header">
        <div className="subject-page-title-wrap">
          <span className="subject-page-dot" style={{ backgroundColor: subject.color || '#7d95c7' }} />
          <div>
            <h2>{subject.name}</h2>
            <p>{subjectExams.length} exams | {subjectTasks.length} tasks | {subjectNotes.length} notes</p>
          </div>
        </div>
        <div className="subject-page-average">
          <span>Average</span>
          <strong>{average ?? '-'}</strong>
        </div>
      </header>

      <section className="subject-page-grid">
        <article className="subject-card">
          <h3>Study Analytics</h3>
          <p>Total this week: <strong>{studyStats.totalMinutes}m</strong></p>
          <p>Sessions: <strong>{studyStats.sessionCount}</strong></p>
          <p>Average session: <strong>{studyStats.averageSession}m</strong></p>
          <p>Last studied: <strong>{studyStats.lastStudiedAt ? studyStats.lastStudiedAt.toLocaleDateString() : 'Never'}</strong></p>
          <p>Trend vs previous week: <strong>{trendMinutes >= 0 ? '+' : ''}{trendMinutes}m</strong></p>
        </article>

        <article className="subject-card">
          <h3>Grade Forecast</h3>
          <p>Current average: <strong>{currentAverage ?? '-'}</strong></p>
          <label className="forecast-row">
            Hypothetical grade
            <input value={hypotheticalScore} onChange={(e) => setHypotheticalScore(e.target.value)} type="number" step="0.1" />
          </label>
          <label className="forecast-row">
            Hypothetical weight
            <input value={hypotheticalWeight} onChange={(e) => setHypotheticalWeight(e.target.value)} type="number" step="0.1" />
          </label>
          <p>Predicted average: <strong>{predictedAverage ?? '-'}</strong></p>
          <label className="forecast-row">
            Target average
            <input value={targetAverage} onChange={(e) => setTargetAverage(e.target.value)} type="number" step="0.1" />
          </label>
          <label className="forecast-row">
            Upcoming weight
            <input value={upcomingWeight} onChange={(e) => setUpcomingWeight(e.target.value)} type="number" step="0.1" />
          </label>
          <p>Required score: <strong>{Number.isFinite(neededForTarget) ? neededForTarget : '-'}</strong></p>
        </article>
      </section>

      <section className="subject-page-grid">
        <article className="subject-card">
          <h3>Tasks</h3>
          {subjectTasks.length === 0 ? (
            <p className="subject-empty">No tasks linked to this subject.</p>
          ) : (
            <div className="subject-list">
              {subjectTasks.map((task) => (
                <button type="button" key={task.id} className="subject-item" onClick={() => onOpenTask(task.id)}>
                  <span>{task.title || 'Untitled task'}</span>
                  <em>{task.dueDate || 'No due date'}</em>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="subject-card">
          <h3>Notes</h3>
          {subjectNotes.length === 0 ? (
            <p className="subject-empty">No notes linked to this subject.</p>
          ) : (
            <div className="subject-list">
              {subjectNotes.map((note) => (
                <button type="button" key={note.id} className="subject-item" onClick={() => onOpenNote(note.id)}>
                  <span>{note.title || 'Untitled note'}</span>
                  <em>{Array.isArray(note.tags) ? note.tags.slice(0, 2).join(', ') : ''}</em>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="subject-card subject-card-wide">
          <h3>Exams</h3>
          {subjectExams.length === 0 ? (
            <p className="subject-empty">No exams for this subject yet.</p>
          ) : (
            <div className="subject-list">
              {subjectExams.map((exam) => (
                <div key={exam.id || `${exam.name}-${exam.date}`} className="subject-item static">
                  <span>{exam.name || 'Exam'}</span>
                  <em>{exam.date} | Grade {exam.grade}</em>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

export default SubjectPage;
