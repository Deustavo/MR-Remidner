import { getOpenMergeRequests } from './gitlab';
import { sendToSlack } from './slack';

async function run() {
  console.log('Iniciando verificação de Merge Requests...');
  const messages = await getOpenMergeRequests();

  if (messages.length > 0) {
    const header = '🚨 *Merge Requests Pendentes:*\n';
    const body = messages.join('\n\n'); // <-- quebra entre MRs
    await sendToSlack(`${header}\n${body}`);
    console.log('✅ Mensagem enviada para o Slack com sucesso.');
  } else {
    await sendToSlack('✅ Sem Merge Requests abertas no momento.');
  }
}

run();