/* Inline css/site.css and js/site.js into one file.
   The replacements go through a function, not a string: a replacement
   *string* treats $$, $&, $1 … as escapes, which silently rewrote every
   $$ helper in site.js to $. */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

let html = read('index.html');
const css = read('css/site.css').trim();
const js  = read('js/site.js').trim();

if (/<\/script/i.test(js)) throw new Error('site.js contains </script and cannot be inlined verbatim');
if (/<\/style/i.test(css)) throw new Error('site.css contains </style and cannot be inlined verbatim');

function swap(re, out, what) {
  const next = html.replace(re, () => out);      // function form: no $ escapes
  if (next === html) throw new Error(what + ' not found in index.html');
  html = next;
}
swap(/<link rel="stylesheet" href="css\/site\.css">/, '<style>\n' + css + '\n</style>', 'stylesheet link');
swap(/<script src="js\/site\.js"><\/script>/, '<script>\n' + js + '\n</script>', 'script tag');

if (/href="css\/|src="js\//.test(html)) throw new Error('an external css/js reference survived');
if (!html.includes(css)) throw new Error('css was altered during inlining');
if (!html.includes(js))  throw new Error('js was altered during inlining');

fs.writeFileSync(path.join(root, 'hair-by-oshi-standalone.html'), html);
console.log('standalone written:', html.length, 'bytes — css and js byte-identical');
