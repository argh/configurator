import { exec } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

describe('Examples', () => {
  const examplesDir = './examples';
  const exampleFiles = fs.readdirSync(examplesDir).filter(file => file.endsWith('.js'));

  exampleFiles.forEach(file => {
    it(`should run ${file} successfully`, function (done) {
      // examples sometimes run for a longer time to demonstrate features
      this.slow(200);
      this.timeout(10000);
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