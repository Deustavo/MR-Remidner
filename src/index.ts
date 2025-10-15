import { getMergeRequestsByAuthors } from './gitlab/gitlab';
import { sendToSlack } from './slack';

async function run() {
  try {
    console.log('🚀 Starting MR check...');
    
    // Fetch MRs by authors configured in GITLAB_AUTHOR_USERNAMES
    const messages = await getMergeRequestsByAuthors();

    if (messages.length > 0) {
      const header = '*We have pending MRs 👀*\n';
      const body = messages.join('\n');
      await sendToSlack(`${header}\n${body}`);
    } else {
      await sendToSlack('✅ No pending MRs at the moment.');
      console.log('✅ No pending MRs found.');
    }
  } catch (error) {
    console.error('❌ Error running MR check:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
  process.exit(1);
});

run();
