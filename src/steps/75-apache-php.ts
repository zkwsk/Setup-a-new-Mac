import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyManagedBlock } from '../managed-block.ts';
import { defineStep } from './index.ts';

const CONF = '/etc/apache2/httpd.conf';

const BLOCK = [
  'LoadModule proxy_module libexec/apache2/mod_proxy.so',
  'LoadModule proxy_fcgi_module libexec/apache2/mod_proxy_fcgi.so',
  '<FilesMatch \\.php$>',
  '    SetHandler "proxy:fcgi://127.0.0.1:9000"',
  '</FilesMatch>',
  '<IfModule dir_module>',
  '    DirectoryIndex index.php index.html',
  '</IfModule>',
];

/** Superseded by the managed block; removed so handlers cannot double up. */
const LEGACY = [
  /^LoadModule php_module /,
  /^#?LoadModule proxy_module libexec\/apache2\/mod_proxy\.so$/,
  /^#?LoadModule proxy_fcgi_module libexec\/apache2\/mod_proxy_fcgi\.so$/,
  /^SetHandler application\/x-httpd-php$/,
  /^SetHandler "proxy:fcgi:\/\/127\.0\.0\.1:9000"$/,
];

export default defineStep({
  id: 'apache-php',
  name: 'Serve PHP through Apache via FastCGI',
  description: 'edits /etc/apache2/httpd.conf and starts php-fpm',
  group: 'Applications',
  phase: 'post',
  when: ({ installed }) => installed.has('brew:php'),
  run: async ({ $, log }) => {
    // httpd.conf is world-readable but root-owned, so only the write needs
    // privilege: transform in memory, then `install` it into place with the
    // ownership and mode stated explicitly.
    const current = await readFile(CONF, 'utf8');
    const next = applyManagedBlock(current, 'php', BLOCK, LEGACY);

    const staged = path.join(await mkdtemp(path.join(tmpdir(), 'san-mac-')), 'httpd.conf');
    await writeFile(staged, next, 'utf8');
    await $`sudo install -m 0644 -o root -g wheel ${staged} ${CONF}`;
    await rm(path.dirname(staged), { recursive: true, force: true });

    await $`sudo apachectl -k graceful`;
    await $`brew services start php`;
    log('apache is now routing .php to php-fpm on 127.0.0.1:9000');
  },
});
