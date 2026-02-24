import React, { useRef } from 'react';
import './WorkloadHeatmap.css';

const getBaseClass = (value) => {
  if (value >= 220) return 'heavy';
  if (value >= 110) return 'medium';
  return 'light';
};

const labelDate = (date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

function WorkloadHeatmap({ days }) {
  const prevClasses = useRef({});

  // Hysteresis margin to avoid bouncing when values hover near thresholds
  const MARGIN = 30; // workload units
  const T_MED = 110;
  const T_HEAVY = 220;

  return (
    <div className="workload-heatmap">
      <div className="workload-grid">
        {(days || []).map((item) => {
          const key = item.date.toISOString();
          const base = getBaseClass(item.workload);
          const prev = prevClasses.current[key];
          let cls = base;

          if (prev && prev !== base) {
            // light <-> medium
            if (prev === 'light' && base === 'medium' && item.workload < T_MED + MARGIN) {
              cls = 'light';
            } else if (prev === 'medium' && base === 'light' && item.workload > T_MED - MARGIN) {
              cls = 'medium';
            }
            // medium <-> heavy
            else if (prev === 'medium' && base === 'heavy' && item.workload < T_HEAVY + MARGIN) {
              cls = 'medium';
            } else if (prev === 'heavy' && base === 'medium' && item.workload > T_HEAVY - MARGIN) {
              cls = 'heavy';
            }
          }

          prevClasses.current[key] = cls;

          return (
            <div
              key={key}
              className={`workload-cell ${cls}`}
              title={`${labelDate(item.date)}: ${item.tasksCount} tasks, ${item.examsCount} exams, ${item.classesCount} classes`}
            >
              <span>{item.date.getDate()}</span>
            </div>
          );
        })}
      </div>
      <div className="workload-legend">
        <span><i className="dot light" /> Light</span>
        <span><i className="dot medium" /> Medium</span>
        <span><i className="dot heavy" /> Heavy</span>
      </div>
    </div>
  );
}

export default WorkloadHeatmap;
