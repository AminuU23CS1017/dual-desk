import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const desks = sqliteTable('desks', { userId: text('user_id').primaryKey(), data: text('data').notNull(), revision: integer('revision').notNull().default(0) });
export const alertDeliveries=sqliteTable('alert_deliveries',{id:text('id').primaryKey(),createdAt:integer('created_at').notNull(),status:text('status').notNull(),payload:text('payload').notNull(),attempts:integer('attempts').notNull().default(0),retryAt:integer('retry_at').notNull().default(0),errorCode:text('error_code')});
export const alertRuns=sqliteTable('alert_runs',{id:text('id').primaryKey(),createdAt:integer('created_at').notNull(),result:text('result').notNull()});
export const alertConfig=sqliteTable('alert_config',{id:text('id').primaryKey(),enabled:integer('enabled').notNull().default(1)});
export const brokerConfigs=sqliteTable('broker_configs',{userId:text('user_id').primaryKey(),clientId:text('client_id').notNull()});
export const brokerOauth=sqliteTable('broker_oauth',{userId:text('user_id').primaryKey(),stateHash:text('state_hash').notNull(),verifier:text('verifier').notNull(),clientId:text('client_id').notNull(),expires:integer('expires').notNull()});
export const brokerTokens=sqliteTable('broker_tokens',{userId:text('user_id').primaryKey(),ciphertext:text('ciphertext').notNull(),expires:integer('expires').notNull()});
export const mt5Bridges=sqliteTable('mt5_bridges',{userId:text('user_id').primaryKey(),tokenHash:text('token_hash').notNull().unique(),accountKey:text('account_key'),snapshot:text('snapshot'),lastSeen:integer('last_seen'),enabled:integer('enabled').notNull().default(0)});
export const signalResults=sqliteTable('signal_results',{id:text('id').primaryKey(),userId:text('user_id').notNull(),signal:text('signal').notNull(),status:text('status').notNull(),startedAt:integer('started_at').notNull(),cursor:integer('cursor').notNull(),result:text('result').notNull()});

export const feedHealth=sqliteTable('feed_health',{provider:text('provider').primaryKey(),retryAt:integer('retry_at').notNull(),message:text('message').notNull(),updatedAt:integer('updated_at').notNull()});
