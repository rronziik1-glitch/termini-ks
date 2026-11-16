// Sets the admin password: asks for it twice (hidden), stores ONLY its scrypt hash as ADMIN_PASSWORD_HASH in .env.
// Run: npm run admin:password      (on the server, put the printed ADMIN_PASSWORD_HASH line in the hosting settings)
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { stdin, stdout } from 'node:process';

function ask(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = '';
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        stdin.setRawMode?.(false); stdin.pause(); stdin.off('data', onData); stdout.write('\n'); resolve(value);
      } else if (ch === '\u0003') { stdout.write('\n'); process.exit(1); }
      else if (ch === '\u0008' || ch === '\u007f') { if (value) { value = value.slice(0, -1); stdout.write('\b \b'); } }
      else { value += ch; stdout.write('*'); }
    };
    stdin.on('data', onData);
  });
}

const pw = await ask('Admin password (min 12 characters): ');
if (pw.length < 12) { console.log('Too short. Use at least 12 characters, e.g. 3-4 random words.'); process.exit(1); }
const again = await ask('Type it again: ');
if (pw !== again) { console.log('The two passwords are different. Nothing was changed.'); process.exit(1); }

const salt = randomBytes(16).toString('hex');
const line = `ADMIN_PASSWORD_HASH="scrypt$${salt}$${scryptSync(pw, salt, 64).toString('hex')}"`;
const file = '.env';
let text = existsSync(file) ? readFileSync(file, 'utf8') : '';
text = /^ADMIN_PASSWORD_HASH=.*$/m.test(text) ? text.replace(/^ADMIN_PASSWORD_HASH=.*$/m, line) : text.replace(/\n?$/, '\n') + line + '\n';
writeFileSync(file, text);
console.log('Done. The admin password is set (only its hash is saved in .env). Restart the app: npm run dev');
