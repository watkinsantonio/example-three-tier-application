const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Parse a due_date from a request body.
// Returns { value } with a 'YYYY-MM-DD' string or null, or { error } if invalid.
function parseDueDate(input) {
  if (input === null || input === '') return { value: null };
  if (typeof input !== 'string') return { error: 'due_date must be a YYYY-MM-DD string or null' };
  const match = DATE_RE.exec(input);
  if (!match) return { error: 'due_date must be a YYYY-MM-DD string or null' };
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    y < 1 ||
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return { error: 'due_date is not a valid calendar date' };
  }
  return { value: input };
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// GET /tasks — list all tasks
app.get('/tasks', async (_req, res) => {
  const { rows } = await db.query('SELECT * FROM tasks ORDER BY created_at ASC');
  res.json(rows);
});

// POST /tasks — create a task (optional due_date: 'YYYY-MM-DD')
app.post('/tasks', async (req, res) => {
  const { title, due_date } = req.body ?? {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  let dueDate = null;
  if (due_date !== undefined) {
    const parsed = parseDueDate(due_date);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    dueDate = parsed.value;
  }

  const { rows } = await db.query(
    'INSERT INTO tasks (title, due_date) VALUES ($1, $2) RETURNING *',
    [title.trim(), dueDate]
  );
  res.status(201).json(rows[0]);
});

// PATCH /tasks/:id — update a task (complete/uncomplete, rename, or change due_date)
app.patch('/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Not found' });
  const { completed, title, due_date } = req.body ?? {};

  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    return res.status(400).json({ error: 'title must be a non-empty string' });
  }

  let parsedDueDate;
  if (due_date !== undefined) {
    parsedDueDate = parseDueDate(due_date);
    if (parsedDueDate.error) return res.status(400).json({ error: parsedDueDate.error });
  }

  const { rows } = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const current = rows[0];
  const newCompleted = completed !== undefined ? Boolean(completed) : current.completed;
  const newTitle = title !== undefined ? title.trim() : current.title;
  const newDueDate = parsedDueDate ? parsedDueDate.value : current.due_date;

  const { rows: updated } = await db.query(
    'UPDATE tasks SET completed = $1, title = $2, due_date = $3 WHERE id = $4 RETURNING *',
    [newCompleted, newTitle, newDueDate, id]
  );
  res.json(updated[0]);
});

// DELETE /tasks/:id — delete a task
app.delete('/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Not found' });

  const { rows } = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

  await db.query('DELETE FROM tasks WHERE id = $1', [id]);
  res.status(204).send();
});

// GET /calendar/:year/:month — tasks due in the given month (month is 1-12), ordered by date
app.get('/calendar/:year/:month', async (req, res) => {
  const { year: yearParam, month: monthParam } = req.params;
  if (!/^\d{4}$/.test(yearParam) || !/^\d{1,2}$/.test(monthParam)) {
    return res.status(400).json({ error: 'year must be YYYY and month must be 1-12' });
  }
  const year = Number(yearParam);
  const month = Number(monthParam);
  if (year < 1 || month < 1 || month > 12) {
    return res.status(400).json({ error: 'year must be YYYY and month must be 1-12' });
  }

  const { rows } = await db.query(
    `SELECT * FROM tasks
     WHERE due_date >= make_date($1, $2, 1)
       AND due_date < make_date($1, $2, 1) + interval '1 month'
     ORDER BY due_date ASC, created_at ASC`,
    [year, month]
  );
  res.json(rows);
});

// GET /drinks — list drinks with their rating count and average, best rated first
app.get('/drinks', async (_req, res) => {
  const { rows } = await db.query(
    `SELECT d.id, d.name, d.created_at,
            COUNT(r.id)::int AS rating_count,
            ROUND(AVG(r.score), 1)::float8 AS average_rating
     FROM drinks d
     LEFT JOIN drink_ratings r ON r.drink_id = d.id
     GROUP BY d.id
     ORDER BY average_rating DESC NULLS LAST, d.name ASC`
  );
  res.json(rows);
});

// POST /drinks — add a drink (name is 1-100 characters, unique ignoring case)
app.post('/drinks', async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const trimmed = name.trim();
  if (trimmed.length > 100) {
    return res.status(400).json({ error: 'name must be 100 characters or fewer' });
  }

  const { rows } = await db.query(
    `INSERT INTO drinks (name) VALUES ($1)
     ON CONFLICT (lower(name)) DO NOTHING
     RETURNING id, name, created_at`,
    [trimmed]
  );
  if (rows.length === 0) return res.status(409).json({ error: 'That drink already exists' });
  res.status(201).json({ ...rows[0], rating_count: 0, average_rating: null });
});

// POST /drinks/:id/ratings — rate a drink with a whole score from 1 to 5
app.post('/drinks/:id/ratings', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Not found' });

  const { score } = req.body ?? {};
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ error: 'score must be a whole number from 1 to 5' });
  }

  const { rows: drinks } = await db.query('SELECT id FROM drinks WHERE id = $1', [id]);
  if (drinks.length === 0) return res.status(404).json({ error: 'Not found' });

  const { rows } = await db.query(
    'INSERT INTO drink_ratings (drink_id, score) VALUES ($1, $2) RETURNING id, drink_id, score, created_at',
    [id, score]
  );
  res.status(201).json(rows[0]);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

module.exports = app;
