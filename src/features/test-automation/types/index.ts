// n8n akışından dönen bir test adımının yapısını tanımlar.
export interface TestRunStep {
  time: string;
  name: string;
  status: "running" | "success" | "error";
  message: string | null;
  request?: any;
  response?: any;
}

// Bir test çalıştırmasının genel durumunu ve adımlarını tanımlar.
export interface TestRun {
  run_key: string;
  status: "running" | "completed" | "error";
  startTime: string;
  endTime: string | null;
  params: any;
  result: any;
  steps: TestRunStep[];
}

// API'den dönecek olan geçmiş test çalıştırmalarının listesi için tip.
export interface RunHistoryItem {
  run_key: string;
  start_time: string;
  status: "running" | "completed" | "error";
}
