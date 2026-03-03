/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import fs from 'fs/promises';
import path from 'path';

const cacheFilePath = path.join('./', 'universal-crypto-mcp-cache.json');

/**
 * Reads the cache data from the JSON file.
 * If the file doesn't exist, returns an empty object.
 * @returns {Promise<Record<string, any>>} The cache data.
 */
async function readCache(): Promise<Record<string, any>> {
    try {
        const data = await fs.readFile(cacheFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (error: any) {
        // If the file doesn't exist or is invalid JSON, return an empty object
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            // If invalid JSON, try to fix by creating a new cache file
            try {
                await fs.writeFile(cacheFilePath, JSON.stringify({}), 'utf-8');
            } catch (error) {
                console.error('Error creating cache file:', error);
            }

            return {};
        }
        console.error('Error reading cache file:', error);
        return {};
    }
}

/**
 * Saves a key-value pair to the cache JSON file.
 * @param {string} key The key to save.
 * @param {any} value The value to save.
 * @returns {Promise<void>}
 */
export async function saveToCache(key: string, value: any): Promise<void> {
    try {
        const cacheData = await readCache();
        cacheData[key] = value;
        await fs.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Error saving '${key}' to cache:`, error);
        return undefined; // Return undefined on error instead of throwing
    }
}

/**
 * Retrieves a value from the cache JSON file by key.
 * @param {string} key The key to retrieve.
 * @returns {Promise<any | undefined>} The cached value or undefined if not found.
 */
export async function getFromCache(key: string): Promise<any | undefined> {
    try {
        const cacheData = await readCache();
        return cacheData[key];
    } catch (error) {
        console.error(`Error getting '${key}' from cache:`, error);
        return undefined; // Return undefined on error instead of throwing
    }
}

/**
 * Deletes a key-value pair from the cache JSON file.
 * @param {string} key The key to delete.
 * @returns {Promise<void>}
 */
export async function deleteFromCache(key: string): Promise<void> {
    try {
        const cacheData = await readCache();
        if (key in cacheData) {
            delete cacheData[key];
            await fs.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf-8');
            console.log(`Deleted '${key}' from cache.`);
        } else {
            console.log(`Key '${key}' not found in cache.`);
        }
    } catch (error) {
        console.error(`Error deleting '${key}' from cache:`, error);
        return undefined;
    }
}
