import {
    pgTable,
    serial,
    text,
    integer,
    timestamp,
    varchar,
    boolean,
    real,
    jsonb,
    pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Enums ---

export const userRoleEnum = pgEnum('user_role', ['poster', 'operator', 'both', 'admin']);
export const agentStatusEnum = pgEnum('agent_status', ['active', 'paused', 'suspended']);
export const taskStatusEnum = pgEnum('task_status', [
    'open', 'claimed', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed'
]);
export const claimStatusEnum = pgEnum('claim_status', ['pending', 'accepted', 'rejected', 'withdrawn']);
export const deliverableStatusEnum = pgEnum('deliverable_status', [
    'submitted', 'accepted', 'rejected', 'revision_requested'
]);
export const transactionTypeEnum = pgEnum('transaction_type', [
    'deposit', 'bonus', 'payment', 'platform_fee', 'refund'
]);
export const reviewResultEnum = pgEnum('review_result', ['pass', 'fail', 'pending', 'skipped']);
export const keySourceEnum = pgEnum('key_source', ['poster', 'freelancer', 'none']);

// --- Tables ---

export const users = pgTable('users', {
    id: text('id').primaryKey(), // Using text to satisfy Lucia, will store integer strings
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    role: userRoleEnum('role').notNull().default('both'),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    passwordHash: text('password_hash'),
    creditBalance: integer('credit_balance').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const agents = pgTable('agents', {
    id: serial('id').primaryKey(),
    operatorId: text('operator_id').notNull().references(() => users.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull(),
    capabilities: text('capabilities').array().notNull().default([]),
    categoryIds: integer('category_ids').array().notNull().default([]),
    hourlyRateCredits: integer('hourly_rate_credits'),
    apiKeyHash: varchar('api_key_hash', { length: 255 }),
    apiKeyPrefix: varchar('api_key_prefix', { length: 14 }),
    webhookUrl: text('webhook_url'),
    status: agentStatusEnum('status').notNull().default('active'),
    reputationScore: real('reputation_score').notNull().default(50.0),
    tasksCompleted: integer('tasks_completed').notNull().default(0),
    avgRating: real('avg_rating'),
    freelancerLlmKeyEncrypted: text('freelancer_llm_key_encrypted'),
    freelancerLlmProvider: varchar('freelancer_llm_provider', { length: 50 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const categories = pgTable('categories', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    description: text('description'),
    icon: varchar('icon', { length: 50 }),
    sortOrder: integer('sort_order').notNull().default(0),
});

export const tasks = pgTable('tasks', {
    id: serial('id').primaryKey(),
    posterId: text('poster_id').notNull().references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    requirements: text('requirements'),
    budgetCredits: integer('budget_credits').notNull(),
    categoryId: integer('category_id').references(() => categories.id),
    status: taskStatusEnum('status').notNull().default('open'),
    claimedByAgentId: integer('claimed_by_agent_id').references(() => agents.id),
    deadline: timestamp('deadline'),
    maxRevisions: integer('max_revisions').notNull().default(2),
    autoReviewEnabled: boolean('auto_review_enabled').notNull().default(false),
    posterLlmKeyEncrypted: text('poster_llm_key_encrypted'),
    posterLlmProvider: varchar('poster_llm_provider', { length: 50 }),
    posterMaxReviews: integer('poster_max_reviews'),
    posterReviewsUsed: integer('poster_reviews_used').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const taskClaims = pgTable('task_claims', {
    id: serial('id').primaryKey(),
    taskId: integer('task_id').notNull().references(() => tasks.id),
    agentId: integer('agent_id').notNull().references(() => agents.id),
    proposedCredits: integer('proposed_credits').notNull(),
    message: text('message'),
    status: claimStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const deliverables = pgTable('deliverables', {
    id: serial('id').primaryKey(),
    taskId: integer('task_id').notNull().references(() => tasks.id),
    agentId: integer('agent_id').notNull().references(() => agents.id),
    content: text('content').notNull(),
    status: deliverableStatusEnum('status').notNull().default('submitted'),
    revisionNotes: text('revision_notes'),
    revisionNumber: integer('revision_number').notNull().default(1),
    submittedAt: timestamp('submitted_at').notNull().defaultNow(),
});

export const submissionAttempts = pgTable('submission_attempts', {
    id: serial('id').primaryKey(),
    taskId: integer('task_id').notNull().references(() => tasks.id),
    agentId: integer('agent_id').notNull().references(() => agents.id),
    attemptNumber: integer('attempt_number').notNull(),
    content: text('content').notNull(),
    reviewResult: reviewResultEnum('review_result').notNull().default('pending'),
    reviewFeedback: text('review_feedback'),
    reviewScores: jsonb('review_scores'),
    reviewedAt: timestamp('reviewed_at'),
    reviewKeySource: keySourceEnum('review_key_source').notNull().default('none'),
    llmModelUsed: varchar('llm_model_used', { length: 255 }),
    submittedAt: timestamp('submitted_at').notNull().defaultNow(),
});

export const reviews = pgTable('reviews', {
    id: serial('id').primaryKey(),
    taskId: integer('task_id').notNull().references(() => tasks.id),
    reviewerId: text('reviewer_id').notNull().references(() => users.id),
    agentId: integer('agent_id').notNull().references(() => agents.id),
    rating: integer('rating').notNull(),
    qualityScore: integer('quality_score'),
    speedScore: integer('speed_score'),
    comment: text('comment'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const creditTransactions = pgTable('credit_transactions', {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    amount: integer('amount').notNull(),
    type: transactionTypeEnum('type').notNull(),
    taskId: integer('task_id').references(() => tasks.id),
    counterpartyId: text('counterparty_id').references(() => users.id),
    description: text('description'),
    balanceAfter: integer('balance_after').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const webhooks = pgTable('webhooks', {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    url: text('url').notNull(),
    secret: varchar('secret', { length: 255 }).notNull(),
    events: text('events').array().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    lastTriggeredAt: timestamp('last_triggered_at'),
    failureCount: integer('failure_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    relatedTaskId: integer('related_task_id').references(() => tasks.id),
    isRead: boolean('is_read').notNull().default(false),
    actionUrl: text('action_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const idempotencyKeys = pgTable('idempotency_keys', {
    id: serial('id').primaryKey(),
    key: varchar('key', { length: 255 }).notNull().unique(),
    agentId: integer('agent_id'),
    userId: text('user_id'),
    method: varchar('method', { length: 10 }).notNull(),
    path: text('path').notNull(),
    responseStatus: integer('response_status').notNull(),
    responseBody: text('response_body').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
});

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
    agents: many(agents),
    tasks: many(tasks),
    creditTransactions: many(creditTransactions),
    reviews: many(reviews),
    notifications: many(notifications),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
    operator: one(users, { fields: [agents.operatorId], references: [users.id] }),
    taskClaims: many(taskClaims),
    deliverables: many(deliverables),
    submissionAttempts: many(submissionAttempts),
    reviews: many(reviews),
    webhooks: many(webhooks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
    poster: one(users, { fields: [tasks.posterId], references: [users.id] }),
    category: one(categories, { fields: [tasks.categoryId], references: [categories.id] }),
    claimedByAgent: one(agents, { fields: [tasks.claimedByAgentId], references: [agents.id] }),
    taskClaims: many(taskClaims),
    deliverables: many(deliverables),
    submissionAttempts: many(submissionAttempts),
    review: one(reviews, { fields: [tasks.id], references: [reviews.taskId] }),
    creditTransactions: many(creditTransactions),
}));

export const taskClaimsRelations = relations(taskClaims, ({ one }) => ({
    task: one(tasks, { fields: [taskClaims.taskId], references: [tasks.id] }),
    agent: one(agents, { fields: [taskClaims.agentId], references: [agents.id] }),
}));

export const deliverablesRelations = relations(deliverables, ({ one }) => ({
    task: one(tasks, { fields: [deliverables.taskId], references: [tasks.id] }),
    agent: one(agents, { fields: [deliverables.agentId], references: [agents.id] }),
}));

export const submissionAttemptsRelations = relations(submissionAttempts, ({ one }) => ({
    task: one(tasks, { fields: [submissionAttempts.taskId], references: [tasks.id] }),
    agent: one(agents, { fields: [submissionAttempts.agentId], references: [agents.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
    task: one(tasks, {
        fields: [reviews.taskId],
        references: [tasks.id],
    }),
    reviewer: one(users, {
        fields: [reviews.reviewerId],
        references: [users.id],
    }),
    agent: one(agents, {
        fields: [reviews.agentId],
        references: [agents.id],
    }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
    user: one(users, { fields: [creditTransactions.userId], references: [users.id] }),
    task: one(tasks, { fields: [creditTransactions.taskId], references: [tasks.id] }),
    counterparty: one(users, { fields: [creditTransactions.counterpartyId], references: [users.id] }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
    user: one(users, {
        fields: [webhooks.userId],
        references: [users.id],
    }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, { fields: [notifications.userId], references: [users.id] }),
    task: one(tasks, { fields: [notifications.relatedTaskId], references: [tasks.id] }),
}));
