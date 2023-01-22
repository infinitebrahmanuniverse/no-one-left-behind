const exec = require("child_process").execSync;
const run = require("./update-package-lib");
const fs = require('node:fs');
const path = require("path");

const lexec = function(command) {
  console.log(`> ${command}`);
  const out = exec(command).toString("utf8");
  console.log(out);
  return out;
};

const execSilent = function(command) {
  console.log(`> ${command}`);
  exec(command, { stdio: 'ignore' });
};

const startHash = exec("git rev-parse HEAD");
const toBranch = "snapshot";
try {
  lexec("git diff-index --quiet HEAD --");
} catch (e) {
  console.log("Invalid State. Repository has uncommited changes. Aborting...");
  process.exit(1);
}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
}

async function publish(dir) {
  try {
    lexec(`npm publish --access public ${dir}`);
    await sleep(2000)
  } catch (e) {
    await sleep(500)
    if (e.toString().includes(" You cannot publish over the previously published versions")) {
      console.log("Already published: ", dir)
    } else {
      console.log(e)
    }
  }
}

async function publishAll(dirs) {
  for(const dir of dirs) {
    await publish(dir)
  }
}

async function waitForGit() {
  if (fs.existsSync(path.join(__dirname, ".git", "index.lock"))) {
    await sleep(10000)
    return await waitForGit()
  } else {
    return true;
  }
}

// Generate packages, commit to git, upload to npm.
// Sleep to avoid overloading the system (too many files, no buffers, etc.).
run().then((async dirs => {
  try {
    console.log("Packages have been generated. Sleeping 15s.")
    await sleep(15000)
    execSilent('git add packages');
    await sleep(15000)
    await waitForGit()
    execSilent('git commit -m "Update dependencies"')
    await waitForGit()
    lexec(`git push -f origin HEAD:${toBranch}`);
    await publishAll(dirs)
  } catch (e) {
    console.log(e.message);
  }
}))
.catch(e => {
  console.log(e.message);
})
.finally(async () => {
  await waitForGit()
  lexec("git reset --hard " + startHash);
})

