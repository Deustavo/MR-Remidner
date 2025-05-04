import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';
dotenv.config();

const slackClient = new WebClient(process.env.SLACK_TOKEN);

export async function sendToSlack(message: string) {
  console.log('💬 Enviando mensagem para o Slack...');
  try {
    await slackClient.chat.postMessage({
      channel: process.env.SLACK_CHANNEL!,
      text: message,
      mrkdwn: true // Habilita Markdown
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem para o Slack:', error);
  }
}