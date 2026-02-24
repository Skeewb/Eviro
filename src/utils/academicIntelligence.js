const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

export const resolveRange = (range) => {
  const now = new Date();
  if (!range) return { start: startOfDay(new Date(now.getTime() - 29 * DAY_MS)), end: endOfDay(now) };
  if (typeof range === 'string') {
    if (range === 'last7days') return { start: startOfDay(new Date(now.getTime() - 6 * DAY_MS)), end: endOfDay(now) };
    if (range === 'last30days') return { start: startOfDay(new Date(now.getTime() - 29 * DAY_MS)), end: endOfDay(now) };
    if (range === 'semester') return { start: startOfDay(new Date(now.getTime() - 120 * DAY_MS)), end: endOfDay(now) };
  }
  const start = toDate(range.start) || startOfDay(new Date(now.getTime() - 29 * DAY_MS));
  const end = toDate(range.end) || endOfDay(now);
  return { start: startOfDay(start), end: endOfDay(end) };
};

const isWithinRange = (date, range) => !!date && date >= range.start && date <= range.end;

export const normalizeGradeRecords = (grades = [], subjects = []) => {
  const fromGrades = (grades || []).map((grade, idx) => ({
    id: grade.id || `grade-${idx}-${Date.now()}`,
    subjectId: grade.subjectId || null,
    value: Number(grade.value ?? grade.grade ?? 0),
    weight: Number(grade.weight ?? 1) || 1,
    date: toDate(grade.date),
  }));
  const fromExams = (subjects || []).flatMap((subject, subjectIdx) =>
    (subject.exams || []).map((exam, examIdx) => ({
      id: `exam-grade-${subject.id || subjectIdx}-${exam.id || examIdx}`,
      subjectId: exam.subjectId || subject.id || null,
      value: Number(exam.grade ?? 0),
      weight: Number(exam.weight ?? 1) || 1,
      date: toDate(exam.date),
    }))
  );
  return [...fromGrades, ...fromExams].filter((grade) => grade.subjectId && Number.isFinite(grade.value) && grade.date);
};

export const getStudyStats = (subjectId, range, studySessions = []) => {
  const resolvedRange = resolveRange(range);
  const sessions = (studySessions || [])
    .filter((session) => session.subjectId === subjectId)
    .map((session) => ({ ...session, dateObj: toDate(session.date) }))
    .filter((session) => isWithinRange(session.dateObj, resolvedRange));

  const totalMinutes = sessions.reduce((sum, session) => sum + (Number(session.durationMinutes) || 0), 0);
  const sessionCount = sessions.length;
  const averageSession = sessionCount ? Math.round(totalMinutes / sessionCount) : 0;
  const sorted = [...sessions].sort((a, b) => b.dateObj - a.dateObj);
  return {
    totalMinutes,
    sessionCount,
    averageSession,
    lastStudiedAt: sorted[0]?.dateObj,
  };
};

const weightedAverage = (grades = []) => {
  if (!grades.length) return null;
  const totals = grades.reduce(
    (acc, grade) => {
      const weight = Number(grade.weight) || 1;
      acc.weighted += Number(grade.value) * weight;
      acc.weight += weight;
      return acc;
    },
    { weighted: 0, weight: 0 }
  );
  if (!totals.weight) return null;
  return Number((totals.weighted / totals.weight).toFixed(2));
};

export const predictGrade = (subjectId, hypotheticalScore, hypotheticalWeight, grades = []) => {
  const current = grades.filter((grade) => grade.subjectId === subjectId);
  const currentAverage = weightedAverage(current);
  const withHypothetical = [...current, { subjectId, value: Number(hypotheticalScore), weight: Number(hypotheticalWeight) || 1 }];
  const predictedAverage = weightedAverage(withHypothetical);
  return { currentAverage, predictedAverage };
};

export const requiredGradeForTarget = (subjectId, targetAverage, upcomingWeight, grades = []) => {
  const current = grades.filter((grade) => grade.subjectId === subjectId);
  const target = Number(targetAverage);
  const futureWeight = Number(upcomingWeight) || 1;
  const totals = current.reduce(
    (acc, grade) => {
      const weight = Number(grade.weight) || 1;
      acc.weighted += Number(grade.value) * weight;
      acc.weight += weight;
      return acc;
    },
    { weighted: 0, weight: 0 }
  );
  const needed = ((target * (totals.weight + futureWeight)) - totals.weighted) / futureWeight;
  return Number(needed.toFixed(2));
};

export const getStudyRecommendations = ({ subjects = [], tasks = [], exams = [], grades = [], today = new Date() }) => {
  const dayStart = startOfDay(today);
  const bySubject = (subjects || [])
    .map((subject) => {
      const subjectExams = (exams || []).filter((exam) => exam.subjectId === subject.id);
      const upcomingExam = subjectExams
        .map((exam) => ({ ...exam, dateObj: toDate(exam.date) }))
        .filter((exam) => exam.dateObj && exam.dateObj >= dayStart)
        .sort((a, b) => a.dateObj - b.dateObj)[0];
      const daysUntilExam = upcomingExam ? Math.max(1, Math.ceil((startOfDay(upcomingExam.dateObj) - dayStart) / DAY_MS)) : null;
      const urgencyScore = daysUntilExam ? 10 / daysUntilExam : 0;

      const subjectGrades = grades.filter((grade) => grade.subjectId === subject.id);
      const avg = weightedAverage(subjectGrades);
      const gradeScore = avg ? Math.max(0, avg - 1) : 1.8;

      const pendingTasks = tasks.filter((task) => task.subjectId === subject.id && !task.completed);
      const taskScore = pendingTasks.length;

      const score = urgencyScore * 3 + gradeScore * 2 + taskScore;
      const reasons = [];
      if (daysUntilExam) reasons.push(`Exam in ${daysUntilExam} day${daysUntilExam === 1 ? '' : 's'}`);
      if (taskScore > 0) reasons.push(`${taskScore} pending task${taskScore === 1 ? '' : 's'}`);
      if (avg && avg > 3.5) reasons.push('Grades need attention');

      return {
        subjectId: subject.id,
        score,
        reason: reasons.length ? reasons.join(' and ') : 'Build consistent momentum',
        suggestedMinutes: Math.max(20, Math.min(120, Math.round(20 + score * 7))),
      };
    })
    .sort((a, b) => b.score - a.score);

  return bySubject.slice(0, 3);
};

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const getDailyWorkload = ({ startDate, endDate, tasks = [], exams = [], timetable = [] }) => {
  const start = startOfDay(toDate(startDate) || new Date());
  const end = endOfDay(toDate(endDate) || new Date());
  const results = [];

  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + DAY_MS)) {
    const key = dateKey(cursor);
    const dayName = cursor.toLocaleDateString('en-US', { weekday: 'long' });
    const dayTasks = tasks.filter((task) => task.dueDate === key && !task.completed);
    const tasksMinutes = dayTasks.reduce((sum, task) => sum + (Number(task.estimatedMinutes) || 30), 0);
    const dayExams = exams.filter((exam) => exam.date === key);
    const dayClasses = timetable.filter((entry) => entry.day === dayName);
    const examWeightFactor = dayExams.reduce((sum, exam) => sum + ((Number(exam.weight) || 1) * 60), 0);
    const classCountFactor = dayClasses.length * 10;
    const workload = tasksMinutes + examWeightFactor + classCountFactor;

    results.push({
      date: new Date(cursor),
      workload,
      tasksCount: dayTasks.length,
      examsCount: dayExams.length,
      classesCount: dayClasses.length,
    });
  }

  return results;
};
