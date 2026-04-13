const express = require('express');
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const { asyncRoute } = require('../helpers');

const execPromise = util.promisify(exec);
const router = express.Router();

const FEEDS = {
  shared:   { script: 'shared_bank_feed.py',   label: 'Bank feeds',           successPhrase: 'Transactions inserted successfully' },
  personal: { script: 'personal_bank_feed.py', label: 'Personal bank feeds',  successPhrase: 'Successfully processed' },
  offset:   { script: 'offset_bank_feed.py',   label: 'Offset bank feeds',    successPhrase: 'Successfully processed' },
};

function makeHandler(key) {
  const cfg = FEEDS[key];
  const scriptPath = path.join(__dirname, '..', '..', cfg.script);

  return asyncRoute(async (_req, res) => {
    console.log(`Refreshing ${cfg.label} data...`);
    const { stdout, stderr } = await execPromise(`python3 ${scriptPath}`);
    if (stderr) console.warn(`Python script warnings: ${stderr}`);
    console.log(`Python script output: ${stdout}`);

    const noNew = stdout.includes('No transactions found to process');
    const success = stdout.includes(cfg.successPhrase);
    const message = success
      ? `${cfg.label} refreshed successfully`
      : noNew
        ? `${cfg.label} process completed but no new transactions were found`
        : `${cfg.label} process completed`;

    res.status(200).json({ success: true, message, details: stdout });
  });
}

router.post('/refresh-shared-bank-feeds',   makeHandler('shared'));
router.post('/refresh-personal-bank-feeds', makeHandler('personal'));
router.post('/refresh-offset-bank-feeds',   makeHandler('offset'));

module.exports = router;
