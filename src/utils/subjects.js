export const getSubjectByIdFromList = (subjects, subjectId) => {
  if (!subjectId) return null;
  return (subjects || []).find((subject) => subject.id === subjectId) || null;
};

export const getSubjectById = (subjects, subjectId) => getSubjectByIdFromList(subjects, subjectId);

export const calculateWeightedAverage = (exams) => {
  if (!Array.isArray(exams) || exams.length === 0) return null;

  const typeWeights = {
    Schulaufgabe: 2,
    Klassenarbeit: 1,
    'Mundliche Note': 1,
  };

  let totalWeightedGrade = 0;
  let totalWeight = 0;

  exams.forEach((exam) => {
    const typeWeight = typeWeights[exam.type] || 1;
    const individualWeight = exam.weight || 1;
    const weight = typeWeight * individualWeight;
    totalWeightedGrade += exam.grade * weight;
    totalWeight += weight;
  });

  if (!totalWeight) return null;
  return Number((totalWeightedGrade / totalWeight).toFixed(2));
};
