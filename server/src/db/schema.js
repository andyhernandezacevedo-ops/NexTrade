import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['member', 'moderator', 'admin'])
export const accountStatus = pgEnum('account_status', ['active', 'suspended'])
export const tradeSide = pgEnum('trade_side', ['long', 'short'])
export const moderationStatus = pgEnum('moderation_status', ['pending', 'approved', 'rejected'])
export const postKind = pgEnum('community_post_kind', ['strategy', 'idea'])
export const datasetSource = pgEnum('dataset_source', ['csv', 'public_api'])

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  bio: varchar('bio', { length: 280 }),
  avatarUrl: text('avatar_url'),
  role: userRole('role').notNull().default('member'),
  status: accountStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const strategies = pgTable('strategies', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clonedFromId: uuid('cloned_from_id').references(() => strategies.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 120 }).notNull(),
  description: text('description').notNull(),
  asset: varchar('asset', { length: 32 }).notNull(),
  timeframe: varchar('timeframe', { length: 16 }).notNull(),
  rules: text('rules').notNull().default(''),
  isPublished: boolean('is_published').notNull().default(false),
  moderationStatus: moderationStatus('moderation_status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('strategies_user_updated_idx').on(table.userId, table.updatedAt),
  index('strategies_public_created_idx').on(table.isPublished, table.createdAt),
])

export const trades = pgTable('trades', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  strategyId: uuid('strategy_id').references(() => strategies.id, { onDelete: 'set null' }),
  asset: varchar('asset', { length: 32 }).notNull(),
  side: tradeSide('side').notNull(),
  entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
  exitPrice: numeric('exit_price', { precision: 20, scale: 8 }),
  stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }),
  takeProfit: numeric('take_profit', { precision: 20, scale: 8 }),
  resultR: numeric('result_r', { precision: 10, scale: 4 }),
  notes: text('notes').notNull().default(''),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
}, (table) => [
  check('trades_closed_fields_check', sql`(${table.exitPrice} IS NULL) = (${table.closedAt} IS NULL)`),
  check('trades_result_requires_close', sql`${table.resultR} IS NULL OR ${table.exitPrice} IS NOT NULL`),
  check('trades_close_after_open', sql`${table.closedAt} IS NULL OR ${table.closedAt} >= ${table.openedAt}`),
  index('trades_user_opened_idx').on(table.userId, table.openedAt),
  index('trades_strategy_idx').on(table.strategyId),
])

export const communityPosts = pgTable('community_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  strategyId: uuid('strategy_id').references(() => strategies.id, { onDelete: 'set null' }),
  kind: postKind('kind').notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  content: text('content').notNull(),
  moderationStatus: moderationStatus('moderation_status').notNull().default('pending'),
  moderatedBy: uuid('moderated_by').references(() => users.id, { onDelete: 'set null' }),
  moderatedAt: timestamp('moderated_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('community_posts_strategy_kind_check', sql`${table.kind} <> 'strategy' OR ${table.strategyId} IS NOT NULL`),
  index('community_posts_status_created_idx').on(table.moderationStatus, table.createdAt),
  index('community_posts_user_created_idx').on(table.userId, table.createdAt),
])

export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  strategyId: uuid('strategy_id').references(() => strategies.id, { onDelete: 'cascade' }),
  postId: uuid('post_id').references(() => communityPosts.id, { onDelete: 'cascade' }),
  content: varchar('content', { length: 2000 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('comments_single_target_check', sql`(${table.strategyId} IS NOT NULL) <> (${table.postId} IS NOT NULL)`),
  index('comments_strategy_created_idx').on(table.strategyId, table.createdAt),
  index('comments_post_created_idx').on(table.postId, table.createdAt),
])

export const votes = pgTable('votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  postId: uuid('post_id').notNull().references(() => communityPosts.id, { onDelete: 'cascade' }),
  value: integer('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check('votes_value_check', sql`${table.value} IN (-1, 1)`),
  uniqueIndex('votes_user_post_unique').on(table.userId, table.postId),
])

export const marketDatasets = pgTable('market_datasets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  source: datasetSource('source').notNull(),
  asset: varchar('asset', { length: 32 }).notNull(),
  timeframe: varchar('timeframe', { length: 16 }).notNull(),
  candleCount: integer('candle_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const marketCandles = pgTable('market_candles', {
  id: uuid('id').defaultRandom().primaryKey(),
  datasetId: uuid('dataset_id').notNull().references(() => marketDatasets.id, { onDelete: 'cascade' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  open: numeric('open', { precision: 20, scale: 8 }).notNull(),
  high: numeric('high', { precision: 20, scale: 8 }).notNull(),
  low: numeric('low', { precision: 20, scale: 8 }).notNull(),
  close: numeric('close', { precision: 20, scale: 8 }).notNull(),
  volume: numeric('volume', { precision: 24, scale: 8 }),
}, (table) => [
  check(
    'market_candles_ohlc_check',
    sql`${table.high} >= GREATEST(${table.open}, ${table.close}, ${table.low}) AND ${table.low} <= LEAST(${table.open}, ${table.close}, ${table.high})`,
  ),
  uniqueIndex('market_candles_dataset_recorded_unique').on(table.datasetId, table.recordedAt),
])

export const backtests = pgTable('backtests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  strategyId: uuid('strategy_id').references(() => strategies.id, { onDelete: 'set null' }),
  datasetId: uuid('dataset_id').references(() => marketDatasets.id, { onDelete: 'set null' }),
  configuration: jsonb('configuration').notNull(),
  results: jsonb('results').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('backtests_user_created_idx').on(table.userId, table.createdAt),
])

export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 120 }).notNull(),
  content: text('content').notNull().default(''),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
