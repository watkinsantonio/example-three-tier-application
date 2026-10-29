exports.up = (pgm) => {
  pgm.addColumn('tasks', {
    due_date: { type: 'date' },
  });
  pgm.createIndex('tasks', 'due_date');
};

exports.down = (pgm) => {
  pgm.dropIndex('tasks', 'due_date');
  pgm.dropColumn('tasks', 'due_date');
};
