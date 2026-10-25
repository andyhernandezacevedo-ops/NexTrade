export const up = (pgm) => {
  pgm.sql(`
    CREATE TYPE user_role AS ENUM ('member', 'moderator', 'admin');
    CREATE TYPE account_status AS ENUM ('active', 'suspended');
    CREATE TYPE trade_side AS ENUM ('long', 'short');
    CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected');
    CREATE TYPE community_post_kind AS ENUM ('strategy', 'idea');
    CREATE TYPE dataset_source AS ENUM ('csv', 'public_api');

    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(255) NOT NULL UNIQUE,
      password_hash text NOT NULL,
      username varchar(32) NOT NULL UNIQUE,
      bio varchar(280),
      avatar_url text,
      role user_role NOT NULL DEFAULT 'member',
      status account_status NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE strategies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cloned_from_id uuid REFERENCES strategies(id) ON DELETE SET NULL,
      title varchar(120) NOT NULL,
      description text NOT NULL,
      asset varchar(32) NOT NULL,
      timeframe varchar(16) NOT NULL,
      rules text NOT NULL DEFAULT '',
      is_published boolean NOT NULL DEFAULT false,
      moderation_status moderation_status NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX strategies_user_updated_idx ON strategies(user_id, updated_at);
    CREATE INDEX strategies_public_created_idx ON strategies(is_published, created_at);

    CREATE TABLE trades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      strategy_id uuid REFERENCES strategies(id) ON DELETE SET NULL,
      asset varchar(32) NOT NULL,
      side trade_side NOT NULL,
      entry_price numeric(20, 8) NOT NULL,
      exit_price numeric(20, 8),
      stop_loss numeric(20, 8),
      take_profit numeric(20, 8),
      result_r numeric(10, 4),
      notes text NOT NULL DEFAULT '',
      opened_at timestamptz NOT NULL,
      closed_at timestamptz
    );
    CREATE INDEX trades_user_opened_idx ON trades(user_id, opened_at);
    CREATE INDEX trades_strategy_idx ON trades(strategy_id);

    CREATE TABLE community_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      strategy_id uuid REFERENCES strategies(id) ON DELETE SET NULL,
      kind community_post_kind NOT NULL,
      title varchar(160) NOT NULL,
      content text NOT NULL,
      moderation_status moderation_status NOT NULL DEFAULT 'pending',
      moderated_by uuid REFERENCES users(id) ON DELETE SET NULL,
      moderated_at timestamptz,
      published_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT community_posts_strategy_kind_check
        CHECK (kind <> 'strategy' OR strategy_id IS NOT NULL)
    );
    CREATE INDEX community_posts_status_created_idx ON community_posts(moderation_status, created_at);
    CREATE INDEX community_posts_user_created_idx ON community_posts(user_id, created_at);

    CREATE TABLE comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      strategy_id uuid REFERENCES strategies(id) ON DELETE CASCADE,
      post_id uuid REFERENCES community_posts(id) ON DELETE CASCADE,
      content varchar(2000) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT comments_single_target_check
        CHECK ((strategy_id IS NOT NULL) <> (post_id IS NOT NULL))
    );
    CREATE INDEX comments_strategy_created_idx ON comments(strategy_id, created_at);
    CREATE INDEX comments_post_created_idx ON comments(post_id, created_at);

    CREATE TABLE votes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      value integer NOT NULL CHECK (value IN (-1, 1)),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT votes_user_post_unique UNIQUE(user_id, post_id)
    );

    CREATE TABLE market_datasets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source dataset_source NOT NULL,
      asset varchar(32) NOT NULL,
      timeframe varchar(16) NOT NULL,
      candle_count integer NOT NULL DEFAULT 0 CHECK (candle_count >= 0),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE market_candles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dataset_id uuid NOT NULL REFERENCES market_datasets(id) ON DELETE CASCADE,
      recorded_at timestamptz NOT NULL,
      open numeric(20, 8) NOT NULL,
      high numeric(20, 8) NOT NULL,
      low numeric(20, 8) NOT NULL,
      close numeric(20, 8) NOT NULL,
      volume numeric(24, 8),
      CONSTRAINT market_candles_ohlc_check
        CHECK (high >= GREATEST(open, close, low) AND low <= LEAST(open, close, high)),
      CONSTRAINT market_candles_dataset_recorded_unique UNIQUE(dataset_id, recorded_at)
    );

    CREATE TABLE backtests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      strategy_id uuid REFERENCES strategies(id) ON DELETE SET NULL,
      dataset_id uuid REFERENCES market_datasets(id) ON DELETE SET NULL,
      configuration jsonb NOT NULL,
      results jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX backtests_user_created_idx ON backtests(user_id, created_at);

    CREATE TABLE notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title varchar(120) NOT NULL,
      content text NOT NULL DEFAULT '',
      image_url text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE notes, backtests, market_candles, market_datasets, votes, comments,
      community_posts, trades, strategies, users;
    DROP TYPE dataset_source, community_post_kind, moderation_status, trade_side,
      account_status, user_role;
  `)
}
