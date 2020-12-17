// const fs = require("fs");
const path = require("path");
const { escape } = require("querystring");
// const { promisify } = require("util");

const matter = require("gray-matter");
const removeMd = require("remove-markdown");
const striptags = require("striptags");
const nodejieba = require("nodejieba");

// const mkdirp = require("mkdirp-promise");
// const readRecursive = require('fs-readdir-recursive');
// const readdir = promisify(fs.readdir);
// const writeFile = promisify(fs.writeFile);
const fsx = require("fs-extra");
const klaw = require("klaw");
const { ensureDir } = fsx;
const { readdir, writeFile } = fsx.promises;


const defaultOpt = {
  contextPath: "/posts",
  dir: "content/posts",
  recursive: false,
  output: "public/index.json",
  matterType: "yaml",
  matterDelims: "---",
  skipDraft: true,
  extensions: ".md",
  jiebaConf: {}
};

function urlize(str) {
  str = str
    .replace(/\s/g, "-")
    .replace(/[\(\)&@]/g, "")
    .toLowerCase();
  return escape(str);
}

function ChineseCut(str) {
  return (
    str &&
    str
      .replace(/\n/gm, "")
      .replace(
        /[\u4E00-\u9FA5\uF900-\uFA2D]+/g,
        match => ` ${nodejieba.cut(match).join(" ")} `
      )
  );
}

function handle(filename, option) {
  const filepath = path.join(option.dir, filename);
  const pathinfo = path.parse(filepath);
  const meta = matter.read(filepath, {
    language: option.matterType,
    delims: option.matterDelims
  });

  if (option.skipDraft && meta.data.draft === true) return;

  const plainText =
    pathinfo.ext === ".md" ? removeMd(meta.content) : striptags(meta.content);
  let uri = path.join(option.contextPath, urlize(pathinfo.name));

  if (meta.data.slug != null) uri = path.dirname(uri) + meta.data.slug;
  if (meta.data.url != null) uri = meta.data.url;
  const tags = meta.data.tags || [];
  //中文分词
  const oriTitle = String(meta.data.title); // casting to string
  const content = ChineseCut(plainText);
  const title = ChineseCut(oriTitle);

  return { uri, tags, content, title, oriTitle: oriTitle };
}

module.exports = function (option = {}) {
  option = Object.assign({}, defaultOpt, option);
  const exts = arrayfy(option.extensions);
  nodejieba.load(option.jiebaConf);
  const read = option.recursive ? readdirRecursive(option.dir) : readdir(option.dir);

  return read
    .then(files => files.filter(file => exts.some(ext => file.endsWith(ext))))
    .then(files => files.map(file => handle(file, option)))
    .then(files => files.filter(file => file != null))
    .then(files => JSON.stringify(files))
    .then(index => write(index, option.output));
};

function write(index, output) {
  return ensureDir(path.dirname(output)).then(() =>
    writeFile(output, index, { encoding: "utf8" })
  );
}

function arrayfy(o) {
  return Array.isArray(o) ? o : o.split(",");
}

function readdirRecursive(dir) {
  return new Promise((resolve, reject) => {

    const dirPath = path.resolve(__dirname, dir);

    const items = []; // files, directories, symlinks, etc
    klaw(dir)
      .on('data', item => {
        const relativePath = path.relative(dirPath, item.path);
        items.push(relativePath);
      })
      .on('error', (err) => {
        reject(err);
      })
      .on('end', () => {
        resolve(items);
      });
    
  });
}