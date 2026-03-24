const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL ||
  'https://nrrkwzjxjgvjnoiyeghc.supabase.co';
const supabaseAnonKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ycmt3emp4amd2am5vaXllZ2hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODg4OTEsImV4cCI6MjA4NzY2NDg5MX0.PR5MN7ikWgxodm-_T66vMKTher0UmXXh7X45Xzyxyhg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const defaultSqlPath = 'c:\\Users\\GOWTHAM M\\Downloads\\STUDENTS_SUPERBASE_ALL_DATA.sql';
const sqlPath = process.argv[2] || defaultSqlPath;

const parseValues = (line) => {
  const matches = [...line.matchAll(/'((?:''|[^'])*)'/g)].map((item) => item[1].replace(/''/g, "'"));
  if (matches.length !== 5) return null;

  return {
    register_no: matches[0].trim(),
    name: matches[1].trim(),
    department: matches[2].trim(),
    mobile_no: matches[3].replace(/\s+/g, '').trim(),
    email: matches[4].trim().toLowerCase(),
  };
};

const chunk = (items, size) => {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
};

async function run() {
  const resolvedPath = path.resolve(sqlPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`SQL file not found: ${resolvedPath}`);
  }

  const sql = fs.readFileSync(resolvedPath, 'utf8');
  const lines = sql.split(/\r?\n/);
  const insertLines = lines.filter((line) => /insert\s+into\s+students\s+values/i.test(line));

  if (!insertLines.length) {
    throw new Error('No STUDENTS insert lines found in file.');
  }

  const parsedRows = insertLines.map(parseValues).filter(Boolean);

  if (!parsedRows.length) {
    throw new Error('Could not parse any student rows.');
  }

  const uniqueByRegisterNo = new Map();
  for (const row of parsedRows) {
    uniqueByRegisterNo.set(row.register_no, row);
  }

  const rows = [...uniqueByRegisterNo.values()];

  console.log(`Parsed ${parsedRows.length} rows, unique by register_no: ${rows.length}`);

  const { error: deleteError } = await supabase.from('students').delete().neq('register_no', '');
  if (deleteError) {
    throw new Error(`Failed to clear existing students: ${deleteError.message}`);
  }

  const batches = chunk(rows, 500);
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const { error } = await supabase.from('students').insert(batches[batchIndex]);
    if (error) {
      throw new Error(`Batch ${batchIndex + 1}/${batches.length} insert failed: ${error.message}`);
    }
    console.log(`Inserted batch ${batchIndex + 1}/${batches.length}`);
  }

  const { count, error: countError } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    throw new Error(`Inserted but count check failed: ${countError.message}`);
  }

  console.log(`✅ Students import complete. Final row count: ${count}`);
}

run().catch((error) => {
  console.error('❌ Import failed');
  console.error(error.message || error);
  process.exit(1);
});
