// Loads the bundled OpenStreetMap listings into the database in DATABASE_URL (same as the seed step).
//   npx tsx scripts/import-listings.ts            (LISTINGS_LIMIT=100 by default)
import '../prisma/env';
import { bundledListings, importListings } from '../lib/listings';
import { db } from '../lib/db';

importListings(bundledListings()).then(async (n) => { console.log(`added ${n} listings`); await db.$disconnect(); });
