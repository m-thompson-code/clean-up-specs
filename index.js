const { main } = require('./main');

// Current work directory
const cwd = process.argv[2];
// const cwd = './';
const dryRun = process.argv[3] !== '--real-remove';
// const dryRun = true;

main(cwd, dryRun);
