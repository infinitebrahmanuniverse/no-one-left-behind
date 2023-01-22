const fsp = require('node:fs/promises');
const fs = require('node:fs');
const path = require("path");
let allPackageNames = require("all-the-package-names");

const groupSize = 1000;
const packagesDir = path.join(__dirname, "packages")

function getVersion() {
  const date = new Date();
  const monthS = ("" + (date.getMonth() + 1)).padStart(2, "0");
  const dayS = ("" + date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}.${monthS}.${dayS}`;
}

function packageEntry(name) {
  return `        "${name}": "latest"`;
}

function buildTopPackage(dependencies) {
  return `
{
    "name": "no-one-left-behind",
    "version": "${getVersion()}",
    "description": "Every package is invited",
    "repository": "Zalastax/no-one-left-behind",
    "scripts": {
        "update-packages": "node update-package.js",
        "deploy": "node deploy.js"
    },
    "license": "MIT",
    "dependencies": {
${dependencies.map(packageEntry).join(",\n")}
    }
}
`;
}

function subpackageName(name) {
  return `@zalastax/nolb-${name}`
}

function subpackageDir(name) {
  return `nolb-${name}`
}

function buildSubpackage(dependencies, name) {
  return `
{
    "name": "${name}",
    "version": "${getVersion()}",
    "description": "Subpackage of no-one-left-behind.",
    "repository": "Zalastax/no-one-left-behind",
    "license": "MIT",
    "dependencies": {
${dependencies.map(packageEntry).join(",\n")}
    }
}
`;
}

function addToArrayInMap(map, key, value) {
  if (map.has(key)) {
    map.get(key).push(value)
  } else {
    map.set(key, [value])
  }
}

function sanitizeLetter(letter) {
  const lcLetter = letter.toLowerCase()
  if (encodeURIComponent(lcLetter) === lcLetter && !/[~'!()*.]/.test(lcLetter)) {
    return lcLetter
  }
  return "_"
}

function buildDependencyTree(data) {
  if (data.length > groupSize) {
    const directDependencies = [];
    const groups = new Map();
    const hierarchy =  new Map()
    // Group the data by first character
    for (let i = 0; i < data.length; i++) {
      const item = data[i]
      const remain = item.remain
      if (remain.length === 0) {
        directDependencies.push(getName(item))
      } else {
        const newLetter = remain.substr(0, 1)
        const newUsedSanitized = item.usedSanitized + sanitizeLetter(newLetter)
        const newRemain = remain.substr(1)
        addToArrayInMap(groups, newUsedSanitized, {
          name: item.name,
          remain: newRemain,
          usedSanitized: newUsedSanitized
        })
      }
    }

    // Process each group
    for (let [key, value] of groups) {
      hierarchy.set(key, buildDependencyTree(value))
    }


    return {
      type: "node",
      directDependencies: directDependencies,
      hierarchy: hierarchy
    };

  } else {
    return {
      type: "leaf",
      directDependencies: data.map(getName)
    }
  }
}

function getName(wrapped) {
  return wrapped.name
}

function wrapPackageName(name) {
  return {
    name: name,
    remain: name,
    usedSanitized: ""
  }
}

async function writePackages(dependencyTree) {
  const topPackageName = "no-one-left-behind"
  await fsp.rm(packagesDir, { recursive: true, force: true })
  await fsp.mkdir(packagesDir)
  const [dependencies, promises] = writeHierarchy(dependencyTree)
  promises.push(writePackage(buildTopPackage(dependencies), topPackageName))
  const dirs = await Promise.all(promises)
  return dirs
}

async function writePackage(packageContent, name) {
  const dir = path.join(packagesDir, name)
  await fsp.mkdir(dir)
  fs.writeFileSync(path.join(dir, "package.json"), packageContent)
  return dir
}

function writeHierarchy(dependencyTree) {
  const dependencies = Array.from(dependencyTree.directDependencies)
  const promises = []
  if (dependencyTree.hierarchy != null) {
    for (let [name, node] of dependencyTree.hierarchy.entries()) {
      const [subDependencies, subPromises] = writeHierarchy(node)
      promises.push(...subPromises)
      const spn = subpackageName(name)
      dependencies.push(spn)
      promises.push(writePackage(buildSubpackage(subDependencies, spn), subpackageDir(name)))
    }
  }
  return [dependencies, promises]
}


function run() {
  return writePackages(
    buildDependencyTree(
      allPackageNames
      .filter(name => name !== "no-one-left-behind" && !name.startsWith("@zalastax/"))
      .sort()
      .map(wrapPackageName)))
}
  
module.exports = run

