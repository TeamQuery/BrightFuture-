import pool from './index.js';
import bcrypt from 'bcryptjs';

const seed = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing data
    await client.query(`
      TRUNCATE notifications, events, book_borrowings, library_books,
      fee_payments, fee_categories, grades, exams, attendance,
      timetable, subjects, student_parents, parents, students,
      classes, users RESTART IDENTITY CASCADE
    `);

    const hash = await bcrypt.hash('password123', 10);

    // Users
    const usersRes = await client.query(`
      INSERT INTO users (name, email, password, role, phone) VALUES
      ('Dr. Samuel Asante', 'admin@brightfuture.edu.gh', $1, 'admin', '+233 20 000 0001'),
      ('Mrs. Abena Mensah', 'abena.mensah@brightfuture.edu.gh', $1, 'teacher', '+233 20 111 0001'),
      ('Mr. Kweku Boateng', 'kweku.boateng@brightfuture.edu.gh', $1, 'teacher', '+233 20 111 0002'),
      ('Ms. Ama Owusu', 'ama.owusu@brightfuture.edu.gh', $1, 'teacher', '+233 20 111 0003'),
      ('Mr. Kofi Agyeman', 'kofi.agyeman@brightfuture.edu.gh', $1, 'teacher', '+233 20 111 0004'),
      ('Mrs. Efua Darko', 'efua.darko@brightfuture.edu.gh', $1, 'teacher', '+233 20 111 0005'),
      ('Mrs. Grace Tetteh', 'grace.tetteh@brightfuture.edu.gh', $1, 'parent', '+233 24 222 0001'),
      ('Mr. Benjamin Asare', 'ben.asare@brightfuture.edu.gh', $1, 'parent', '+233 24 222 0002'),
      ('Ms. Adwoa Frimpong', 'adwoa.frimpong@brightfuture.edu.gh', $1, 'parent', '+233 24 222 0003'),
      ('Mr. Nana Adu', 'nana.adu@brightfuture.edu.gh', $1, 'parent', '+233 24 222 0004'),
      ('Ms. Akua Sarpong', 'akua.sarpong@brightfuture.edu.gh', $1, 'librarian', '+233 20 333 0001'),
      ('Mr. Yaw Ofori', 'yaw.ofori@brightfuture.edu.gh', $1, 'accountant', '+233 20 444 0001')
      RETURNING id, role, name
    `, [hash]);

    const users = usersRes.rows;
    const admin = users.find(u => u.role === 'admin');
    const teachers = users.filter(u => u.role === 'teacher');
    const parents = users.filter(u => u.role === 'parent');

    // Classes
    const classesRes = await client.query(`
      INSERT INTO classes (name, grade_level, section, capacity, room, teacher_id, academic_year) VALUES
      ('Grade 1A', 'Grade 1', 'A', 30, 'Room 101', $1, '2024/2025'),
      ('Grade 1B', 'Grade 1', 'B', 30, 'Room 102', $2, '2024/2025'),
      ('Grade 2A', 'Grade 2', 'A', 30, 'Room 201', $3, '2024/2025'),
      ('Grade 2B', 'Grade 2', 'B', 30, 'Room 202', $4, '2024/2025'),
      ('Grade 3A', 'Grade 3', 'A', 28, 'Room 301', $5, '2024/2025'),
      ('Grade 3B', 'Grade 3', 'B', 28, 'Room 302', $1, '2024/2025')
      RETURNING id, name
    `, [teachers[0].id, teachers[1].id, teachers[2].id, teachers[3].id, teachers[4].id]);

    const classes = classesRes.rows;

    // Subjects
    const subjectsRes = await client.query(`
      INSERT INTO subjects (name, code, description, grade_level, credits) VALUES
      ('Mathematics', 'MATH', 'Numbers, arithmetic, geometry', 'All', 2),
      ('English Language', 'ENG', 'Reading, writing, grammar', 'All', 2),
      ('Science', 'SCI', 'Basic science concepts', 'All', 2),
      ('Social Studies', 'SOC', 'History, geography, civics', 'All', 1),
      ('Creative Arts', 'ART', 'Drawing, crafts, music', 'All', 1),
      ('Physical Education', 'PE', 'Sports and physical fitness', 'All', 1),
      ('Ghanaian Language', 'GLAN', 'Twi, Ga, Ewe or Fante', 'All', 1),
      ('Information Technology', 'ICT', 'Basic computing skills', 'Grade 2-3', 1)
      RETURNING id, name
    `);
    const subjects = subjectsRes.rows;

    // Students
    const studentsData = [
      ['STU001','Kwame','Asante','2017-03-15','Male',classes[0].id,'A+'],
      ['STU002','Akosua','Mensah','2017-07-22','Female',classes[0].id,'O+'],
      ['STU003','Fiifi','Boateng','2017-11-10','Male',classes[0].id,'B+'],
      ['STU004','Esi','Owusu','2017-01-05','Female',classes[0].id,'AB+'],
      ['STU005','Kojo','Agyeman','2017-06-18','Male',classes[0].id,'O-'],
      ['STU006','Adwoa','Darko','2016-08-30','Female',classes[1].id,'A+'],
      ['STU007','Yaw','Tetteh','2016-12-14','Male',classes[1].id,'O+'],
      ['STU008','Abena','Asare','2016-04-02','Female',classes[1].id,'B-'],
      ['STU009','Kofi','Frimpong','2016-09-25','Male',classes[1].id,'AB-'],
      ['STU010','Ama','Adu','2016-02-17','Female',classes[1].id,'O+'],
      ['STU011','Nana','Sarpong','2015-05-08','Male',classes[2].id,'A-'],
      ['STU012','Efua','Antwi','2015-10-19','Female',classes[2].id,'B+'],
      ['STU013','Kweku','Osei','2015-03-27','Male',classes[2].id,'O+'],
      ['STU014','Afia','Bonsu','2015-07-11','Female',classes[2].id,'A+'],
      ['STU015','Yaa','Appiah','2015-11-30','Female',classes[3].id,'O-'],
      ['STU016','Kwabena','Ofori','2015-01-23','Male',classes[3].id,'B+'],
      ['STU017','Maame','Asante','2014-06-05','Female',classes[4].id,'AB+'],
      ['STU018','Ato','Mensah','2014-09-14','Male',classes[4].id,'O+'],
      ['STU019','Akua','Boateng','2014-12-08','Female',classes[4].id,'A+'],
      ['STU020','Kwei','Owusu','2014-03-21','Male',classes[5].id,'B-'],
    ];

    const studentsRes = await client.query(`
      INSERT INTO students (student_id, first_name, last_name, date_of_birth, gender, class_id, blood_group, address)
      VALUES ${studentsData.map((_, i) => `($${i*7+1},$${i*7+2},$${i*7+3},$${i*7+4},$${i*7+5},$${i*7+6},$${i*7+7},'Accra, Ghana')`).join(',')}
      RETURNING id, first_name, last_name
    `, studentsData.flat());

    const students = studentsRes.rows;

    // Parents
    const parentsRes = await client.query(`
      INSERT INTO parents (user_id, first_name, last_name, email, phone, occupation, address, relationship) VALUES
      ($1, 'Grace', 'Tetteh', 'grace.tetteh@gmail.com', '+233 24 222 0001', 'Nurse', 'East Legon, Accra', 'Mother'),
      ($2, 'Benjamin', 'Asare', 'ben.asare@gmail.com', '+233 24 222 0002', 'Engineer', 'Tema, Ghana', 'Father'),
      ($3, 'Adwoa', 'Frimpong', 'adwoa.f@gmail.com', '+233 24 222 0003', 'Teacher', 'Kumasi, Ghana', 'Mother'),
      ($4, 'Nana', 'Adu', 'nana.adu@gmail.com', '+233 24 222 0004', 'Businessman', 'Osu, Accra', 'Father')
      RETURNING id
    `, [parents[0].id, parents[1].id, parents[2].id, parents[3].id]);

    const parentsRows = parentsRes.rows;

    // Link students to parents
    await client.query(`
      INSERT INTO student_parents (student_id, parent_id) VALUES
      ($1,$5),($2,$5),($3,$6),($4,$6),($5,$7),($6,$7),($7,$8),($8,$8)
    `, [students[0].id, students[1].id, students[2].id, students[3].id,
        students[4].id, students[5].id, students[6].id, students[7].id,
        parentsRows[0].id, parentsRows[1].id, parentsRows[2].id, parentsRows[3].id]);

    // Timetable
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
    const slots = [['08:00','09:00'],['09:00','10:00'],['10:30','11:30'],['11:30','12:30'],['13:30','14:30'],['14:30','15:30']];
    const timetableValues = [];
    const timetableParams = [];
    let pIdx = 1;
    for (const cls of classes.slice(0, 3)) {
      for (const day of days) {
        for (let s = 0; s < Math.min(subjects.length, slots.length); s++) {
          timetableValues.push(`($${pIdx},$${pIdx+1},$${pIdx+2},$${pIdx+3},$${pIdx+4},$${pIdx+5},'2024/2025')`);
          timetableParams.push(cls.id, subjects[s % subjects.length].id, teachers[0].id, day, slots[s][0], slots[s][1]);
          pIdx += 6;
        }
      }
    }
    await client.query(`INSERT INTO timetable (class_id, subject_id, teacher_id, day_of_week, start_time, end_time, academic_year) VALUES ${timetableValues.join(',')}`, timetableParams);

    // Attendance - last 30 days
    const attendanceValues = [];
    const attendanceParams = [];
    let aIdx = 1;
    const statuses = ['present','present','present','present','absent','late'];
    for (let d = 0; d < 20; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const dateStr = date.toISOString().split('T')[0];
      for (const student of students.slice(0, 15)) {
        const st = statuses[Math.floor(Math.random() * statuses.length)];
        attendanceValues.push(`($${aIdx},$${aIdx+1},$${aIdx+2},$${aIdx+3},$${aIdx+4})`);
        attendanceParams.push(student.id, classes[0].id, dateStr, st, teachers[0].id);
        aIdx += 5;
      }
    }
    if (attendanceValues.length > 0) {
      await client.query(`INSERT INTO attendance (student_id, class_id, date, status, marked_by) VALUES ${attendanceValues.join(',')} ON CONFLICT DO NOTHING`, attendanceParams);
    }

    // Exams
    const examsRes = await client.query(`
      INSERT INTO exams (name, subject_id, class_id, exam_date, total_marks, passing_marks, exam_type, academic_year, term) VALUES
      ('Mid-Term Math Test', $1, $7, '2025-02-14', 100, 50, 'midterm', '2024/2025', 'Term 2'),
      ('Mid-Term English Test', $2, $7, '2025-02-15', 100, 50, 'midterm', '2024/2025', 'Term 2'),
      ('Science Quiz 1', $3, $7, '2025-01-20', 50, 25, 'quiz', '2024/2025', 'Term 2'),
      ('Social Studies Assignment', $4, $8, '2025-02-10', 30, 15, 'assignment', '2024/2025', 'Term 2'),
      ('Arts Project', $5, $8, '2025-02-20', 50, 25, 'project', '2024/2025', 'Term 2'),
      ('Final Math Exam', $1, $9, '2025-03-15', 100, 50, 'final', '2024/2025', 'Term 2'),
      ('Final English Exam', $2, $9, '2025-03-16', 100, 50, 'final', '2024/2025', 'Term 2')
      RETURNING id
    `, [subjects[0].id, subjects[1].id, subjects[2].id, subjects[3].id, subjects[4].id,
        classes[0].id, classes[1].id, classes[2].id]);

    const exams = examsRes.rows;

    // Grades
    const gradesValues = [];
    const gradesParams = [];
    let gIdx = 1;
    const gradeLetters = (m, t) => {
      const pct = (m / t) * 100;
      if (pct >= 80) return 'A';
      if (pct >= 70) return 'B';
      if (pct >= 60) return 'C';
      if (pct >= 50) return 'D';
      return 'F';
    };
    for (const exam of exams.slice(0, 3)) {
      for (const student of students.slice(0, 10)) {
        const marks = Math.floor(Math.random() * 50) + 50;
        const letter = gradeLetters(marks, 100);
        gradesValues.push(`($${gIdx},$${gIdx+1},$${gIdx+2},$${gIdx+3},$${gIdx+4})`);
        gradesParams.push(student.id, exam.id, marks, letter, teachers[0].id);
        gIdx += 5;
      }
    }
    await client.query(`INSERT INTO grades (student_id, exam_id, marks_obtained, grade_letter, graded_by) VALUES ${gradesValues.join(',')} ON CONFLICT DO NOTHING`, gradesParams);

    // Fee categories
    const feeCatsRes = await client.query(`
      INSERT INTO fee_categories (name, description, amount, frequency) VALUES
      ('Tuition Fee', 'Academic tuition for the term', 1200.00, 'termly'),
      ('PTA Levy', 'Parent-Teacher Association dues', 50.00, 'annual'),
      ('Sports Fee', 'Sports equipment and activities', 80.00, 'annual'),
      ('Library Fee', 'Library resources access', 30.00, 'annual'),
      ('ICT Fee', 'Computer lab and technology', 100.00, 'termly'),
      ('Uniform Fee', 'School uniform cost', 150.00, 'one-time'),
      ('Examination Fee', 'End of term examination', 60.00, 'termly')
      RETURNING id
    `);
    const feeCats = feeCatsRes.rows;

    // Fee payments
    const payMethods = ['cash','bank_transfer','mobile_money','card'];
    const feeValues = [];
    const feeParams = [];
    let fIdx = 1;
    for (const student of students.slice(0, 15)) {
      for (const cat of feeCats.slice(0, 3)) {
        const paid = Math.random() > 0.2;
        const status = paid ? 'paid' : (Math.random() > 0.5 ? 'pending' : 'partial');
        const amount = paid ? cat.amount : cat.amount * 0.5;
        feeValues.push(`($${fIdx},$${fIdx+1},$${fIdx+2},$${fIdx+3},$${fIdx+4},'2024/2025','Term 2',$${fIdx+5},$${fIdx+6})`);
        feeParams.push(student.id, cat.id, amount, payMethods[Math.floor(Math.random()*payMethods.length)], `REF-${Math.random().toString(36).substr(2,8).toUpperCase()}`, status, admin.id);
        fIdx += 7;
      }
    }
    await client.query(`INSERT INTO fee_payments (student_id, category_id, amount_paid, payment_method, reference_number, academic_year, term, status, received_by) VALUES ${feeValues.join(',')}`, feeParams);

    // Library books
    const booksRes = await client.query(`
      INSERT INTO library_books (title, author, isbn, category, publisher, publish_year, total_copies, available_copies, location) VALUES
      ('The Math Adventure', 'Dr. Kwame Asante', '978-1-234-56789-0', 'Mathematics', 'Ghana Education Press', 2020, 5, 4, 'Shelf A1'),
      ('English for Beginners', 'Prof. Ama Serwaa', '978-1-234-56789-1', 'Language Arts', 'Accra Publishers', 2019, 8, 6, 'Shelf B1'),
      ('Our Beautiful Ghana', 'Nana Adu Asante', '978-1-234-56789-2', 'Social Studies', 'West Africa Books', 2021, 4, 4, 'Shelf C1'),
      ('Science Made Easy Grade 1', 'Dr. Efua Mensah', '978-1-234-56789-3', 'Science', 'Ghana Education Press', 2022, 6, 5, 'Shelf D1'),
      ('Anansi the Spider Stories', 'Kofi Awoonor', '978-1-234-56789-4', 'Fiction/Folklore', 'Sub-Saharan Publishers', 2018, 10, 8, 'Shelf E1'),
      ('Colors and Shapes', 'Ms. Abena Frimpong', '978-1-234-56789-5', 'Arts', 'Creative Books GH', 2020, 7, 7, 'Shelf F1'),
      ('My Body and Health', 'Dr. Yaw Adu', '978-1-234-56789-6', 'Health Science', 'Med-Edu Press', 2021, 5, 3, 'Shelf D2'),
      ('Numbers are Fun', 'Prof. Kojo Boateng', '978-1-234-56789-7', 'Mathematics', 'Ghana Education Press', 2019, 9, 8, 'Shelf A2'),
      ('Animals of Africa', 'Dr. Esi Asare', '978-1-234-56789-8', 'Science', 'Nature Books', 2022, 6, 5, 'Shelf D3'),
      ('The ABCs of Life', 'Maame Ama', '978-1-234-56789-9', 'Language Arts', 'Kids Ghana Press', 2020, 12, 10, 'Shelf B2'),
      ('Computer Basics for Kids', 'Mr. Tech Mensah', '978-1-234-56789-A', 'ICT', 'Digital Press GH', 2023, 4, 4, 'Shelf G1'),
      ('Tales from West Africa', 'Ama Ata Aidoo', '978-1-234-56789-B', 'Fiction', 'Pan African Books', 2017, 8, 6, 'Shelf E2')
      RETURNING id
    `);
    const books = booksRes.rows;

    // Book borrowings
    await client.query(`
      INSERT INTO book_borrowings (book_id, borrower_type, borrower_id, borrow_date, due_date, return_date, status, issued_by) VALUES
      ($1, 'student', $7, '2025-02-01', '2025-02-15', '2025-02-14', 'returned', $13),
      ($2, 'student', $8, '2025-02-10', '2025-02-24', NULL, 'borrowed', $13),
      ($3, 'student', $9, '2025-01-20', '2025-02-03', NULL, 'overdue', $13),
      ($4, 'teacher', $10, '2025-02-05', '2025-02-19', '2025-02-18', 'returned', $13),
      ($5, 'student', $11, '2025-02-12', '2025-02-26', NULL, 'borrowed', $13),
      ($6, 'student', $12, '2025-02-15', '2025-03-01', NULL, 'borrowed', $13)
    `, [books[0].id, books[1].id, books[2].id, books[3].id, books[4].id, books[5].id,
        students[0].id, students[1].id, students[2].id, teachers[0].id, students[3].id, students[4].id,
        admin.id]);

    // Events
    await client.query(`
      INSERT INTO events (title, description, event_date, end_date, event_type, target_audience, created_by) VALUES
      ('End of Term Examinations', 'Final examinations for Term 2', '2025-03-15', '2025-03-20', 'exam', 'all', $1),
      ('Sports Day 2025', 'Annual inter-class sports competition', '2025-03-28', '2025-03-28', 'sports', 'all', $1),
      ('Parent-Teacher Meeting', 'Term 2 result discussion with parents', '2025-04-05', '2025-04-05', 'meeting', 'all', $1),
      ('Independence Day Celebration', 'Ghana Independence Day activities', '2025-03-06', '2025-03-06', 'cultural', 'all', $1),
      ('Science Fair', 'Grade 2 and 3 science project presentations', '2025-02-28', '2025-02-28', 'academic', 'all', $1),
      ('Easter Break', 'School closed for Easter holiday', '2025-04-18', '2025-04-25', 'holiday', 'all', $1),
      ('Reading Week', 'Encourage reading across all grades', '2025-03-10', '2025-03-14', 'academic', 'all', $1)
    `, [admin.id]);

    await client.query('COMMIT');
    console.log('✅ Database seeded successfully with dummy data');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err.message);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
};

seed();
