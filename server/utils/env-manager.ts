import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility functions for managing .env file
 * Reads, parses, and updates environment variables in .env file
 */

const ENV_FILE_PATH = path.resolve(process.cwd(), '.env');

/**
 * Get an environment variable value
 */
export function getEnvVariable(key: string): string | undefined {
    return process.env[key];
}

/**
 * Read and parse .env file
 * Returns a map of key-value pairs
 */
export function parseEnvFile(filePath: string = ENV_FILE_PATH): Map<string, string> {
    const envMap = new Map<string, string>();

    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`[env-manager] .env file not found at ${filePath}`);
            return envMap;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
            // Skip empty lines and comments
            if (!line.trim() || line.trim().startsWith('#')) {
                continue;
            }

            // Parse key=value pairs
            const equalIndex = line.indexOf('=');
            if (equalIndex === -1) {
                continue;
            }

            const key = line.substring(0, equalIndex).trim();
            let value = line.substring(equalIndex + 1).trim();

            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }

            if (key) {
                envMap.set(key, value);
            }
        }

        console.log(`[env-manager] Parsed ${envMap.size} variables from .env file`);
        return envMap;
    } catch (error) {
        console.error('[env-manager] Error parsing .env file:', error);
        return envMap;
    }
}

/**
 * Update environment variables in .env file
 * Preserves comments and formatting
 * 
 * @param updates - Object with key-value pairs to update
 * @param filePath - Path to .env file (defaults to .env in project root)
 * @returns true if successful, false otherwise
 */
export function updateEnvVariables(
    updates: Record<string, string>,
    filePath: string = ENV_FILE_PATH
): boolean {
    try {
        console.log(`[env-manager] Updating .env file at ${filePath}`);
        console.log(`[env-manager] Updates:`, Object.keys(updates));

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error(`[env-manager] .env file not found at ${filePath}`);
            return false;
        }

        // Read current content
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const updatedLines: string[] = [];
        const updatedKeys = new Set<string>();

        // Process each line
        for (const line of lines) {
            // Keep comments and empty lines as-is
            if (!line.trim() || line.trim().startsWith('#')) {
                updatedLines.push(line);
                continue;
            }

            // Parse key=value
            const equalIndex = line.indexOf('=');
            if (equalIndex === -1) {
                updatedLines.push(line);
                continue;
            }

            const key = line.substring(0, equalIndex).trim();

            // If this key needs to be updated
            if (key && updates.hasOwnProperty(key)) {
                const newValue = updates[key];
                // Preserve quotes if original had them, otherwise add quotes if value contains spaces
                const needsQuotes = newValue.includes(' ') || newValue.includes('#');
                const quotedValue = needsQuotes ? `"${newValue}"` : newValue;
                updatedLines.push(`${key}=${quotedValue}`);
                updatedKeys.add(key);
                console.log(`[env-manager] Updated ${key}`);
            } else {
                // Keep line as-is
                updatedLines.push(line);
            }
        }

        // Add any new keys that weren't in the file
        for (const [key, value] of Object.entries(updates)) {
            if (!updatedKeys.has(key)) {
                const needsQuotes = value.includes(' ') || value.includes('#');
                const quotedValue = needsQuotes ? `"${value}"` : value;
                updatedLines.push(`${key}=${quotedValue}`);
                console.log(`[env-manager] Added new key ${key}`);
            }
        }

        // Write back to file
        const newContent = updatedLines.join('\n');
        fs.writeFileSync(filePath, newContent, 'utf-8');

        // Update process.env immediately
        for (const [key, value] of Object.entries(updates)) {
            process.env[key] = value;
        }

        console.log(`[env-manager] Successfully updated .env file`);
        return true;
    } catch (error) {
        console.error('[env-manager] Error updating .env file:', error);
        return false;
    }
}

/**
 * Get all environment variables from .env file
 */
export function getAllEnvVariables(filePath: string = ENV_FILE_PATH): Record<string, string> {
    const envMap = parseEnvFile(filePath);
    const result: Record<string, string> = {};

    for (const [key, value] of envMap.entries()) {
        result[key] = value;
    }

    return result;
}
