exports.up = (pgm) => {
  pgm.createTable('drinks', {
    id: { type: 'serial', primaryKey: true },
    name: { type: 'varchar(100)', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
  });
  // Drink names are unique regardless of case, so "Negroni" and "negroni" are one drink.
  pgm.sql('CREATE UNIQUE INDEX drinks_name_lower_key ON drinks (lower(name))');

  pgm.createTable('drink_ratings', {
    id: { type: 'serial', primaryKey: true },
    drink_id: {
      type: 'integer',
      notNull: true,
      references: 'drinks',
      onDelete: 'CASCADE',
    },
    score: { type: 'smallint', notNull: true, check: 'score BETWEEN 1 AND 5' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('drink_ratings', 'drink_id');
};

exports.down = (pgm) => {
  pgm.dropTable('drink_ratings');
  pgm.dropTable('drinks'); // also drops drinks_name_lower_key
};
