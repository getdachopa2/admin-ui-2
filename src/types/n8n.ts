// src/types/n8n.ts
// Tip tanımları — UI ile n8n arasında veri sözleşmesini belirler.

export type PaymentType = 'CREDITCARD' | 'DEBITCARD' | 'PREPAIDCARD';

export interface PaymentOptions {
  includeMsisdnInOrderID?: boolean;
  checkCBBLForMsisdn?: boolean;
  checkCBBLForCard?: boolean;
  checkFraudStatus?: boolean;
}

export interface PaymentState {
  userId: string;
  userName: string;
  threeDOperation: boolean;
  installmentNumber: number;
  amount: number;
  msisdn: string;
  paymentType: PaymentType;
  options: PaymentOptions;
}

export type RunMode = 'payment-only' | 'all' | 'cancel' | 'refund';
export type Action = 'payment' | 'cancel' | 'refund';

export interface StartPayload {
  env: 'stb' | 'prp';
  channelId: string;
  segment?: string;
  application: {
    applicationName: string;
    applicationPassword: string;
    secureCode: string;
    transactionId: string;
    transactionDateTime: string;
  };
  userId?: string;
  userName?: string;
  payment: {
    paymentType: 'creditcard' | 'debitcard' | 'prepaidcard';
    threeDOperation: boolean;
    installmentNumber: number;
    options?: PaymentOptions;
  };
  products: Array<{ amount: number; msisdn?: string }>;
  cardSelectionMode: 'automatic' | 'manual';
  manualCards?: Array<{ ccno: string; e_month: string; e_year: string; cvv: string; bank_code?: string }>;
  cardCount?: number;
  action: Action;
  runMode: RunMode;
  paymentRef?: { paymentId: string };
}

export interface RunStep {
  seq?: number; // BU SATIRI EKLEYİN
  time: string;
  name: string;
  status: 'running' | 'success' | 'error';
  message?: string;
  request?: unknown;
  response?: unknown;
}
export interface RunData {
  status: 'running' | 'completed' | 'error';
  startTime: string;
  endTime: string | null;
  steps: RunStep[];
  result?: unknown;
  params?: unknown;
  context?: { base?: string; launchUrl?: string };
}

export type N8nEventsResponse = RunData;

export type TestCardRow = {
  bank_code: string;
  status: 0 | 1;
  ccno?: string;
  ccno_last4?: string;
  ccno_masked?: string;
  e_month?: string;
  e_year?: string;
  expire?: string;
};

export type CandidateRow = {
  paymentId: string;
  orderId?: string;
  amount?: number;
  app?: string;
  success?: boolean | string;
  createdAt: string;
};

export type ManualCard = {
  ccno: string;
  e_month: string;
  e_year: string;
  cvv: string;
  bank_code?: string;
};




export type Scenario = 'ALL' | 'PAYMENT_3DS_OFF' | 'CANCEL' | 'REFUND';

export interface WizardData {
  scenarios: Scenario[];

  // Step 2: Environment & Channel
  env?: 'stb' | 'prp';
  channelId?: string;

  // Step 3: Application Info  
  application?: {
    applicationName: string;
    applicationPassword: string;
    secureCode: string;
    transactionId: string;
    transactionDateTime: string;
  };

  // Step 4: Cards
  cardSelectionMode?: 'automatic' | 'manual';
  manualCards?: ManualCard[];
  cardCount?: number;

  // Step 5: Cancel/Refund
  cancelRefund?: {
    selectedAction?: 'cancel' | 'refund';
    selectedCandidate?: { paymentId: string } | null;
  };

  // Legacy fields for compatibility
  cancelList?: Array<{ paymentId: string; amount?: number }>;
  refundList?: Array<{ paymentId: string; amount: number }>;

  // Step 6: Payment Details
  payment?: PaymentState;
}