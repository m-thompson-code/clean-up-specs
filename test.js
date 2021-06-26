const lib = require('./lib.js');

const { wait, logPaths, readFile, validToDelete, findSpecFilePaths, attemptToDeleteEmptySpec, attemptToDeleteEmptySpecs } = lib;

const glob = require('glob');
jest.mock('glob');
const fs = require('fs');
const { main } = require('./lib.js');
jest.mock('fs');

beforeAll(() => {
    // Reset mocks
    jest.resetAllMocks();

    // Stub console logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('wait()', () => {
    it('should use setTimeout to stall', () => {
        expect.hasAssertions();

        const spy = jest.spyOn(globalThis, 'setTimeout');

        const promise = wait(10000).then(value => {
            expect(value).toBeUndefined();
        });

        jest.advanceTimersByTime(10000);
        expect(spy).toBeCalledTimes(1);
        expect(spy).toBeCalledWith(expect.any(Function), 10000);


        return promise;
    });
});

describe('readFile()', () => {
    it('read file at path', () => {
        const spy = jest.spyOn(fs, 'readFileSync').mockImplementationOnce((path, format) => 'some data');
        
        expect(readFile('some path')).toBe('some data');

        expect(spy).toBeCalledWith('some path', 'utf8');
    });

    describe('when error', () => {
        beforeEach(() => {
            jest.spyOn(fs, 'readFileSync').mockImplementation((path, format) => {
                throw {
                    errno: 909, path: 'file path',
                };
            });
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('return null on error', () => {
            const spy = jest.spyOn(fs, 'readFileSync');
            const spy2 = jest.spyOn(console, 'error').mockImplementationOnce(() => {});
    
            expect(readFile('some path')).toBeNull();
    
            expect(spy).toBeCalledWith('some path', 'utf8');
            expect(spy2).toBeCalledWith(`! READ ERROR 909: - file path`);
        });

        it('should use placeholders for error when it has missing properties', () => {
            jest.spyOn(fs, 'readFileSync').mockImplementationOnce((path, format) => {
                throw {};// empty error with no properties
            });
    
            const spy = jest.spyOn(console, 'error');
    
            readFile('some path');
    
            expect(spy).toBeCalledWith('! READ ERROR na: - unknown path');
        });
    });
});

describe('validToDelete()', () => {
    it('should return false data is null', () => {
        expect(validToDelete('some path', null)).toBe(false);
    });

    it('should return false if file is app.component.spec.ts', () => {
        expect(validToDelete('some-path/app.component.spec.ts', 'describe')).toBe(false);
    });

    it('should return false if file includes multiple describes', () => {
        expect(validToDelete('some-path/some.spec.ts', 'describe describe')).toBe(false);
    });
});

describe('findSpecFilePaths()', () => {
    it('should reject with error', (done) => {
        expect.assertions(1);

        glob.mockImplementation((regex, options, callback) => {
            callback('some error', null); 
        });

        findSpecFilePaths('path').catch(error => {
            expect(error).toBe('some error');
            done();
        });
    });

    it('should reject with error (2)', () => {
        glob.mockImplementation((regex, options, callback) => {
            callback('some error (2)', null); 
        });

        return expect(findSpecFilePaths('path')).rejects.toEqual('some error (2)');
    });

    it('should paths, combining root path and relative path', (done) => {
        expect.hasAssertions();

        glob.mockImplementation((regex, options, callback) => {
            callback(null, ['some-relative-path']); 
        });

        findSpecFilePaths('path').then(paths => {
            expect(paths).toEqual([
                'path/some-relative-path',
            ]);
            done();
        });
    });

    it('should paths, combining root path and relative path (2)', () => {
        glob.mockImplementation((regex, options, callback) => {
            callback(null, ['some-relative-path']); 
        });

        return expect(findSpecFilePaths('path')).resolves.toEqual([
            'path/some-relative-path',
        ]);
    });
});

describe('attemptToDeleteEmptySpec', () => {
    beforeEach(() => {
        jest.spyOn(lib, 'readFile').mockReturnValue(null);
        jest.spyOn(lib, 'validToDelete').mockReturnValue(true);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it('should use readFile() to get data from each path', () => {
        const spy = jest.spyOn(lib, 'readFile');

        lib.attemptToDeleteEmptySpec('path 1', true);

        expect(spy).toBeCalledWith('path 1');
        expect(spy).toBeCalledTimes(1);
    });

    it('should use validToDelete() to determine if we can delete or not', () => {
        jest.spyOn(lib, 'readFile').mockImplementation((path) => `${path} data`);
        const spy = jest.spyOn(lib, 'validToDelete');

        lib.attemptToDeleteEmptySpec('path 1', true);

        expect(spy).toBeCalledWith('path 1', 'path 1 data');
        expect(spy).toBeCalledTimes(1);
    });

    it('should actually deleting if not dryRun', () => {
        const spy = jest.spyOn(fs, 'unlinkSync');

        lib.attemptToDeleteEmptySpec('path 1', false);

        expect(spy).toBeCalledWith('path 1');
        expect(spy).toBeCalledTimes(1);
    });

    it('should skip actually deleting if dryRun', () => {
        const spy = jest.spyOn(fs, 'unlinkSync');

        lib.attemptToDeleteEmptySpec('path 1', true);

        expect(spy).toBeCalledTimes(0);
    });

    it('should log the path of the deleted file', () => {
        const spy = jest.spyOn(console, 'log');

        lib.attemptToDeleteEmptySpec('path 1', false);

        expect(spy).toBeCalledWith('~ REMOVED path 1');
        expect(spy).toBeCalledTimes(1);
    });

    it('should log the path of the skipped file', () => {
        const spy = jest.spyOn(console, 'log');
        jest.spyOn(lib, 'validToDelete').mockReturnValue(false);

        lib.attemptToDeleteEmptySpec('path 1', false);

        expect(spy).toBeCalledWith('~ SKIPPED path 1');
        expect(spy).toBeCalledTimes(1);
    });
});

describe('attemptToDeleteEmptySpecs()', () => {
    beforeEach(() => {
        jest.spyOn(lib, 'attemptToDeleteEmptySpec').mockReturnValue(true);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it('should use attemptToDeleteEmptySpec() to possibly delete each file at each path', () => {
        const spy = jest.spyOn(lib, 'attemptToDeleteEmptySpec');

        lib.attemptToDeleteEmptySpecs([
            'path 1', 'path 2', 'path 3',
        ], false);

        expect(spy).toHaveBeenNthCalledWith(1, 'path 1', false);
        expect(spy).toHaveBeenNthCalledWith(2, 'path 2', false);
        expect(spy).toHaveBeenNthCalledWith(3, 'path 3', false);
        expect(spy).toBeCalledTimes(3);
    });

    it('should pass dryRun state (false) to attemptToDeleteEmptySpec()', () => {
        const spy = jest.spyOn(lib, 'attemptToDeleteEmptySpec');

        lib.attemptToDeleteEmptySpecs([
            'path 1'
        ], false);

        expect(spy).toBeCalledWith('path 1', false);
        expect(spy).toBeCalledTimes(1);
    });

    it('should pass dryRun state (true) to attemptToDeleteEmptySpec()', () => {
        const spy = jest.spyOn(lib, 'attemptToDeleteEmptySpec');

        lib.attemptToDeleteEmptySpecs([
            'path 1'
        ], true);

        expect(spy).toBeCalledWith('path 1', true);
        expect(spy).toBeCalledTimes(1);
    });

    it('should log skipped paths', () => {
        jest.spyOn(lib, 'attemptToDeleteEmptySpec').mockReturnValue(false);
        const spy = jest.spyOn(console, 'log');
        
        lib.attemptToDeleteEmptySpecs([
            'path 1', 'path 2', 'path 3',
        ], true);

        expect(spy).toHaveBeenNthCalledWith(1, '\n~ DELETED: 0\n~ ERROR: 0\n~ SKIPPED: 3');
        expect(spy).toHaveBeenNthCalledWith(2, '\n');
        expect(spy).toHaveBeenNthCalledWith(3, '~ SKIPPED: path 1');
        expect(spy).toHaveBeenNthCalledWith(4, '~ SKIPPED: path 2');
        expect(spy).toHaveBeenNthCalledWith(5, '~ SKIPPED: path 3');
        expect(spy).toBeCalledTimes(5);
    });

    it('should log paths that errored', () => {
        jest.spyOn(lib, 'attemptToDeleteEmptySpec').mockImplementation((path) => { 
            throw {
                errno: `${path} no`,
                path: `${path} path`,
            }
        });

        const spy = jest.spyOn(console, 'error');
        const spy2 = jest.spyOn(console, 'log');
        
        lib.attemptToDeleteEmptySpecs([
            'path 1', 'path 2', 'path 3',
        ], true);

        expect(spy).toHaveBeenNthCalledWith(1, '! REMOVE ERROR path 1 no: - path 1 path');
        expect(spy).toHaveBeenNthCalledWith(2, '! REMOVE ERROR path 2 no: - path 2 path');
        expect(spy).toHaveBeenNthCalledWith(3, '! REMOVE ERROR path 3 no: - path 3 path');
        expect(spy).toBeCalledTimes(3);

        expect(spy2).toHaveBeenNthCalledWith(1, '\n~ DELETED: 0\n~ ERROR: 3\n~ SKIPPED: 0');
        expect(spy2).toHaveBeenNthCalledWith(2, '\n');
        expect(spy2).toHaveBeenNthCalledWith(3, '~ ERROR: path 1');
        expect(spy2).toHaveBeenNthCalledWith(4, '~ ERROR: path 2');
        expect(spy2).toHaveBeenNthCalledWith(5, '~ ERROR: path 3');
        expect(spy2).toBeCalledTimes(5);
    });

    it('should use placeholders for error when it has missing properties', () => {
        jest.spyOn(lib, 'attemptToDeleteEmptySpec').mockImplementation((path) => { 
            throw {};// empty error with no properties
        });

        const spy = jest.spyOn(console, 'error');

        lib.attemptToDeleteEmptySpecs([
            'path 1',
        ], true);

        expect(spy).toBeCalledWith('! REMOVE ERROR na: - unknown path');
    });
});

describe('main()', () => {
    beforeEach(() => {
        jest.spyOn(lib, 'wait').mockResolvedValue(null);
        jest.spyOn(lib, 'findSpecFilePaths').mockResolvedValue([]);
        jest.spyOn(lib, 'attemptToDeleteEmptySpecs').mockReturnValue(null);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it('should exit early if no cwd is provided', (done) => {
        expect.hasAssertions();

        const spy = jest.spyOn(lib, 'attemptToDeleteEmptySpecs');
        const spy2 = jest.spyOn(console, 'error');

        main().then(() => {
            expect(spy).not.toBeCalled();
            expect(spy2).toBeCalledWith(`~ Unexpected missing full path\n\nTry: 'node index.js <path>'`);
            expect(spy2).toBeCalledTimes(1);
            done();
        });
    });

    it('should run attemptToDeleteEmptySpecs() when cwd is provided', (done) => {
        expect.hasAssertions();
        
        const expectedPaths = [
            'path 1',
            'path 2',
            'path 3',
        ];

        jest.spyOn(lib, 'findSpecFilePaths').mockResolvedValue(expectedPaths);

        const spy = jest.spyOn(lib, 'attemptToDeleteEmptySpecs');

        main('cwd', true).then(() => {
            expect(spy).toBeCalledWith(expectedPaths, true);
            done();
        });
    });

    it('prompt that this is a dry run', (done) => {
        expect.hasAssertions();

        const spy = jest.spyOn(console, 'log');
        expect.assertions(2);

        main('path', true).then(() => {
            expect(spy).toHaveBeenNthCalledWith(1, `~ DRY RUN: Include --real-remove to actually delete unused specs: 'node index.js <path> --real-remove'`);
            expect(spy).toHaveBeenLastCalledWith(`~ DRY RUN: Include --real-remove to actually delete unused specs: 'node index.js <path> --real-remove'`);
            done();
        });
    });

    it('prompt that this is not a dry run', (done) => {
        expect.hasAssertions();

        const spy = jest.spyOn(console, 'log');

        main('path', false).then(() => {
            expect(spy).toBeCalledWith(`~ NOT A DRY RUN - THIS IS FOR REAL FOR REAL`);
            done();
        });
    });

    it('should log found full paths', (done) => {
        expect.hasAssertions();

        const spy = jest.spyOn(lib, 'logPaths');

        const expectedPaths = [
            'path 1',
            'path 2',
            'path 3',
        ];

        jest.spyOn(lib, 'findSpecFilePaths').mockResolvedValue(expectedPaths);

        main('path', false).then(() => {
            expect(spy).toBeCalledWith(expectedPaths);
            done();
        });
    });
});

describe('logPaths()', () => {
    it('logs each path', () => {
        const spy = jest.spyOn(console, 'log');
        logPaths([
            'path 1',
            'path 2',
            'path 3',
        ]);

        expect(spy).toHaveBeenNthCalledWith(1, '\n~ Files found:');
        expect(spy).toHaveBeenNthCalledWith(2, '~   path 1');
        expect(spy).toHaveBeenNthCalledWith(3, '~   path 2');
        expect(spy).toHaveBeenNthCalledWith(4, '~   path 3');
    });
});
