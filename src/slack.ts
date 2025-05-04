import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';
dotenv.config();

const slackClient = new WebClient(process.env.SLACK_TOKEN);

export async function sendToSlack(message: string) {
  console.log('💬 Sending message to Slack...');
  try {
    await slackClient.chat.postMessage({
      channel: process.env.SLACK_CHANNEL!,
      text: message,
      mrkdwn: true // Enable Markdown
    });
  } catch (error) {
    console.error('Error sending message to Slack:', error);
  }
}