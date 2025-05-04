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

run();