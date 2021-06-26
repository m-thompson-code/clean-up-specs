const fs = require('fs');
const glob = require('glob');
const { join } = require('path');

const lib = { main, logPaths, wait, readFile, validToDelete, findSpecFilePaths, attemptToDeleteEmptySpec, attemptToDeleteEmptySpecs };

async function main(cwd, dryRun) {
    if (!cwd) {
        console.error(`~ Unexpected missing full path\n\nTry: 'node index.js <path>'`);
        return;
    }

    if (dryRun) {
        console.log(`~ DRY RUN: Include --real-remove to actually delete unused specs: 'node index.js <path> --real-remove'`);
    } else {
        console.log(`~ NOT A DRY RUN - THIS IS FOR REAL FOR REAL`);
    }

    console.log(`~ Will search '${cwd}' for specs...`);

    await lib.wait(5000);

    const fullPaths = await lib.findSpecFilePaths(cwd);

    lib.logPaths(fullPaths);

    const milliseconds = Math.max(5000, Math.min(10000, 300 * fullPaths.length));

    console.log(`\n~ Files count: ${fullPaths.length}`);

    console.log(`\n~ will delete 'empty' specs in ${milliseconds}ms`);

    await lib.wait(milliseconds);

    lib.attemptToDeleteEmptySpecs(fullPaths, dryRun);

    if (dryRun) {
        console.log(`~ DRY RUN: Include --real-remove to actually delete unused specs: 'node index.js <path> --real-remove'`);
    }
}

/**
 * Print out paths
 * @param {*} paths 
 */
function logPaths(paths) {
    console.log('\n~ Files found:');

    for (const path of paths) {
        console.log(`~   ${path}`);
    }
}

/**
 * Returns relative paths
 * @param {*} cwd root path
 * @returns Promise<string[]>
 */
function findSpecFilePaths(cwd) {
    const options = {
        // cwd: '/Users/markthompson/Documents/github/personal/',
        // cwd: '/Users/markthompson/Documents/github/personal/dynamic-component-loader/src',
        cwd,
    };

    return new Promise((resolve, reject) => {
        glob("**/*.spec.ts", options, (err, relativePaths) => {
            // err is an error object or null.
            if (err) {
                return reject(err);
            }

            // relativePaths is an array of filenames.
            // If the `nonull` option is set, and nothing
            // was found, then relativePaths is ["**/*.spec.ts"]
            return resolve(relativePaths.map(relativePath => join(cwd, relativePath)));
        });
    });
}

/**
 * wait x ms
 * @param {*} milliseconds 
 * @returns Promise<void>
 */
function wait(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, milliseconds);
    });
}


/**
 * Deletes any spec file at path that isn't app.component.spec.ts or has multiple describes
 * @param {*} path 
 * @param {*} dryRun 
 */
 function attemptToDeleteEmptySpec(path, dryRun) {
    const data = lib.readFile(path);

    if (lib.validToDelete(path, data)) {
        if (!dryRun) {
            // Remove file at path
            fs.unlinkSync(path);
        }

        console.log(`~ REMOVED ${path}`);
        return true;
    }

    console.log(`~ SKIPPED ${path}`);
    return false;
}

/**
 * Deletes any spec files in paths that isn't app.component.spec.ts or has multiple describes
 * @param {*} paths 
 * @param {*} dryRun 
 */
function attemptToDeleteEmptySpecs(paths, dryRun) {
    const errors = [];
    const skipped = [];

    let deleteCount = 0;

    for (const path of paths) {
        try {
            const didDeleteFile = lib.attemptToDeleteEmptySpec(path, dryRun);
            
            if (didDeleteFile) {
                deleteCount += 1;
                continue;
            }

            skipped.push(path);
        } catch(err) {
            console.error(`! REMOVE ERROR ${err.errno ?? 'na'}: - ${err.path ?? 'unknown path'}`);
            errors.push(path);
        }
    }

    console.log(`\n~ DELETED: ${deleteCount}\n~ ERROR: ${errors.length}\n~ SKIPPED: ${skipped.length}`);

    if (skipped.length) {
        console.log('\n');
        skipped.forEach(skipPath => {
            console.log(`~ SKIPPED: ${skipPath}`);
        });
    }
    
    if (errors.length) {
        console.log('\n');
        errors.forEach(errorPath => {
            console.log(`~ ERROR: ${errorPath}`);
        });
    }
}


/**
 * Returns null if file could not be read
 * 
 * @param {*} path 
 * @returns string | null
 */
function readFile(path) {
    try {
        return fs.readFileSync(path, 'utf8');
    } catch (err) {
        console.error(`! READ ERROR ${err.errno ?? 'na'}: - ${err.path ?? 'unknown path'}`);
        return null;
    }
}

/**
 * Checks if data is an "empty" spec
 * @param {*} data 
 * @returns 
 */
function validToDelete(path, data) {
    if (data == null) {
        return false;
    }

    // Check if app.component.spec.ts
    if (path.includes('app.component.spec.ts')) {
        return false;
    }

    // Check if there's less than 2 describes
    const count = (data.match(/describe/g)).length;
    return count === 1;
}

module.exports = lib;
