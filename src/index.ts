import cron from 'node-cron';
import { getOpenMergeRequests } from './gitlab';
import { sendToSlack } from './slack';

async function run() {
  console.log('Iniciando verificação de Merge Requests...');
  const mrs = await getOpenMergeRequests();
  if (mrs.length > 0) {
    const message = `🚨 *Merge Requests Pendentes:*\n${mrs.join('\n')}`;
    await sendToSlack(message);
  } else {
    await sendToSlack('✅ Sem Merge Requests abertas no momento.');
  }
}

// Rodar 09:00 e 14:00
// cron.schedule('0 9,14 * * *', () => {
//   run();
// });

run();