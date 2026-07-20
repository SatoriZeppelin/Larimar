/**
 * 从 seed.json 生成内嵌默认资源（default-*.js）
 * 用法：node scripts/seed-to-defaults.js [seed.json 路径]
 */
const fs = require('fs');
const path = require('path');

const seedPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'resource', 'seed.json'));
const resourceDir = path.join(__dirname, '..', 'resource');

function readSeed() {
  const raw = fs.readFileSync(seedPath, 'utf8');
  return JSON.parse(raw);
}

function writeJs(globalName, comment, obj, outFile) {
  const header =
    comment +
    '\n * 由 scripts/seed-to-defaults.js 从 seed.json 生成，请勿手改\n' +
    ' * 对外：' +
    globalName +
    '\n */\n';
  const body = 'window.' + globalName + ' = ' + JSON.stringify(obj, null, 2) + ';\n';
  fs.writeFileSync(outFile, '/**\n' + header + body, 'utf8');
  console.log('wrote', path.relative(process.cwd(), outFile));
}

function main() {
  const seed = readSeed();
  if (seed.format !== 'tq_plus_seed') {
    console.warn('warning: unexpected format', seed.format);
  }

  const char = (seed.characterWorldbooks || []).find(function (x) {
    return x && x.tab && x.tab.id === 'tianqing';
  });
  if (!char || !char.worldbook) {
    throw new Error('seed.json 缺少 characterWorldbooks[tianqing]');
  }
  if (!seed.promptWorldbook) {
    throw new Error('seed.json 缺少 promptWorldbook');
  }
  if (!seed.defaultVariables) {
    throw new Error('seed.json 缺少 defaultVariables');
  }

  writeJs(
    '天青_default_worldbook_tianqing',
    ' * 默认世界书「天青」——首次载入游戏时写入角色设置·天青目录',
    char.worldbook,
    path.join(resourceDir, 'default-worldbook-tianqing.js'),
  );

  writeJs(
    '天青_default_prompt_worldbook',
    ' * 默认系统提示词（世界书）——首次载入写入「系统设置·提示词」',
    seed.promptWorldbook,
    path.join(resourceDir, 'default-prompt-worldbook.js'),
  );

  writeJs(
    '天青_default_variables',
    ' * 默认基础变量——首次载入写入「系统设置·变量」',
    seed.defaultVariables,
    path.join(resourceDir, 'default-variables.js'),
  );

  fs.copyFileSync(seedPath, path.join(resourceDir, 'seed.json'));
  console.log('copied seed.json → resource/seed.json');
}

main();
