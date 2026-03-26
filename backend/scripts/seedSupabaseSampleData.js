const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  const attendanceRows = [
    { student_email: 'alice@university.edu', student_name: 'Alice Johnson', roll_no: 'CS2021001', course_code: 'CS301', course_name: 'Data Structures & Algorithms', attendance_date: '2026-02-20', is_present: true, faculty_email: 'faculty@university.edu' },
    { student_email: 'alice@university.edu', student_name: 'Alice Johnson', roll_no: 'CS2021001', course_code: 'CS301', course_name: 'Data Structures & Algorithms', attendance_date: '2026-02-21', is_present: true, faculty_email: 'faculty@university.edu' },
    { student_email: 'alice@university.edu', student_name: 'Alice Johnson', roll_no: 'CS2021001', course_code: 'CS301', course_name: 'Data Structures & Algorithms', attendance_date: '2026-02-22', is_present: false, faculty_email: 'faculty@university.edu' },
    { student_email: 'alice@university.edu', student_name: 'Alice Johnson', roll_no: 'CS2021001', course_code: 'CS402', course_name: 'Database Management Systems', attendance_date: '2026-02-20', is_present: true, faculty_email: 'faculty@university.edu' },
    { student_email: 'alice@university.edu', student_name: 'Alice Johnson', roll_no: 'CS2021001', course_code: 'CS402', course_name: 'Database Management Systems', attendance_date: '2026-02-21', is_present: true, faculty_email: 'faculty@university.edu' },
    { student_email: 'alice@university.edu', student_name: 'Alice Johnson', roll_no: 'CS2021001', course_code: 'CS402', course_name: 'Database Management Systems', attendance_date: '2026-02-22', is_present: true, faculty_email: 'faculty@university.edu' },
    { student_email: 'alice@university.edu', student_name: 'Alice Johnson', roll_no: 'CS2021001', course_code: 'CS303', course_name: 'Operating Systems', attendance_date: '2026-02-20', is_present: true, faculty_email: 'faculty@university.edu' },
    { student_email: 'alice@university.edu', student_name: 'Alice Johnson', roll_no: 'CS2021001', course_code: 'CS303', course_name: 'Operating Systems', attendance_date: '2026-02-21', is_present: false, faculty_email: 'faculty@university.edu' },
    { student_email: 'alice@university.edu', student_name: 'Alice Johnson', roll_no: 'CS2021001', course_code: 'CS303', course_name: 'Operating Systems', attendance_date: '2026-02-22', is_present: true, faculty_email: 'faculty@university.edu' },
  ];

  const marksRows = [
    { student_email: 'alice@university.edu', student_name: 'Alice Johnson', roll_no: 'CS2021001', course_code: 'CS301', course_name: 'Data Structures & Algorithms', mid_term: 85, assignment: 90, quiz: 88, end_term: 87, total: 87.2, grade: 'A', faculty_email: 'faculty@university.edu' },
    { student_email: 'alice@university.edu', student_name: 'Alice Johnson', roll_no: 'CS2021001', course_code: 'CS402', course_name: 'Database Management Systems', mid_term: 78, assignment: 82, quiz: 75, end_term: 80, total: 79.3, grade: 'B+', faculty_email: 'faculty@university.edu' },
    { student_email: 'alice@university.edu', student_name: 'Alice Johnson', roll_no: 'CS2021001', course_code: 'CS303', course_name: 'Operating Systems', mid_term: 82, assignment: 85, quiz: 80, end_term: 83, total: 82.5, grade: 'A-', faculty_email: 'faculty@university.edu' },
  ];

  const { error: attendanceError } = await supabase
    .from('attendance_records')
    .upsert(attendanceRows, { onConflict: 'student_email,course_code,attendance_date' });

  if (attendanceError) {
    throw new Error(`attendance seed failed: ${attendanceError.message}`);
  }

  const { error: marksError } = await supabase
    .from('marks_records')
    .upsert(marksRows, { onConflict: 'student_email,course_code' });

  if (marksError) {
    throw new Error(`marks seed failed: ${marksError.message}`);
  }

  const { count: attendanceCount, error: attendanceCountError } = await supabase
    .from('attendance_records')
    .select('*', { count: 'exact', head: true })
    .eq('student_email', 'alice@university.edu');

  if (attendanceCountError) {
    throw new Error(`attendance verification failed: ${attendanceCountError.message}`);
  }

  const { count: marksCount, error: marksCountError } = await supabase
    .from('marks_records')
    .select('*', { count: 'exact', head: true })
    .eq('student_email', 'alice@university.edu');

  if (marksCountError) {
    throw new Error(`marks verification failed: ${marksCountError.message}`);
  }

  console.log('✅ Seeded sample student data for alice@university.edu');
  console.log(`✅ Attendance rows for Alice: ${attendanceCount}`);
  console.log(`✅ Marks rows for Alice: ${marksCount}`);
}

seed().catch((error) => {
  console.error('❌ Seeding failed');
  console.error(error.message || error);
  process.exit(1);
});
