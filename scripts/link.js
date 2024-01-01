import fs from 'fs';
import path from 'path';

// create link for test
const existingPath = path.resolve('./');
const newPath = path.resolve('./node_modules/vitest-monocart-coverage');
// will be created by sf install link
if (fs.existsSync(newPath)) {
    fs.unlinkSync(newPath);
}
fs.symlinkSync(existingPath, newPath);
