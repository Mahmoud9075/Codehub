const { supabase } = require('./supabase');

const GRADE_LEVELS = ['first_secondary', 'second_secondary'];

function isValidGradeLevel(value) {
  return GRADE_LEVELS.includes(String(value || '').trim());
}

function gradeLabel(value) {
  if (value === 'first_secondary') return 'أولى ثانوي';
  if (value === 'second_secondary') return 'ثانية ثانوي';
  return 'غير محدد';
}

async function getStudentStudyProfile(studentId) {
  const { data, error } = await supabase
    .from('students')
    .select('id, grade_level, parent_phone, is_active')
    .eq('id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function getStudentGrade(studentId) {
  const student = await getStudentStudyProfile(studentId);
  return student?.grade_level || null;
}

module.exports = {
  GRADE_LEVELS,
  isValidGradeLevel,
  gradeLabel,
  getStudentStudyProfile,
  getStudentGrade,
};
