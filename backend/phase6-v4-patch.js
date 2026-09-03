const fs = require('fs');
const path = require('path');

const v4Path = path.join(__dirname, 'verify-phase4.js');
let v4 = fs.readFileSync(v4Path, 'utf8');

const submitLine = "await request(app).post(`/api/reports/${repId}/submit`).set('Authorization', 'Bearer TOKEN_EMP');";
const assignmentLine = `await request(app).post(\`/api/reports/\${repId}/assignments\`).set('Authorization', 'Bearer TOKEN_APP2').send({ approverId: approverId });`;

v4 = v4.replace(submitLine, submitLine + "\n  " + assignmentLine);

fs.writeFileSync(v4Path, v4);
console.log("verify-phase4.js assignment injected.");
