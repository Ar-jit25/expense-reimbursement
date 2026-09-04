const fs = require("fs");
const path = require("path");

const filesToCheck = [
  "backend/package.json",
  "frontend/package.json",
  "backend/src/index.js",
  "backend/src/middleware/auth.js"
];

for (const file of filesToCheck) {
  const p = path.resolve(file);
  if (fs.existsSync(p)) {
    let buf = fs.readFileSync(p);
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      console.log("Removing BOM from", file);
      buf = buf.slice(3);
      fs.writeFileSync(p, buf);
    }
  }
}
