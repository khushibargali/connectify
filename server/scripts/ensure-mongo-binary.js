/**
 * Downloads the MongoDB binary used by mongodb-memory-server once, before tests run in parallel.
 * Without this, several test workers race on the first download and can deadlock on the lock file.
 */
import { MongoBinary } from 'mongodb-memory-server';

const started = Date.now();
const binary = await MongoBinary.getPath();
console.log(`mongod binary ready (${Math.round((Date.now() - started) / 1000)}s): ${binary}`);
