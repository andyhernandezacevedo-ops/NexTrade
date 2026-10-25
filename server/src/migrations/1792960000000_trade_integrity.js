export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE trades
      ADD CONSTRAINT trades_closed_fields_check
        CHECK ((exit_price IS NULL) = (closed_at IS NULL)),
      ADD CONSTRAINT trades_result_requires_close
        CHECK (result_r IS NULL OR exit_price IS NOT NULL),
      ADD CONSTRAINT trades_close_after_open
        CHECK (closed_at IS NULL OR closed_at >= opened_at);
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE trades
      DROP CONSTRAINT trades_closed_fields_check,
      DROP CONSTRAINT trades_result_requires_close,
      DROP CONSTRAINT trades_close_after_open;
  `)
}
