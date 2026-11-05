import { db } from './src/lib/db';
import { users, agents, categories, tasks, creditTransactions } from './src/lib/db/schema';
import { generateApiKey, hashApiKey, getApiKeyPrefix } from './src/lib/auth/agent-auth';
import { hashPassword } from './src/lib/auth/password';

const WELCOME_BONUS = 500;
const AGENT_BONUS = 100;

async function seed() {
    console.log('Seeding database...');

    // 1. Create a User with password hash
    const passwordHash = await hashPassword('demo1234');
    const [user] = await db.insert(users).values({
        id: 'user_123',
        email: 'demo@swarmwork.local',
        name: 'Demo Operator',
        role: 'both',
        passwordHash,
        creditBalance: WELCOME_BONUS + AGENT_BONUS,
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Demo'
    }).returning();

    // 2. Create welcome bonus ledger entry
    await db.insert(creditTransactions).values({
        userId: user.id,
        amount: WELCOME_BONUS,
        type: 'bonus',
        description: 'Welcome bonus',
        balanceAfter: WELCOME_BONUS,
    });

    // 3. Create an Agent for the User
    const rawApiKey = generateApiKey();
    const hashedKey = await hashApiKey(rawApiKey);
    const prefix = getApiKeyPrefix(rawApiKey);

    const [agent] = await db.insert(agents).values({
        operatorId: user.id,
        name: 'Alpha Bot',
        description: 'A versatile agent specialized in web scraping and content generation.',
        apiKeyHash: hashedKey,
        apiKeyPrefix: prefix,
        status: 'active',
        capabilities: ['web_search', 'content_writing', 'data_extraction']
    }).returning();

    // 4. Create agent registration bonus ledger entry
    await db.insert(creditTransactions).values({
        userId: user.id,
        amount: AGENT_BONUS,
        type: 'bonus',
        description: `Agent registration bonus: ${agent.name}`,
        balanceAfter: WELCOME_BONUS + AGENT_BONUS,
    });

    console.log(`Agent created.\n   ID: ${agent.id}\n   Key: ${rawApiKey}`);

    // 3b. Create QA Reviewer Agent
    const qaPasswordHash = await hashPassword('reviewer1234');
    const [qaUser] = await db.insert(users).values({
        id: 'user_qa_reviewer',
        email: 'qa-reviewer@swarmwork.local',
        name: 'QA Reviewer Operator',
        role: 'operator',
        passwordHash: qaPasswordHash,
        creditBalance: 0,
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=QAReviewer'
    }).returning();

    const qaRawApiKey = generateApiKey();
    const qaHashedKey = await hashApiKey(qaRawApiKey);
    const qaPrefix = getApiKeyPrefix(qaRawApiKey);

    const [qaAgent] = await db.insert(agents).values({
        operatorId: qaUser.id,
        name: 'QA Reviewer Bot',
        description: 'Automated QA reviewer agent that evaluates deliverables against task requirements using LLM analysis.',
        apiKeyHash: qaHashedKey,
        apiKeyPrefix: qaPrefix,
        status: 'active',
        capabilities: ['qa_review'],
    }).returning();

    console.log(`QA Reviewer Agent created.\n   ID: ${qaAgent.id}\n   Key: ${qaRawApiKey}`);

    // 5. Create 7 Categories
    const [catCoding, catWriting, catResearch, catDataProcessing, catDesign, catTranslation, catGeneral] = await db.insert(categories).values([
        { name: 'Coding', slug: 'coding', icon: '💻', sortOrder: 1 },
        { name: 'Writing', slug: 'writing', icon: '✍️', sortOrder: 2 },
        { name: 'Research', slug: 'research', icon: '🔍', sortOrder: 3 },
        { name: 'Data Processing', slug: 'data-processing', icon: '📊', sortOrder: 4 },
        { name: 'Design', slug: 'design', icon: '🎨', sortOrder: 5 },
        { name: 'Translation', slug: 'translation', icon: '🌐', sortOrder: 6 },
        { name: 'General', slug: 'general', icon: '📋', sortOrder: 7 },
    ]).returning();

    // 6. Create demo Tasks
    await db.insert(tasks).values([
        {
            posterId: user.id,
            categoryId: catResearch.id,
            title: 'Research Top AI Trends for Q3',
            description: 'Compile a concise report on the top 5 emerging AI trends for the upcoming quarter. Needs specific data points and verifiable sources.',
            requirements: 'Deliver as markdown. Must include sources.',
            budgetCredits: 150,
            status: 'open',
            maxRevisions: 2,
            deadline: new Date(Date.now() + 86400000 * 7),
        },
        {
            posterId: user.id,
            categoryId: catCoding.id,
            title: 'Build Python Web Scraper',
            description: 'Need a headless scraper for an e-commerce site to extract product prices daily. Should handle pagination and rate limiting gracefully.',
            requirements: 'Use Playwright. Output JSON.',
            budgetCredits: 400,
            status: 'open',
            maxRevisions: 1,
            deadline: new Date(Date.now() + 86400000 * 3),
        },
        {
            posterId: user.id,
            categoryId: catWriting.id,
            title: 'Write SEO Blog Posts on Cloud Computing',
            description: 'Write 3 blog posts (1500+ words each) covering cloud computing topics: serverless architecture, multi-cloud strategies, and cost optimization. Posts should be engaging, technically accurate, and optimized for search engines.',
            requirements: 'Deliver as markdown. Include meta descriptions and suggested title tags for each post.',
            budgetCredits: 250,
            status: 'open',
            maxRevisions: 2,
            deadline: new Date(Date.now() + 86400000 * 5),
        },
        {
            posterId: user.id,
            categoryId: catDataProcessing.id,
            title: 'Clean and Normalize Customer CSV Dataset',
            description: 'We have a 50k-row CSV export from our CRM with inconsistent formatting, duplicate entries, and missing fields. Need it cleaned, deduplicated, and normalized into a consistent schema ready for import into our new system.',
            requirements: 'Output a clean CSV and a short summary report of changes made (rows removed, fields corrected, etc.).',
            budgetCredits: 200,
            status: 'open',
            maxRevisions: 1,
            deadline: new Date(Date.now() + 86400000 * 2),
        },
        {
            posterId: user.id,
            categoryId: catTranslation.id,
            title: 'Translate Product Descriptions EN to ES/FR',
            description: 'Translate 40 product descriptions (avg 150 words each) from English to both Spanish and French. Translations should sound natural and be appropriate for an e-commerce storefront, not literal word-for-word.',
            requirements: 'Deliver as a JSON array with keys: original, es, fr. Maintain HTML formatting tags if present.',
            budgetCredits: 300,
            status: 'open',
            maxRevisions: 3,
            deadline: new Date(Date.now() + 86400000 * 4),
        },
    ]);

    console.log('Seeding complete.');
    process.exit(0);
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
