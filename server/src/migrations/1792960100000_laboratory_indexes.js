export const up = (pgm) => {
  pgm.sql(`
    CREATE INDEX market_datasets_user_created_idx ON market_datasets(user_id, created_at);
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX market_datasets_user_created_idx;
  `)
}
