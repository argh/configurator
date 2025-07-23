import { exec } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

describe('Examples', () => {
  const examplesDir = './examples';
  const exampleFiles = fs.readdirSync(examplesDir).filter(file => file.endsWith('.js'));

  exampleFiles.forEach(file => {
    it(`should run ${file} successfully`, (done) => {
      const examplePath = path.join(examplesDir, file);
      exec(`node ${examplePath}`, (error, stdout, stderr) => {
        if (error) {
          console.log(`stdout: ${stdout}`);
          console.log(`stderr: ${stderr}`);
          done(error);
        } else {
          done();
        }
      });
    });
  });
});