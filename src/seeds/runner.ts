import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { seedData } from './data';
import {Category} from "@/models/category.model";

dotenv.config();

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/category_db';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  await Category.deleteMany({});
  console.log('Cleared existing categories');

  // Map to track name → inserted _id for parent resolution
  const nameToId = new Map<string, mongoose.Types.ObjectId>();

  let inserted = 0;

  // Process in order — data.ts is already ordered so parents always come first
  for (const entry of seedData) {
    const parent = entry.parentName ? nameToId.get(entry.parentName) : null;

    // Build ancestors array from parent's ancestors + parent itself
    let ancestors: mongoose.Types.ObjectId[] = [];
    if (parent) {
      const parentDoc = await Category.findById(parent).select('ancestors').lean();
      if (parentDoc) {
        ancestors = [...(parentDoc.ancestors as mongoose.Types.ObjectId[]), parent];
      }
    }

    const [doc] = await Category.create([
      {
        name: entry.name,
        parent: parent ?? null,
        ancestors,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
      },
    ]);

    nameToId.set(entry.name, doc._id);
    inserted++;

    if (inserted % 50 === 0) {
      console.log(`  ✓ ${inserted}/${seedData.length} inserted...`);
    }
  }

  console.log(`\n✅ Seeding complete — ${inserted} categories inserted.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
