# 🤖 GitLab Merge Request Reminder Bot

Um bot escrito em **TypeScript** que envia mensagens automáticas para um canal do **Slack** duas vezes ao dia, listando as Merge Requests abertas de um repositório do **GitLab**.

---

## ⚙️ Tecnologias

- Node.js + TypeScript  
- Slack Web API  
- GitLab REST API  
- node-cron  
- dotenv  

---

## 🚀 Como rodar localmente

### 1. Clone o projeto

```bash
git clone https://github.com/seu-usuario/merge-request-reminder.git
cd merge-request-reminder
```

---

### 2. Instale as dependencias

```bash
npm install
```

---

### 3. Configure as variáveis de ambiente

Crie um arquivo .env na raiz com o seguinte conteúdo:

```bash
SLACK_TOKEN=xoxb-seu-token-do-slack
SLACK_CHANNEL=nome-do-canal-ou-ID
GITLAB_TOKEN=glpat-seu-token-do-gitlab
GITLAB_PROJECT_ID=ID-numérico-do-projeto
```

> 🔐 Dica: use o ID numérico do canal (ex: C0123456) para evitar problemas de channel_not_found.

---

### 4. Execute o bot manualmente

```bash
npx ts-node src/index.ts
```

---

## 📄 Licença

Esse bot foi inspirado em uma criação do [Leo Caliani](https://github.com/lcaliani).

MIT. Livre para usar, modificar e contribuir.
