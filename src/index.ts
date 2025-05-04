import { getOpenMergeRequests } from './gitlab';
import { sendToSlack } from './slack';

async function run() {
  console.log('Starting MR check...');
  const messages = await getOpenMergeRequests();

  if (messages.length > 0) {
    const header = '*We have pending MRs 👀*\n';
    const body = messages.join('\n\n'); // <-- line break between MRs
    await sendToSlack(`${header}\n${body}`);
    console.log('✅ Messages sent to Slack successfully.');
  } else {
    await sendToSlack('✅ No pending MRs at the moment.');
  }
}

run();
