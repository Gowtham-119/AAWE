const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://nrrkwzjxjgvjnoiyeghc.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ycmt3emp4amd2am5vaXllZ2hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODg4OTEsImV4cCI6MjA4NzY2NDg5MX0.PR5MN7ikWgxodm-_T66vMKTher0UmXXh7X45Xzyxyhg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  const testEmail = 'healthcheck.student@university.edu';

  console.log('Supabase URL:', supabaseUrl);
  console.log('Running connectivity and CRUD checks...');

  const attendanceRow = {
    student_email: testEmail,
    student_name: 'Health Check Student',
    roll_no: 'HC0001',
    course_code: 'HC101',
    course_name: 'Health Check Course',
    attendance_date: today,
    is_present: true,
    faculty_email: 'healthcheck.faculty@university.edu',
  };

  const marksRow = {
    student_email: testEmail,
    student_name: 'Health Check Student',
    roll_no: 'HC0001',
    course_code: 'HC101',
    course_name: 'Health Check Course',
    mid_term: 80,
    assignment: 85,
    quiz: 90,
    end_term: 88,
    total: 85.7,
    grade: 'A',
    faculty_email: 'healthcheck.faculty@university.edu',
  };

  const { error: attendanceUpsertError } = await supabase
    .from('attendance_records')
    .upsert([attendanceRow], { onConflict: 'student_email,course_code,attendance_date' });

  if (attendanceUpsertError) {
    throw new Error(`attendance upsert failed: ${attendanceUpsertError.message}`);
  }

  const { data: attendanceData, error: attendanceSelectError } = await supabase
    .from('attendance_records')
    .select('student_email, course_code, attendance_date, is_present')
    .eq('student_email', testEmail)
    .eq('course_code', 'HC101')
    .eq('attendance_date', today)
    .limit(1)
    .maybeSingle();

  if (attendanceSelectError) {
    throw new Error(`attendance select failed: ${attendanceSelectError.message}`);
  }

  if (!attendanceData) {
    throw new Error('attendance verification failed: row not found');
  }

  const { error: marksUpsertError } = await supabase
    .from('marks_records')
    .upsert([marksRow], { onConflict: 'student_email,course_code' });

  if (marksUpsertError) {
    throw new Error(`marks upsert failed: ${marksUpsertError.message}`);
  }

  const { data: marksData, error: marksSelectError } = await supabase
    .from('marks_records')
    .select('student_email, course_code, total, grade')
    .eq('student_email', testEmail)
    .eq('course_code', 'HC101')
    .limit(1)
    .maybeSingle();

  if (marksSelectError) {
    throw new Error(`marks select failed: ${marksSelectError.message}`);
  }

  if (!marksData) {
    throw new Error('marks verification failed: row not found');
  }

  const { error: attendanceDeleteError } = await supabase
    .from('attendance_records')
    .delete()
    .eq('student_email', testEmail)
    .eq('course_code', 'HC101')
    .eq('attendance_date', today);

  if (attendanceDeleteError) {
    throw new Error(`attendance cleanup failed: ${attendanceDeleteError.message}`);
  }

  const { error: marksDeleteError } = await supabase
    .from('marks_records')
    .delete()
    .eq('student_email', testEmail)
    .eq('course_code', 'HC101');

  if (marksDeleteError) {
    throw new Error(`marks cleanup failed: ${marksDeleteError.message}`);
  }

  console.log('✅ attendance_records: write/read/delete passed');
  console.log('✅ marks_records: write/read/delete passed');
  console.log('✅ Supabase integration is functioning.');
}

run().catch((err) => {
  console.error('❌ Supabase check failed');
  console.error(err.message || err);
  process.exit(1);
});
