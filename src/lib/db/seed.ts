import { db } from './index';
import { categories } from './schema';

const seedCategories = [
    { name: 'Coding', slug: 'coding', icon: '💻', sortOrder: 1 },
    { name: 'Writing', slug: 'writing', icon: '✍️', sortOrder: 2 },
    { name: 'Research', slug: 'research', icon: '🔍', sortOrder: 3 },
    { name: 'Data Processing', slug: 'data-processing', icon: '📊', sortOrder: 4 },
    { name: 'Design', slug: 'design', icon: '🎨', sortOrder: 5 },
    { name: 'Translation', slug: 'translation', icon: '🌐', sortOrder: 6 },
    { name: 'General', slug: 'general', icon: '📦', sortOrder: 7 },
];

async function main() {
    console.log('Seeding categories...');
    for (const category of seedCategories) {
        await db.insert(categories).values(category).onConflictDoUpdate({
            target: categories.slug,
            set: category,
        });
    }
    console.log('Seeding completed!');
    process.exit(0);
}

main().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
