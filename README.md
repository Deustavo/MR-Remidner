# 🤖 GitLab Merge Request Reminder Bot

This bot automatically sends a daily summary of open Merge Requests from a GitLab project to a Slack channel. It provides visual status tags based on the review and approval state of each MR.

---

## 🚀 Features

- 💬 Posts Merge Request summaries with titles and clickable links.
- 🔎 Detects MR status based on threads, approvals, and issue labels:
  - Threads pending
  - Waiting for code review
  - Waiting for QA
  - Changes requested by QA
  - Ready to merge
- ✅ Works serverlessly via **GitHub Actions**.
- 🧠 Uses Slack's rich message formatting for clean display.

---

## 📊 Status Logic

Each Merge Request is shown with a status and an emoji, based on the following rules:

| Emoji  | Status               | Logic                                                                 |
|--------|----------------------|------------------------------------------------------------------------|
| 💬     | Threads Pending       | Has unresolved threads                                                |
| 🕵️‍♂️   | Waiting Code Review   | No unresolved threads, no approvals                                  |
| 🛠️     | Changes Requested by QA     | Has related issues with 'QA::Waiting to dev' label                   |
| 🔍     | Waiting QA            | No unresolved threads, has approval(s), but related issues don't have QA approval labels |
| ✅     | Ready to Merge        | No unresolved threads, has approvals, and related issues have 'WIP::Tested' or later labels |

### QA Approval Logic

The bot determines QA approval by checking if related issues have the following labels (or any later in the workflow):
- `WIP::Tested` ✅
- `WIP::Waiting Deploy` ✅

**Board Labels Order:**
1. `WIP::Dev`
2. `WIP::Waiting Code Review`
3. `WIP::Waiting QA`
4. `WIP::QA`
5. `WIP::Tested` ← **QA Approved from here**
6. `WIP::Waiting Deploy` ← **QA Approved**

Each MR is shown in the message like this:

```
<https://gitlab.com/...|project#iid - MR Title>
🔍 *Status:* Waiting QA
```

---

## ⚙️ Technologies

- Node.js + TypeScript  
- Slack Web API  
- GitLab REST API  
- dotenv  

---

## 🚀 Setup

### 1. Clone the project

```bash
git clone https://github.com/your-username/merge-request-reminder.git
cd merge-request-reminder
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Variables

Add a `.env` file to the root of your project with the following content:

```env
SLACK_TOKEN=your-slack-bot-token
SLACK_CHANNEL=channel-id-or-name
GITLAB_TOKEN=your-gitlab-personal-access-token
GITLAB_PROJECT_ID=your-project-id
```

> 🔎 Tip: Use the channel ID (e.g. `C01ABCXYZ`) instead of just the name to avoid `channel_not_found` errors.


### 4. Run the bot manually

```bash
npx ts-node src/index.ts
```

### 5. See the slack message

You should receive a message like this in Slack

![image](https://github.com/user-attachments/assets/74f1a335-fcf3-478f-a974-4cc4837b63b8)

---

## ☁️ Deployment with GitHub Actions

This project uses **GitHub Actions** to run automatically at 10:00 AM BRT on weekdays.

### 🛠 Setup GitHub Secrets

Go to your repository → `Settings > Secrets > Actions` and add:

- `SLACK_TOKEN`
- `SLACK_CHANNEL`
- `GITLAB_TOKEN`
- `GITLAB_PROJECT_ID`

### 🧩 GitHub Actions Workflow

File: `.github/workflows/cron.yml`

```yaml
name: GitLab Merge Request Reminder

on:
  schedule:
    - cron: '0 14 * * 1-5'  # 10h BRT, apenas dias úteis
  workflow_dispatch:        # permite rodar manualmente

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npx ts-node src/index.ts
        env:
          SLACK_TOKEN: ${{ secrets.SLACK_TOKEN }}
          GITLAB_TOKEN: ${{ secrets.GITLAB_TOKEN }}
          GITLAB_PROJECT_ID: ${{ secrets.GITLAB_PROJECT_ID }}
          SLACK_CHANNEL: ${{ secrets.SLACK_CHANNEL }}
```

---

## 📄 Licença

This bot was inspired by a creation by [Leo Caliani](https://github.com/lcaliani).

MIT. Free to use, modify and contribute.
