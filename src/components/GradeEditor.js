import React, { useState, useEffect } from 'react';
import './GradeEditor.css';

function GradeEditor({ subject, subjects, onSave }) {
  const [subjectId, setSubjectId] = useState(subject?.id || '');
  const [subjectName, setSubjectName] = useState(subject?.name || '');
  const [examName, setExamName] = useState('');
  const [examType, setExamType] = useState('Klassenarbeit');
  const [grade, setGrade] = useState('1');
  const [weight, setWeight] = useState('1');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (subject) {
      setSubjectId(subject.id || '');
      setSubjectName(subject.name || '');
    } else {
      setSubjectId('');
      setSubjectName('');
      setExamName('');
      setExamType('Klassenarbeit');
      setGrade('1');
      setWeight('1');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [subject]);

  const handleChange = () => {
    setSaved(false);
  };

  const handleSave = () => {
    if (!subjectName.trim() || !examName.trim()) {
      alert('Please fill in all fields');
      return;
    }

    const examData = {
      subjectId: subjectId || null,
      subject: subjectName,
      name: examName,
      grade: parseFloat(grade),
      date,
      type: examType,
      weight: parseFloat(weight),
    };

    onSave(examData);
    setSaved(true);
  };

  const getGradeLabel = (g) => {
    const labels = {
      1: 'sehr gut (very good)',
      2: 'gut (good)',
      3: 'befriedigend (satisfactory)',
      4: 'ausreichend (sufficient)',
      5: 'mangelhaft (inadequate)',
      6: 'ungenuegend (failing)',
    };
    return labels[g] || 'Unknown';
  };

  return (
    <div className="grade-editor">
      <div className="editor-header">
        <h2>Grade Entry</h2>
        <div className="editor-actions">
          <span className={`save-status ${saved ? 'saved' : 'unsaved'}`}>
            {saved ? 'Saved' : 'Unsaved'}
          </span>
          <button className="save-btn" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>

      <div className="grade-form">
        <div className="form-group">
          <label>Linked Subject</label>
          <select
            value={subjectId}
            onChange={(e) => {
              const nextId = e.target.value;
              setSubjectId(nextId);
              const matched = (subjects || []).find((entry) => entry.id === nextId);
              if (matched) setSubjectName(matched.name);
              handleChange();
            }}
            className="form-input"
          >
            <option value="">No subject selected</option>
            {(subjects || []).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Subject</label>
          <input
            type="text"
            value={subjectName}
            onChange={(e) => {
              const nextName = e.target.value;
              setSubjectName(nextName);
              const matched = (subjects || []).find((entry) => entry.name === nextName);
              setSubjectId(matched ? matched.id : '');
              handleChange();
            }}
            placeholder="e.g., Mathematik"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Exam Name</label>
          <input
            type="text"
            value={examName}
            onChange={(e) => {
              setExamName(e.target.value);
              handleChange();
            }}
            placeholder="e.g., Klassenarbeit 1"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Exam Type</label>
          <select
            value={examType}
            onChange={(e) => {
              setExamType(e.target.value);
              handleChange();
            }}
            className="form-input"
          >
            <option value="Schulaufgabe">Schulaufgabe (weight: 2x)</option>
            <option value="Klassenarbeit">Klassenarbeit (weight: 1x)</option>
            <option value="Mundliche Note">Mundliche Note (weight: 1x)</option>
          </select>
        </div>

        <div className="form-group">
          <label>How Often Counts</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value);
              handleChange();
            }}
            min="0.5"
            step="0.5"
            placeholder="e.g., 1, 2, 3"
            className="form-input"
          />
          <span className="grade-display">This exam counts {weight}x in the average</span>
        </div>

        <div className="form-group">
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              handleChange();
            }}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>
            Grade (1-6, where 1 is best)
            <span className="grade-display">{getGradeLabel(parseFloat(grade))}</span>
          </label>
          <div className="grade-selector">
            {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6].map((g) => (
              <button
                key={g}
                type="button"
                className={`grade-btn ${grade === g.toString() ? 'active' : ''}`}
                onClick={() => {
                  setGrade(g.toString());
                  handleChange();
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="grade-info">
          <p>
            <strong>German Grading System</strong>
            <br />
            1 = Sehr gut (Very Good)
            <br />
            2 = Gut (Good)
            <br />
            3 = Befriedigend (Satisfactory)
            <br />
            4 = Ausreichend (Sufficient)
            <br />
            5 = Mangelhaft (Inadequate)
            <br />
            6 = Ungenuegend (Failing)
          </p>
        </div>
      </div>
    </div>
  );
}

export default GradeEditor;
