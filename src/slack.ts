import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';

dotenv.config();

const SLACK_TOKEN = process.env.SLACK_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL;

if (!SLACK_TOKEN || !SLACK_CHANNEL) {
  throw new Error('Missing required Slack configuration. Please check your .env file.');
}

const slackClient = new WebClient(SLACK_TOKEN);

export async function sendToSlack(message: string): Promise<void> {
  console.log('💬 Sending message to Slack...');
  
  try {
    const result = await slackClient.chat.postMessage({
      channel: SLACK_CHANNEL as string,
      text: message,
      mrkdwn: true
    });

    if (!result.ok) {
      throw new Error(`Failed to send message: ${result.error}`);
    }
    
    console.log('✅ Message sent successfully to Slack');
  } catch (error) {
    console.error('❌ Error sending message to Slack:', error);
    throw error; // Re-throw to allow caller to handle the error
  }
}