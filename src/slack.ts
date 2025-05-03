import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';
dotenv.config();

const slackClient = new WebClient(process.env.SLACK_TOKEN);

export async function sendToSlack(message: string) {
  await slackClient.chat.postMessage({
    channel: process.env.SLACK_CHANNEL!,
    text: message
  });
}
