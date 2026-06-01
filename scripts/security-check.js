const fs = require("fs");
const path = require("path");
const artifact = require("../artifacts/contracts/SilentWhale.sol/SilentWhale.json");

const contractPath = path.join(__dirname, "..", "contracts", "SilentWhale.sol");
const source = fs.readFileSync(contractPath, "utf8");

const requiredFunctions = [
  "subscribeWithToken",
  "getPaymentReceipt",
  "createTeam",
  "addTeamMember",
  "recordAlert",
  "updateSignalMetadata",
  "setPublishCooldown",
  "withdrawToken",
];

const bytecodeBytes = (artifact.deployedBytecode.length - 2) / 2;
const failures = [];

if (bytecodeBytes > 24_576) {
  failures.push(`deployed bytecode is ${bytecodeBytes} bytes`);
}

for (const fn of requiredFunctions) {
  if (!source.includes(`function ${fn}`)) {
    failures.push(`missing ${fn}`);
  }
}

if (!source.includes("nonReentrant")) {
  failures.push("treasury/payment writes should use nonReentrant");
}

if (!source.includes("FHE.allowThis") || !source.includes("FHE.allow(")) {
  failures.push("encrypted handles must be granted through CoFHE ACL");
}

if (source.includes("PRIVATE_KEY")) {
  failures.push("contract source must not reference PRIVATE_KEY");
}

if (failures.length > 0) {
  console.error("SECURITY_CHECK_FAILED");
  failures.forEach((failure) => console.error("-", failure));
  process.exitCode = 1;
} else {
  console.log("SECURITY_CHECK_OK");
  console.log("Deployed bytecode bytes:", bytecodeBytes);
}
