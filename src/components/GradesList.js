import React, { useState } from 'react';
import './GradesList.css';

function GradesList({
  subjects,
  selectedSubjectId,
  onSelectSubject,
  onDeleteExam,
  onDeleteSubject,
  onNew,
  onCreateSubject,
  onOpenSubjectPage,
}) {
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [subjectNameDraft, setSubjectNameDraft] = useState('');

  // Calculate weighted average grade
  const calculateAverage = (exams) => {
    if (exams.length === 0) return null;

    // Define weights for each exam type
    const typeWeights = {
      Schulaufgabe: 2,
      Klassenarbeit: 1,
      'Mundliche Note': 1,
    };

    let totalWeightedGrade = 0;
    let totalWeight = 0;

    exams.forEach((exam) => {
      const typeWeight = typeWeights[exam.type] || 1; // Default to 1 if type not specified
      const individualWeight = exam.weight || 1; // Individual exam weight multiplier
      const totalExamWeight = typeWeight * individualWeight;
      totalWeightedGrade += exam.grade * totalExamWeight;
      totalWeight += totalExamWeight;
    });

    const average = totalWeightedGrade / totalWeight;
    return average.toFixed(2);
  };

  // Get grade label (German Bavarian)
  const getGradeLabel = (grade) => {
    const labels = {
      1: 'sehr gut',
      2: 'gut',
      3: 'befriedigend',
      4: 'ausreichend',
      5: 'mangelhaft',
      6: 'ungenuegend',
    };
    return labels[grade] || 'Unknown';
  };

  const handleCreateSubjectOnly = () => {
    const trimmed = subjectNameDraft.trim();
    if (!trimmed) return;
    onCreateSubject(trimmed);
    setSubjectNameDraft('');
  };

  return (
    <div className="grades-list">
      <div className="grades-actions">
      </div>
      <div className="grades-actions">
        <input
          className="new-subject-input"
          value={subjectNameDraft}
          onChange={(e) => setSubjectNameDraft(e.target.value)}
          placeholder="Subject name..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateSubjectOnly();
          }}
        />
        <button className="new-subject-btn" onClick={handleCreateSubjectOnly}>
          + Subject Only
        </button>
      </div>

      <div className="items">
        {subjects.map((subject) => {
          const exams = subject.exams || [];
          const average = calculateAverage(exams);
          const isExpanded = expandedSubject === subject.name;

          return (
            <div key={subject.id || subject.name} className="subject-item">
              <div
                className={`subject-header ${selectedSubjectId === subject.id ? 'active' : ''} ${average && parseFloat(average) >= 4.5 ? 'failing' : ''}`}
                onClick={() => {
                  onSelectSubject(subject.id);
                  setExpandedSubject(isExpanded ? null : subject.name);
                }}
              >
                <div className="subject-info">
                  <button
                    type="button"
                    className="subject-name subject-open-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSubjectPage(subject.id);
                    }}
                  >
                    {subject.name}
                  </button>
                  {average && (
                    <div className="subject-average">
                      Avg {average} ({getGradeLabel(Math.round(average * 2) / 2)})
                    </div>
                  )}
                </div>
                <button
                  className="subject-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete subject "${subject.name}" and all its exams?`)) {
                      onDeleteSubject(subject.id);
                    }
                  }}
                  title="Delete subject"
                >
                  Delete
                </button>
                <div className="toggle-icon">{isExpanded ? 'v' : '>'}</div>
              </div>

              {isExpanded && (
                <div className="exams-list">
                  {exams.length === 0 ? (
                    <div className="no-exams">No exams yet</div>
                  ) : (
                    exams.map((exam, idx) => (
                      <div key={exam.id || idx} className="exam-item">
                        <div className="exam-info">
                          <div className="exam-name">{exam.name}</div>
                          <div className="exam-meta">
                            <span className="exam-type">{exam.type || 'Klassenarbeit'}</span>
                            {exam.weight && exam.weight !== 1 && (
                              <span className="exam-weight">x{exam.weight}</span>
                            )}
                          </div>
                          <div className="exam-date">
                            {new Date(exam.date).toLocaleDateString('de-DE')}
                          </div>
                        </div>
                        <div className="exam-grade">{exam.grade}</div>
                        <button
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteExam(subject.id, idx, exam.id);
                          }}
                        >
                          X
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {subjects.length === 0 && (
          <div className="no-subjects">No subjects yet. Create your first subject or exam.</div>
        )}
      </div>
    </div>
  );
}

export default GradesList;
