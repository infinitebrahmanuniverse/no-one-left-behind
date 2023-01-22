const run = require("./update-package-lib");

run().then((dirs) => {
    console.log("Wrote packages to:", dirs)
  })
  .catch((err) => {
    console.error("Error:", err)
  })
