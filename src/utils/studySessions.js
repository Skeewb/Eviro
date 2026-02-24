export const normalizeStudySession = (session) => ({
  ...session,
  subjectId: session?.subjectId ?? null,
});
