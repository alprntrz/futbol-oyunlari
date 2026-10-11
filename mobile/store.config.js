// App Store metadata for `eas metadata:push`. Texts live in store.config.json (committed);
// the review contact (email, phone) comes from store.contact.json, which is gitignored
// so it never reaches the public repo.
const fs = require("fs");
const path = require("path");

const config = require("./store.config.json");
const contactFile = path.join(__dirname, "store.contact.json");

if (fs.existsSync(contactFile)) {
  Object.assign(config.apple.review, JSON.parse(fs.readFileSync(contactFile, "utf8")));
}

module.exports = config;
