declare module 'node-cron' {
  function schedule(expression: string, callback: () => void): void;
  export default { schedule };
} 